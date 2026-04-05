import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  getProviderAccountByTenantAndKey,
  PROVIDER_CREDENTIAL_TYPES,
  persistProvisionedProviderCredential,
} from "@/db/provider-accounts";
import { tenantServers, tenants } from "@/db/schema";
import { OpenAiProvisioner } from "@/lib/providers/openai/provisioning";

import { appendJobEvent, markJobFailed, markJobSucceeded } from "./queue";
import {
  type ClaimedJob,
  JOB_TYPES,
  type ProvisionTenantOpenAiKeyPayload,
} from "./types";

const openAiProvisioner = new OpenAiProvisioner();

const OPENAI_PROVISION_EVENTS = {
  failed: "provision_openai_key_failed",
  persistingCredential: "persisting_openai_key",
  provisioningCredential: "provisioning_openai_key",
  succeeded: "provision_openai_key_succeeded",
} as const;

export async function processProvisionTenantOpenAiKeyJob(
  job: ClaimedJob,
): Promise<void> {
  if (job.jobType !== JOB_TYPES.provisionTenantOpenAiKey) {
    throw new Error(
      `Unsupported job type for OpenAI key provisioning handler: ${job.jobType}`,
    );
  }

  const payload = parseProvisionTenantOpenAiKeyPayload(job.payload);

  try {
    const tenant = await getTenantProvisioningTarget(payload.tenantId);

    if (!tenant) {
      throw new Error("OpenAI key provisioning tenant not found");
    }

    const existingProviderAccount = await getProviderAccountByTenantAndKey(
      tenant.id,
      "openai",
    );
    const action = existingProviderAccount ? "rotate" : "provision";

    await appendJobEvent(
      job.id,
      OPENAI_PROVISION_EVENTS.provisioningCredential,
      action === "rotate"
        ? "Rotating tenant-specific OpenAI API key"
        : "Provisioning tenant-specific OpenAI API key",
      {
        existingProjectId: existingProviderAccount?.externalProjectId ?? null,
        tenantId: tenant.id,
      },
    );

    const provisionedCredential =
      await openAiProvisioner.createTenantCredential({
        existingProjectId: existingProviderAccount?.externalProjectId ?? null,
        tenantId: tenant.id,
        tenantName: tenant.name,
        verify: true,
      });

    await appendJobEvent(
      job.id,
      OPENAI_PROVISION_EVENTS.persistingCredential,
      "Persisting encrypted OpenAI credential and provider metadata",
      {
        apiKeyId: provisionedCredential.apiKeyId,
        projectId: provisionedCredential.projectId,
        serviceAccountId: provisionedCredential.serviceAccountId,
        tenantId: tenant.id,
      },
    );

    const { providerAccount, providerCredential: storedCredential } =
      await persistProvisionedProviderCredential({
        credentialType: PROVIDER_CREDENTIAL_TYPES.apiKey,
        displayName: provisionedCredential.displayName,
        externalApiKeyId: provisionedCredential.apiKeyId,
        externalProjectId: provisionedCredential.projectId,
        externalServiceAccountId: provisionedCredential.serviceAccountId,
        plaintext: provisionedCredential.apiKey,
        provisionedAt: new Date(),
        providerKey: provisionedCredential.providerKey,
        revokedAt: null,
        status: "active",
        tenantId: tenant.id,
      });

    const result = {
      action,
      apiKeyId: provisionedCredential.apiKeyId,
      credentialId: storedCredential.id,
      note:
        tenant.status === "ready" && tenant.serverStatus === "ready"
          ? "Reapply tenant config to project the new tenant-specific key into the runtime."
          : "The new tenant-specific key is stored and will be projected on the next runtime bootstrap or apply.",
      projectId: provisionedCredential.projectId,
      providerAccountId: providerAccount.id,
      serviceAccountId: provisionedCredential.serviceAccountId,
      tenantId: tenant.id,
    };

    await appendJobEvent(
      job.id,
      OPENAI_PROVISION_EVENTS.succeeded,
      action === "rotate"
        ? "Tenant-specific OpenAI API key rotated successfully"
        : "Tenant-specific OpenAI API key provisioned successfully",
      {
        apiKeyId: provisionedCredential.apiKeyId,
        projectId: provisionedCredential.projectId,
        serviceAccountId: provisionedCredential.serviceAccountId,
        tenantId: tenant.id,
      },
    );
    await markJobSucceeded(job.id, result);
  } catch (error) {
    const message = getErrorMessage(error);

    await appendJobEvent(
      job.id,
      OPENAI_PROVISION_EVENTS.failed,
      "Tenant-specific OpenAI API key provisioning failed",
      {
        error: message,
      },
    );
    await markJobFailed(job.id, message);
    throw error;
  }
}

async function getTenantProvisioningTarget(tenantId: string) {
  const db = getDb();
  const [tenant] = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      serverStatus: tenantServers.status,
      status: tenants.status,
    })
    .from(tenants)
    .leftJoin(tenantServers, eq(tenantServers.tenantId, tenants.id))
    .where(eq(tenants.id, tenantId))
    .limit(1);

  return tenant ?? null;
}

function parseProvisionTenantOpenAiKeyPayload(
  payload: Record<string, unknown>,
): ProvisionTenantOpenAiKeyPayload {
  const tenantId = payload.tenantId;

  if (typeof tenantId !== "string" || tenantId.length === 0) {
    throw new Error("Provision OpenAI key job payload is missing tenantId");
  }

  return {
    tenantId,
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}
