import { eq } from "drizzle-orm";

import { getDb } from "../../db/client";
import { organizations, tenantServers, tenants } from "../../db/schema";
import { HetznerApiError, HetznerClient } from "../hetzner/client";

import { appendJobEvent, markJobFailed, markJobSucceeded } from "./queue";
import {
  type ClaimedJob,
  type DeleteTenantServerPayload,
  JOB_TYPES,
} from "./types";

const DELETE_TENANT_SERVER_EVENTS = {
  deletingHetznerServer: "deleting_hetzner_server",
  deletedHetznerServer: "deleted_hetzner_server",
  deletingLocalServerRecord: "deleting_local_tenant_server_record",
  deletedLocalServerRecord: "deleted_local_tenant_server_record",
  failed: "delete_tenant_server_failed",
  skippedMissingProviderServer: "skipped_missing_provider_server",
  skippedMissingTenant: "skipped_missing_tenant",
  skippedNoServerRecord: "skipped_no_tenant_server_record",
  succeeded: "delete_tenant_server_succeeded",
} as const;

export async function processDeleteTenantServerJob(
  job: ClaimedJob,
): Promise<void> {
  if (job.jobType !== JOB_TYPES.deleteTenantServer) {
    throw new Error(
      `Unsupported job type for tenant-server deletion handler: ${job.jobType}`,
    );
  }

  const payload = parseDeleteTenantServerPayload(job.payload);

  try {
    const snapshot = await getTenantServerDeletionSnapshot(payload.tenantId);

    if (!snapshot.tenant) {
      await appendJobEvent(
        job.id,
        DELETE_TENANT_SERVER_EVENTS.skippedMissingTenant,
        "Tenant was already deleted before the server deletion job ran",
        {
          tenantId: payload.tenantId,
        },
      );
      await markJobSucceeded(job.id, {
        alreadyDeleted: true,
        tenantId: payload.tenantId,
      });
      return;
    }

    if (snapshot.tenantServers.length === 0) {
      await appendJobEvent(
        job.id,
        DELETE_TENANT_SERVER_EVENTS.skippedNoServerRecord,
        "Tenant server was already deleted before the job ran",
        {
          tenantId: payload.tenantId,
        },
      );
      await markJobSucceeded(job.id, {
        alreadyDeleted: true,
        tenantId: payload.tenantId,
      });
      return;
    }

    const deletedProviderServers = await deleteProviderServers({
      jobId: job.id,
      tenantServers: snapshot.tenantServers,
    });

    await appendJobEvent(
      job.id,
      DELETE_TENANT_SERVER_EVENTS.deletingLocalServerRecord,
      "Deleting local tenant server records while keeping the workspace",
      {
        organizationId: snapshot.tenant.organizationId,
        organizationSlug: snapshot.tenant.organizationSlug,
        tenantId: snapshot.tenant.tenantId,
      },
    );

    await getDb().transaction(async (tx) => {
      await tx
        .delete(tenantServers)
        .where(eq(tenantServers.tenantId, snapshot.tenant.tenantId));
      await tx
        .update(tenants)
        .set({
          status: "server_deleted",
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, snapshot.tenant.tenantId));
      await tx
        .update(organizations)
        .set({
          isReady: false,
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, snapshot.tenant.organizationId));
    });

    await appendJobEvent(
      job.id,
      DELETE_TENANT_SERVER_EVENTS.deletedLocalServerRecord,
      "Deleted local tenant server records and kept the workspace",
      {
        organizationId: snapshot.tenant.organizationId,
        organizationSlug: snapshot.tenant.organizationSlug,
        tenantId: snapshot.tenant.tenantId,
      },
    );
    await appendJobEvent(
      job.id,
      DELETE_TENANT_SERVER_EVENTS.succeeded,
      "Tenant server deletion completed successfully",
      {
        deletedProviderServers,
        organizationId: snapshot.tenant.organizationId,
        organizationSlug: snapshot.tenant.organizationSlug,
        tenantId: snapshot.tenant.tenantId,
      },
    );
    await markJobSucceeded(job.id, {
      deletedProviderServers,
      organizationId: snapshot.tenant.organizationId,
      organizationSlug: snapshot.tenant.organizationSlug,
      tenantId: snapshot.tenant.tenantId,
    });
  } catch (error) {
    const message = getErrorMessage(error);

    await appendJobEvent(
      job.id,
      DELETE_TENANT_SERVER_EVENTS.failed,
      "Tenant server deletion failed",
      {
        error: message,
        tenantId: payload.tenantId,
      },
    );
    await markJobFailed(job.id, message);
    throw error;
  }
}

async function getTenantServerDeletionSnapshot(tenantId: string) {
  const db = getDb();
  const [tenant] = await db
    .select({
      organizationId: organizations.id,
      organizationSlug: organizations.slug,
      tenantId: tenants.id,
    })
    .from(tenants)
    .innerJoin(organizations, eq(tenants.organizationId, organizations.id))
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    return {
      tenant: null,
      tenantServers: [],
    };
  }

  return {
    tenant,
    tenantServers: await db
      .select({
        provider: tenantServers.provider,
        providerServerId: tenantServers.providerServerId,
        tenantId: tenantServers.tenantId,
      })
      .from(tenantServers)
      .where(eq(tenantServers.tenantId, tenantId)),
  };
}

async function deleteProviderServers(input: {
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
      DELETE_TENANT_SERVER_EVENTS.deletingHetznerServer,
      "Deleting the Hetzner tenant server",
      {
        providerServerId: target.providerServerId,
        tenantId: target.tenantId,
      },
    );

    try {
      await hetznerClient.deleteServer(target.providerServerId);
      await appendJobEvent(
        input.jobId,
        DELETE_TENANT_SERVER_EVENTS.deletedHetznerServer,
        "Deleted the Hetzner tenant server",
        {
          providerServerId: target.providerServerId,
          tenantId: target.tenantId,
        },
      );
    } catch (error) {
      if (isHetznerNotFoundError(error)) {
        await appendJobEvent(
          input.jobId,
          DELETE_TENANT_SERVER_EVENTS.skippedMissingProviderServer,
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

function parseDeleteTenantServerPayload(
  payload: Record<string, unknown>,
): DeleteTenantServerPayload {
  const tenantId = payload.tenantId;

  if (typeof tenantId !== "string" || tenantId.length === 0) {
    throw new Error("Delete tenant server job payload is missing tenantId");
  }

  return {
    tenantId,
  };
}

function dedupeHetznerTargets(
  servers: Array<{
    provider: string;
    providerServerId: string | null;
    tenantId: string;
  }>,
) {
  const seen = new Set<string>();
  const targets: Array<{
    providerServerId: string;
    tenantId: string;
  }> = [];

  for (const server of servers) {
    if (server.provider !== "hetzner" || !server.providerServerId) {
      continue;
    }

    if (seen.has(server.providerServerId)) {
      continue;
    }

    seen.add(server.providerServerId);
    targets.push({
      providerServerId: server.providerServerId,
      tenantId: server.tenantId,
    });
  }

  return targets;
}

function isHetznerNotFoundError(error: unknown) {
  return (
    error instanceof HetznerApiError &&
    (error.responseStatus === 404 || error.code === "not_found")
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}
