import { and, eq } from "drizzle-orm";

import { getDb } from "../../db/client";
import {
  organizations,
  providerAccounts,
  providerCredentials,
  tenants,
  tenantServers,
} from "../../db/schema";
import { HetznerApiError, HetznerClient } from "../hetzner/client";
import {
  getWorkOS,
  hasWorkOSConfig,
} from "../workos";
import { OpenAiProvisioner } from "../providers/openai/provisioning";

import { appendJobEvent, markJobFailed, markJobSucceeded } from "./queue";
import {
  type ClaimedJob,
  JOB_TYPES,
  type DeleteWorkspacePayload,
} from "./types";

const OPENAI_PROVIDER_KEY = "openai";

const DELETE_WORKSPACE_EVENTS = {
  archivingOpenAiProject: "archiving_openai_project",
  deletedHetznerServer: "deleted_hetzner_server",
  deletedOpenAiServiceAccount: "deleted_openai_service_account",
  deletedWorkspaceLocally: "deleted_workspace_locally",
  deletingHetznerServer: "deleting_hetzner_server",
  deletingOpenAiServiceAccount: "deleting_openai_service_account",
  deletingWorkspaceLocally: "deleting_workspace_locally",
  deletingWorkOsOrganization: "deleting_workos_organization",
  failed: "delete_workspace_failed",
  skippedMissingOrganization: "skipped_missing_workspace",
  skippedMissingProviderServer: "skipped_missing_provider_server",
  skippedOpenAiProjectArchive: "skipped_openai_project_archive",
  skippedOpenAiServiceAccountDeletion: "skipped_openai_service_account_deletion",
  skippedWorkOsDeletion: "skipped_workos_deletion",
  succeeded: "delete_workspace_succeeded",
} as const;

const openAiProvisioner = new OpenAiProvisioner();

export async function processDeleteWorkspaceJob(job: ClaimedJob): Promise<void> {
  if (job.jobType !== JOB_TYPES.deleteWorkspace) {
    throw new Error(
      `Unsupported job type for workspace deletion handler: ${job.jobType}`,
    );
  }

  const payload = parseDeleteWorkspacePayload(job.payload);

  try {
    const snapshot = await getWorkspaceDeletionSnapshot(payload.organizationId);

    if (!snapshot.organization) {
      await appendJobEvent(
        job.id,
        DELETE_WORKSPACE_EVENTS.skippedMissingOrganization,
        "Workspace was already deleted before the teardown job ran",
        {
          organizationId: payload.organizationId,
          organizationSlug: payload.organizationSlug,
        },
      );
      await markJobSucceeded(job.id, {
        alreadyDeleted: true,
        organizationId: payload.organizationId,
        organizationSlug: payload.organizationSlug,
      });
      return;
    }

    const deletedOpenAiServiceAccounts = await deleteOpenAiResources({
      jobId: job.id,
      openAiCredentials: snapshot.openAiCredentials,
    });
    const deletedHetznerServers = await deleteTenantServers({
      jobId: job.id,
      tenantServers: snapshot.tenantServers,
    });
    const deletedWorkOsOrganization = await deleteWorkOsOrganization({
      externalOrganizationId: snapshot.organization.externalOrganizationId,
      jobId: job.id,
      organizationSlug: snapshot.organization.organizationSlug,
    });

    await appendJobEvent(
      job.id,
      DELETE_WORKSPACE_EVENTS.deletingWorkspaceLocally,
      "Deleting the local workspace and all workspace-scoped records",
      {
        organizationId: snapshot.organization.organizationId,
        organizationSlug: snapshot.organization.organizationSlug,
      },
    );

    await getDb()
      .delete(organizations)
      .where(eq(organizations.id, snapshot.organization.organizationId));

    await appendJobEvent(
      job.id,
      DELETE_WORKSPACE_EVENTS.deletedWorkspaceLocally,
      "Deleted the local workspace and cascaded workspace-scoped records",
      {
        organizationId: snapshot.organization.organizationId,
        organizationSlug: snapshot.organization.organizationSlug,
      },
    );

    await appendJobEvent(
      job.id,
      DELETE_WORKSPACE_EVENTS.succeeded,
      "Workspace deletion completed successfully",
      {
        deletedHetznerServers,
        deletedOpenAiServiceAccounts,
        deletedWorkOsOrganization,
        organizationId: snapshot.organization.organizationId,
        organizationSlug: snapshot.organization.organizationSlug,
      },
    );
    await markJobSucceeded(job.id, {
      deletedHetznerServers,
      deletedOpenAiServiceAccounts,
      deletedWorkOsOrganization,
      organizationId: snapshot.organization.organizationId,
      organizationSlug: snapshot.organization.organizationSlug,
      tenantCount: snapshot.tenantCount,
    });
  } catch (error) {
    const message = getErrorMessage(error);

    await appendJobEvent(
      job.id,
      DELETE_WORKSPACE_EVENTS.failed,
      "Workspace deletion failed",
      {
        error: message,
        organizationId: payload.organizationId,
        organizationSlug: payload.organizationSlug,
      },
    );
    await markJobFailed(job.id, message);
    throw error;
  }
}

async function getWorkspaceDeletionSnapshot(organizationId: string) {
  const db = getDb();
  const [organization] = await db
    .select({
      externalOrganizationId: organizations.externalId,
      organizationId: organizations.id,
      organizationName: organizations.name,
      organizationSlug: organizations.slug,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!organization) {
    return {
      openAiCredentials: [],
      organization: null,
      tenantCount: 0,
      tenantServers: [],
    };
  }

  const tenantRows = await db
    .select({
      id: tenants.id,
    })
    .from(tenants)
    .where(eq(tenants.organizationId, organizationId));

  const tenantIds = tenantRows.map((tenant) => tenant.id);

  const openAiCredentialRows =
    tenantIds.length > 0
      ? await db
          .select({
            projectId: providerAccounts.externalProjectId,
            serviceAccountId: providerCredentials.externalServiceAccountId,
            tenantId: tenants.id,
          })
          .from(providerAccounts)
          .innerJoin(tenants, eq(providerAccounts.tenantId, tenants.id))
          .leftJoin(
            providerCredentials,
            eq(providerCredentials.providerAccountId, providerAccounts.id),
          )
          .where(
            and(
              eq(tenants.organizationId, organizationId),
              eq(providerAccounts.providerKey, OPENAI_PROVIDER_KEY),
            ),
          )
      : [];

  return {
    openAiCredentials: openAiCredentialRows,
    organization,
    tenantCount: tenantRows.length,
    tenantServers:
      tenantIds.length > 0
        ? await db
            .select({
              provider: tenantServers.provider,
              providerServerId: tenantServers.providerServerId,
              tenantId: tenantServers.tenantId,
            })
            .from(tenantServers)
            .innerJoin(tenants, eq(tenantServers.tenantId, tenants.id))
            .where(eq(tenants.organizationId, organizationId))
        : [],
  };
}

async function deleteOpenAiResources(input: {
  jobId: string;
  openAiCredentials: Array<{
    projectId: string | null;
    serviceAccountId: string | null;
    tenantId: string;
  }>;
}) {
  const uniqueCredentials = dedupeCredentialTargets(input.openAiCredentials);

  for (const target of uniqueCredentials) {
    await appendJobEvent(
      input.jobId,
      DELETE_WORKSPACE_EVENTS.deletingOpenAiServiceAccount,
      "Deleting an OpenAI service account created for this workspace",
      {
        projectId: target.projectId,
        serviceAccountId: target.serviceAccountId,
      },
    );

    try {
      await openAiProvisioner.deleteTenantCredential({
        projectId: target.projectId,
        serviceAccountId: target.serviceAccountId,
      });
      await appendJobEvent(
        input.jobId,
        DELETE_WORKSPACE_EVENTS.deletedOpenAiServiceAccount,
        "Deleted an OpenAI service account for this workspace",
        {
          projectId: target.projectId,
          serviceAccountId: target.serviceAccountId,
        },
      );
    } catch (error) {
      if (isOpenAiNotFoundError(error)) {
        await appendJobEvent(
          input.jobId,
          DELETE_WORKSPACE_EVENTS.skippedOpenAiServiceAccountDeletion,
          "Skipped deleting an OpenAI service account because it was already gone",
          {
            projectId: target.projectId,
            serviceAccountId: target.serviceAccountId,
          },
        );
        continue;
      }

      throw error;
    }
  }

  for (const projectId of dedupeProjectIds(input.openAiCredentials)) {
    await appendJobEvent(
      input.jobId,
      DELETE_WORKSPACE_EVENTS.archivingOpenAiProject,
      "Archiving the OpenAI project for this workspace",
      {
        projectId,
      },
    );

    try {
      await openAiProvisioner.archiveProject(projectId);
    } catch (error) {
      if (isOpenAiNotFoundError(error)) {
        await appendJobEvent(
          input.jobId,
          DELETE_WORKSPACE_EVENTS.skippedOpenAiProjectArchive,
          "Skipped archiving an OpenAI project because it was already gone",
          {
            projectId,
          },
        );
        continue;
      }

      throw error;
    }
  }

  return uniqueCredentials.length;
}

async function deleteTenantServers(input: {
  jobId: string;
  tenantServers: Array<{
    provider: string;
    providerServerId: string | null;
    tenantId: string;
  }>;
}) {
  const hetznerTargets = dedupeHetznerTargets(input.tenantServers);

  if (hetznerTargets.length === 0) {
    return 0;
  }

  const hetznerClient = new HetznerClient();

  for (const target of hetznerTargets) {
    await appendJobEvent(
      input.jobId,
      DELETE_WORKSPACE_EVENTS.deletingHetznerServer,
      "Deleting the Hetzner tenant server for this workspace",
      {
        providerServerId: target.providerServerId,
        tenantId: target.tenantId,
      },
    );

    try {
      await hetznerClient.deleteServer(target.providerServerId);
      await appendJobEvent(
        input.jobId,
        DELETE_WORKSPACE_EVENTS.deletedHetznerServer,
        "Deleted the Hetzner tenant server for this workspace",
        {
          providerServerId: target.providerServerId,
          tenantId: target.tenantId,
        },
      );
    } catch (error) {
      if (isHetznerNotFoundError(error)) {
        await appendJobEvent(
          input.jobId,
          DELETE_WORKSPACE_EVENTS.skippedMissingProviderServer,
          "Skipped deleting a Hetzner server because it was already gone",
          {
            providerServerId: target.providerServerId,
            tenantId: target.tenantId,
          },
        );
        continue;
      }

      throw error;
    }
  }

  return hetznerTargets.length;
}

async function deleteWorkOsOrganization(input: {
  externalOrganizationId: string;
  jobId: string;
  organizationSlug: string;
}) {
  if (!hasWorkOSConfig()) {
    await appendJobEvent(
      input.jobId,
      DELETE_WORKSPACE_EVENTS.skippedWorkOsDeletion,
      "Skipped deleting the WorkOS organization because WorkOS is not configured in this environment",
      {
        externalOrganizationId: input.externalOrganizationId,
        organizationSlug: input.organizationSlug,
      },
    );
    return false;
  }

  await appendJobEvent(
    input.jobId,
    DELETE_WORKSPACE_EVENTS.deletingWorkOsOrganization,
    "Deleting the WorkOS organization for this workspace",
    {
      externalOrganizationId: input.externalOrganizationId,
      organizationSlug: input.organizationSlug,
    },
  );

  try {
    await getWorkOS().organizations.deleteOrganization(input.externalOrganizationId);
    return true;
  } catch (error) {
    if (isWorkOsNotFoundError(error)) {
      await appendJobEvent(
        input.jobId,
        DELETE_WORKSPACE_EVENTS.skippedWorkOsDeletion,
        "Skipped deleting the WorkOS organization because it was already gone",
        {
          externalOrganizationId: input.externalOrganizationId,
          organizationSlug: input.organizationSlug,
        },
      );
      return false;
    }

    throw error;
  }
}

function parseDeleteWorkspacePayload(
  payload: Record<string, unknown>,
): DeleteWorkspacePayload {
  const organizationId = payload.organizationId;
  const organizationSlug = payload.organizationSlug;
  const organizationExternalId = payload.organizationExternalId;

  if (typeof organizationId !== "string" || organizationId.length === 0) {
    throw new Error("Delete workspace job payload is missing organizationId");
  }

  if (typeof organizationSlug !== "string" || organizationSlug.length === 0) {
    throw new Error("Delete workspace job payload is missing organizationSlug");
  }

  if (
    typeof organizationExternalId !== "string" ||
    organizationExternalId.length === 0
  ) {
    throw new Error(
      "Delete workspace job payload is missing organizationExternalId",
    );
  }

  return {
    organizationExternalId,
    organizationId,
    organizationSlug,
  };
}

function dedupeCredentialTargets(
  rows: Array<{
    projectId: string | null;
    serviceAccountId: string | null;
    tenantId: string;
  }>,
) {
  const seen = new Set<string>();
  const uniqueTargets: Array<{
    projectId: string;
    serviceAccountId: string;
  }> = [];

  for (const row of rows) {
    if (!row.projectId || !row.serviceAccountId) {
      continue;
    }

    const key = `${row.projectId}:${row.serviceAccountId}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueTargets.push({
      projectId: row.projectId,
      serviceAccountId: row.serviceAccountId,
    });
  }

  return uniqueTargets;
}

function dedupeProjectIds(
  rows: Array<{
    projectId: string | null;
    serviceAccountId: string | null;
    tenantId: string;
  }>,
) {
  return [...new Set(rows.map((row) => row.projectId).filter(isNonEmptyString))];
}

function dedupeHetznerTargets(
  rows: Array<{
    provider: string;
    providerServerId: string | null;
    tenantId: string;
  }>,
) {
  const seen = new Set<string>();
  const uniqueTargets: Array<{
    providerServerId: string;
    tenantId: string;
  }> = [];

  for (const row of rows) {
    if (row.provider !== "hetzner" || !row.providerServerId) {
      continue;
    }

    const key = row.providerServerId;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueTargets.push({
      providerServerId: row.providerServerId,
      tenantId: row.tenantId,
    });
  }

  return uniqueTargets;
}

function isHetznerNotFoundError(error: unknown) {
  return (
    error instanceof HetznerApiError &&
    (error.responseStatus === 404 || error.code === "not_found")
  );
}

function isOpenAiNotFoundError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalizedMessage = error.message.toLowerCase();
  return normalizedMessage.includes("not found");
}

function isWorkOsNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 404
  );
}

function isNonEmptyString(value: string | null): value is string {
  return typeof value === "string" && value.length > 0;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}
