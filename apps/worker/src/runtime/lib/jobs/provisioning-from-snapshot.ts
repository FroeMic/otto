import { eq } from "drizzle-orm";

import { getDb } from "../../db/client";
import {
  ensureTenantRuntimeGatewayToken,
  ensureTenantRuntimeTenantToken,
  getLatestTenantDesiredState,
  getLatestTenantManagedConfig,
  getManagedConfigVersionFromConfigJson,
  getManagedSkillVersionMapFromConfigJson,
  getTenantManagedConfigByVersion,
  getTenantSlackBotToken,
} from "../../db/control-plane";
import {
  listLatestTenantManagedSkillVersionMapForTenant,
  listProjectedManagedSkillFilesForTenant,
} from "../../db/managed-skills";
import {
  getProviderAccountByTenantAndKey,
  getTenantOpenAiApiKey,
  PROVIDER_CREDENTIAL_TYPES,
  persistProvisionedProviderCredential,
} from "../../db/provider-accounts";
import { organizations, tenantServers, tenants } from "../../db/schema";
import { getEnv } from "../env";
import { HetznerClient } from "../hetzner/client";
import { FakeHetznerClient } from "../hetzner/fake";
import { buildOpenClawTenantConfig } from "../openclaw/config";
import { OpenAiProvisioner } from "../providers/openai/provisioning";
import { RuntimeManager } from "../runtime/manager";
import { SshClient } from "../ssh/client";

import {
  appendJobEvent,
  markJobFailed,
  markJobSucceeded,
  requeueJob,
} from "./queue";
import {
  type ClaimedJob,
  JOB_TYPES,
  SNAPSHOT_PROVISIONING_STEPS,
  type SnapshotProvisioningStep,
  type ProvisionTenantServerFromSnapshotPayload,
} from "./types";

const fakeHetznerClient = new FakeHetznerClient();
const openAiProvisioner = new OpenAiProvisioner();
const runtimeManager = new RuntimeManager();
const sshClient = new SshClient();
const STEP_DELAY_MS = 10_000;

export const SNAPSHOT_PROVISIONING_STATUSES = {
  bootstrappingRuntime: "bootstrapping_runtime",
  creatingServer: "creating_server",
  fetchingServerIp: "fetching_server_ip",
  startingRuntime: "starting_runtime",
  verifyingRuntime: "verifying_runtime",
  verifyingSnapshotHost: "verifying_snapshot_host",
  waitingForServerAction: "waiting_for_server_action",
  waitingForSsh: "waiting_for_ssh",
} as const;

type SnapshotProvisioningCreatedServer = {
  actionId: string | null;
  id: string;
  provider: string;
  sourceImage: string | null;
  sourceSnapshotId: string | null;
};

export type SnapshotProvisioningDeps = {
  appendJobEvent: typeof appendJobEvent;
  bootstrapTenantRuntime: (tenantId: string, ipv4: string) => Promise<void>;
  checkRuntime: (ipv4: string) => Promise<void>;
  createProviderServerFromSnapshot: (
    tenantId: string,
  ) => Promise<SnapshotProvisioningCreatedServer>;
  fetchServer: (
    providerServerId: string,
  ) => Promise<{
    ipv4: string | null;
  }>;
  markJobFailed: typeof markJobFailed;
  markJobSucceeded: typeof markJobSucceeded;
  markServerReady: (
    tenantId: string,
    input: {
      ipv4: string;
      providerServerId: string;
    },
  ) => Promise<void>;
  markTenantProvisioningFailed: (tenantId: string) => Promise<void>;
  requeueJob: typeof requeueJob;
  startRuntime: (ipv4: string) => Promise<void>;
  updateTenantServer: (
    tenantId: string,
    input: {
      ipv4?: string | null;
      provider?: string;
      providerServerId?: string;
      provisioningStrategy?: string | null;
      snapshotGeneration?: string | null;
      sourceImage?: string | null;
      sourceSnapshotId?: string | null;
      sshUsername?: string;
      status: string;
    },
  ) => Promise<void>;
  verifySnapshotHostReady: (ipv4: string) => Promise<void>;
  waitForServerAction: (
    providerServerId: string,
    actionId: string,
  ) => Promise<void>;
  waitForSsh: (ipv4: string) => Promise<void>;
};

const defaultDeps: SnapshotProvisioningDeps = {
  appendJobEvent,
  bootstrapTenantRuntime: bootstrapTenantRuntimeOnHost,
  checkRuntime: verifyRuntimeOnHost,
  createProviderServerFromSnapshot,
  fetchServer: async (providerServerId) => {
    const server = await getProvisioningClient().getServer(providerServerId);

    return {
      ipv4: server.ipv4,
    };
  },
  markJobFailed,
  markJobSucceeded,
  markServerReady: markTenantServerReady,
  markTenantProvisioningFailed,
  requeueJob,
  startRuntime: startRuntimeOnHost,
  updateTenantServer,
  verifySnapshotHostReady: async (ipv4) => {
    if (getProvisioningProvider() !== "hetzner") {
      return;
    }

    await runtimeManager.verifySnapshotHostReady({
      host: ipv4,
      port: getEnv().RUNTIME_SSH_PORT,
      username: getEnv().RUNTIME_SSH_USERNAME,
    });
  },
  waitForServerAction: async (providerServerId, actionId) => {
    await getProvisioningClient().waitForServerAction(providerServerId, actionId);
  },
  waitForSsh: async (ipv4) => {
    if (getProvisioningProvider() !== "hetzner") {
      return;
    }

    await sshClient.waitUntilReachable({
      host: ipv4,
      port: getEnv().RUNTIME_SSH_PORT,
      username: getEnv().RUNTIME_SSH_USERNAME,
    });
  },
};

export async function processProvisionTenantServerFromSnapshotJob(
  job: ClaimedJob,
  deps: SnapshotProvisioningDeps = defaultDeps,
): Promise<void> {
  if (job.jobType !== JOB_TYPES.provisionTenantServerFromSnapshot) {
    throw new Error(
      `Unsupported job type for snapshot provisioning handler: ${job.jobType}`,
    );
  }

  const payload = parseProvisionPayload(job.payload);
  logStep(job.id, payload.tenantId, payload.step, "starting");

  try {
    switch (payload.step) {
      case SNAPSHOT_PROVISIONING_STEPS.createServerFromSnapshot:
        await createServerFromSnapshot(job.id, payload, deps);
        return;
      case SNAPSHOT_PROVISIONING_STEPS.waitForHetznerAction:
        await waitForHetznerAction(job.id, payload, deps);
        return;
      case SNAPSHOT_PROVISIONING_STEPS.fetchServerIp:
        await fetchServerIp(job.id, payload, deps);
        return;
      case SNAPSHOT_PROVISIONING_STEPS.waitForSsh:
        await waitForSsh(job.id, payload, deps);
        return;
      case SNAPSHOT_PROVISIONING_STEPS.verifySnapshotHost:
        await verifySnapshotHost(job.id, payload, deps);
        return;
      case SNAPSHOT_PROVISIONING_STEPS.bootstrapTenantRuntime:
        await bootstrapTenantRuntime(job.id, payload, deps);
        return;
      case SNAPSHOT_PROVISIONING_STEPS.startRuntime:
        await startRuntime(job.id, payload, deps);
        return;
      case SNAPSHOT_PROVISIONING_STEPS.verifyRuntime:
        await verifyRuntime(job.id, payload, deps);
        return;
      case SNAPSHOT_PROVISIONING_STEPS.markServerReady:
        await markServerReady(job.id, payload, deps);
        return;
      default:
        throw new Error(`Unsupported snapshot provisioning step: ${payload.step}`);
    }
  } catch (error) {
    console.error(
      `[worker] snapshot job ${job.id} tenant ${payload.tenantId} step ${payload.step} failed: ${getErrorMessage(error)}`,
    );
    await deps.markTenantProvisioningFailed(payload.tenantId);
    await deps.appendJobEvent(job.id, "failed", "Snapshot provisioning failed", {
      error: getErrorMessage(error),
      step: payload.step,
    });
    await deps.markJobFailed(job.id, getErrorMessage(error));
    throw error;
  }
}

function parseProvisionPayload(
  payload: Record<string, unknown>,
): ProvisionTenantServerFromSnapshotPayload {
  const tenantId = payload.tenantId;
  const step = payload.step;
  const providerServerId = payload.providerServerId;
  const actionId = payload.actionId;
  const ipv4 = payload.ipv4;
  const sourceSnapshotId = payload.sourceSnapshotId;

  if (typeof tenantId !== "string" || tenantId.length === 0) {
    throw new Error("Snapshot provisioning job payload is missing tenantId");
  }

  return {
    actionId: typeof actionId === "string" ? actionId : undefined,
    ipv4: typeof ipv4 === "string" ? ipv4 : undefined,
    providerServerId:
      typeof providerServerId === "string" ? providerServerId : undefined,
    sourceSnapshotId:
      typeof sourceSnapshotId === "string" ? sourceSnapshotId : undefined,
    step:
      typeof step === "string" && isProvisioningStep(step)
        ? step
        : SNAPSHOT_PROVISIONING_STEPS.createServerFromSnapshot,
    tenantId,
  };
}

function isProvisioningStep(value: string): value is SnapshotProvisioningStep {
  return Object.values(SNAPSHOT_PROVISIONING_STEPS).includes(
    value as (typeof SNAPSHOT_PROVISIONING_STEPS)[keyof typeof SNAPSHOT_PROVISIONING_STEPS],
  );
}

async function createServerFromSnapshot(
  jobId: string,
  payload: ProvisionTenantServerFromSnapshotPayload,
  deps: SnapshotProvisioningDeps,
) {
  const createdServer = await deps.createProviderServerFromSnapshot(payload.tenantId);

  await deps.updateTenantServer(payload.tenantId, {
    provider: createdServer.provider,
    providerServerId: createdServer.id,
    provisioningStrategy: "hetzner_snapshot",
    snapshotGeneration: getEnv().HETZNER_SNAPSHOT_GENERATION ?? null,
    sourceImage: createdServer.sourceImage,
    sourceSnapshotId: createdServer.sourceSnapshotId,
    sshUsername: getEnv().RUNTIME_SSH_USERNAME,
    status: SNAPSHOT_PROVISIONING_STATUSES.creatingServer,
  });

  await deps.appendJobEvent(
    jobId,
    SNAPSHOT_PROVISIONING_STATUSES.creatingServer,
    `Created ${createdServer.provider} server from snapshot`,
    {
      provider: createdServer.provider,
      providerServerId: createdServer.id,
      sourceImage: createdServer.sourceImage,
      sourceSnapshotId: createdServer.sourceSnapshotId,
    },
  );

  await deps.requeueJob(
    jobId,
    {
      ...payload,
      actionId: createdServer.actionId ?? undefined,
      providerServerId: createdServer.id,
      sourceSnapshotId: createdServer.sourceSnapshotId ?? undefined,
      step: SNAPSHOT_PROVISIONING_STEPS.waitForHetznerAction,
    },
    new Date(Date.now() + getProvisioningDelayMs()),
  );
}

async function waitForHetznerAction(
  jobId: string,
  payload: ProvisionTenantServerFromSnapshotPayload,
  deps: SnapshotProvisioningDeps,
) {
  if (!payload.providerServerId || !payload.actionId) {
    throw new Error(
      "Snapshot provisioning job cannot wait for action without server ids",
    );
  }

  await deps.waitForServerAction(payload.providerServerId, payload.actionId);
  await deps.updateTenantServer(payload.tenantId, {
    status: SNAPSHOT_PROVISIONING_STATUSES.waitingForServerAction,
  });
  await deps.appendJobEvent(
    jobId,
    SNAPSHOT_PROVISIONING_STATUSES.waitingForServerAction,
    `${getProvisioningProvider()} snapshot server action completed`,
    {
      actionId: payload.actionId,
      providerServerId: payload.providerServerId,
      sourceSnapshotId: payload.sourceSnapshotId ?? null,
    },
  );
  await deps.requeueJob(
    jobId,
    {
      ...payload,
      step: SNAPSHOT_PROVISIONING_STEPS.fetchServerIp,
    },
    new Date(Date.now() + getProvisioningDelayMs()),
  );
}

async function fetchServerIp(
  jobId: string,
  payload: ProvisionTenantServerFromSnapshotPayload,
  deps: SnapshotProvisioningDeps,
) {
  if (!payload.providerServerId) {
    throw new Error(
      "Snapshot provisioning job cannot fetch server IP without a server id",
    );
  }

  const server = await deps.fetchServer(payload.providerServerId);

  await deps.updateTenantServer(payload.tenantId, {
    ipv4: server.ipv4,
    status: SNAPSHOT_PROVISIONING_STATUSES.fetchingServerIp,
  });
  await deps.appendJobEvent(
    jobId,
    SNAPSHOT_PROVISIONING_STATUSES.fetchingServerIp,
    `Fetched ${getProvisioningProvider()} snapshot server IP`,
    {
      ipv4: server.ipv4,
      providerServerId: payload.providerServerId,
      sourceSnapshotId: payload.sourceSnapshotId ?? null,
    },
  );
  await deps.requeueJob(
    jobId,
    {
      ...payload,
      ipv4: server.ipv4 ?? undefined,
      step: SNAPSHOT_PROVISIONING_STEPS.waitForSsh,
    },
    new Date(Date.now() + getProvisioningDelayMs()),
  );
}

async function waitForSsh(
  jobId: string,
  payload: ProvisionTenantServerFromSnapshotPayload,
  deps: SnapshotProvisioningDeps,
) {
  if (!payload.ipv4) {
    throw new Error(
      "Snapshot provisioning job cannot wait for SSH without an IPv4 address",
    );
  }

  await deps.updateTenantServer(payload.tenantId, {
    status: SNAPSHOT_PROVISIONING_STATUSES.waitingForSsh,
  });
  await deps.appendJobEvent(
    jobId,
    SNAPSHOT_PROVISIONING_STATUSES.waitingForSsh,
    "Waiting for SSH banner on Hetzner snapshot server",
    {
      ipv4: payload.ipv4,
      providerServerId: payload.providerServerId ?? null,
      sourceSnapshotId: payload.sourceSnapshotId ?? null,
    },
  );
  await deps.waitForSsh(payload.ipv4);
  await deps.appendJobEvent(
    jobId,
    SNAPSHOT_PROVISIONING_STATUSES.waitingForSsh,
    `${getProvisioningProvider()} snapshot server is reachable over SSH`,
    {
      ipv4: payload.ipv4,
      providerServerId: payload.providerServerId ?? null,
    },
  );
  await deps.requeueJob(
    jobId,
    {
      ...payload,
      step: SNAPSHOT_PROVISIONING_STEPS.verifySnapshotHost,
    },
    new Date(Date.now() + getProvisioningDelayMs()),
  );
}

async function verifySnapshotHost(
  jobId: string,
  payload: ProvisionTenantServerFromSnapshotPayload,
  deps: SnapshotProvisioningDeps,
) {
  if (!payload.ipv4 || !payload.providerServerId) {
    throw new Error(
      "Snapshot provisioning job cannot verify snapshot host without server metadata",
    );
  }

  await deps.updateTenantServer(payload.tenantId, {
    status: SNAPSHOT_PROVISIONING_STATUSES.verifyingSnapshotHost,
  });
  await deps.appendJobEvent(
    jobId,
    SNAPSHOT_PROVISIONING_STATUSES.verifyingSnapshotHost,
    "Checking baked snapshot host contract",
    {
      ipv4: payload.ipv4,
      providerServerId: payload.providerServerId,
      sourceSnapshotId: payload.sourceSnapshotId ?? null,
    },
  );
  await deps.verifySnapshotHostReady(payload.ipv4);
  await deps.appendJobEvent(
    jobId,
    SNAPSHOT_PROVISIONING_STATUSES.verifyingSnapshotHost,
    "Tenant snapshot host contract verified",
    {
      ipv4: payload.ipv4,
      providerServerId: payload.providerServerId,
      sourceSnapshotId: payload.sourceSnapshotId ?? null,
    },
  );
  await deps.requeueJob(
    jobId,
    {
      ...payload,
      step: SNAPSHOT_PROVISIONING_STEPS.bootstrapTenantRuntime,
    },
    new Date(Date.now() + getProvisioningDelayMs()),
  );
}

async function bootstrapTenantRuntime(
  jobId: string,
  payload: ProvisionTenantServerFromSnapshotPayload,
  deps: SnapshotProvisioningDeps,
) {
  if (!payload.ipv4 || !payload.providerServerId) {
    throw new Error(
      "Snapshot provisioning job cannot bootstrap runtime without server metadata",
    );
  }

  await deps.updateTenantServer(payload.tenantId, {
    status: SNAPSHOT_PROVISIONING_STATUSES.bootstrappingRuntime,
  });
  await deps.appendJobEvent(
    jobId,
    SNAPSHOT_PROVISIONING_STATUSES.bootstrappingRuntime,
    "Applying tenant-specific runtime files over SSH",
    {
      ipv4: payload.ipv4,
      providerServerId: payload.providerServerId,
      sourceSnapshotId: payload.sourceSnapshotId ?? null,
    },
  );
  await deps.bootstrapTenantRuntime(payload.tenantId, payload.ipv4);
  await deps.appendJobEvent(
    jobId,
    SNAPSHOT_PROVISIONING_STATUSES.bootstrappingRuntime,
    `${getProvisioningProvider()} snapshot runtime bootstrap completed`,
    {
      ipv4: payload.ipv4,
      providerServerId: payload.providerServerId,
    },
  );
  await deps.requeueJob(
    jobId,
    {
      ...payload,
      step: SNAPSHOT_PROVISIONING_STEPS.startRuntime,
    },
    new Date(Date.now() + getProvisioningDelayMs()),
  );
}

async function startRuntime(
  jobId: string,
  payload: ProvisionTenantServerFromSnapshotPayload,
  deps: SnapshotProvisioningDeps,
) {
  if (!payload.ipv4 || !payload.providerServerId) {
    throw new Error(
      "Snapshot provisioning job cannot start runtime without server metadata",
    );
  }

  await deps.updateTenantServer(payload.tenantId, {
    status: SNAPSHOT_PROVISIONING_STATUSES.startingRuntime,
  });
  await deps.appendJobEvent(
    jobId,
    SNAPSHOT_PROVISIONING_STATUSES.startingRuntime,
    "Starting OpenClaw container on snapshot-backed tenant server",
    {
      ipv4: payload.ipv4,
      providerServerId: payload.providerServerId,
    },
  );
  await deps.startRuntime(payload.ipv4);
  await deps.requeueJob(
    jobId,
    {
      ...payload,
      step: SNAPSHOT_PROVISIONING_STEPS.verifyRuntime,
    },
    new Date(Date.now() + getProvisioningDelayMs()),
  );
}

async function verifyRuntime(
  jobId: string,
  payload: ProvisionTenantServerFromSnapshotPayload,
  deps: SnapshotProvisioningDeps,
) {
  if (!payload.ipv4 || !payload.providerServerId) {
    throw new Error(
      "Snapshot provisioning job cannot verify runtime without server metadata",
    );
  }

  await deps.updateTenantServer(payload.tenantId, {
    status: SNAPSHOT_PROVISIONING_STATUSES.verifyingRuntime,
  });
  await deps.appendJobEvent(
    jobId,
    SNAPSHOT_PROVISIONING_STATUSES.verifyingRuntime,
    "Checking OpenClaw gateway health on snapshot-backed tenant server",
    {
      ipv4: payload.ipv4,
      providerServerId: payload.providerServerId,
    },
  );
  await deps.checkRuntime(payload.ipv4);
  await deps.appendJobEvent(
    jobId,
    SNAPSHOT_PROVISIONING_STATUSES.verifyingRuntime,
    "OpenClaw runtime health check passed",
    {
      ipv4: payload.ipv4,
      providerServerId: payload.providerServerId,
    },
  );
  await deps.requeueJob(
    jobId,
    {
      ...payload,
      step: SNAPSHOT_PROVISIONING_STEPS.markServerReady,
    },
    new Date(Date.now() + getProvisioningDelayMs()),
  );
}

async function markServerReady(
  jobId: string,
  payload: ProvisionTenantServerFromSnapshotPayload,
  deps: SnapshotProvisioningDeps,
) {
  if (!payload.providerServerId || !payload.ipv4) {
    throw new Error(
      "Snapshot provisioning job cannot complete without server metadata",
    );
  }

  await deps.markServerReady(payload.tenantId, {
    ipv4: payload.ipv4,
    providerServerId: payload.providerServerId,
  });
  await deps.appendJobEvent(jobId, "ready", "Tenant server marked ready", {
    ipv4: payload.ipv4,
    providerServerId: payload.providerServerId,
    sourceSnapshotId: payload.sourceSnapshotId ?? null,
  });
  await deps.markJobSucceeded(jobId, {
    ipv4: payload.ipv4,
    provider: getProvisioningProvider(),
    providerServerId: payload.providerServerId,
    provisioningStrategy: "hetzner_snapshot",
    sourceSnapshotId: payload.sourceSnapshotId ?? null,
  });
}

async function createProviderServerFromSnapshot(
  tenantId: string,
): Promise<SnapshotProvisioningCreatedServer> {
  if (getProvisioningProvider() !== "hetzner") {
    const server = await fakeHetznerClient.createServer({ tenantId });

    return {
      actionId: server.actionId,
      id: server.id,
      provider: "fake",
      sourceImage: "fake-snapshot",
      sourceSnapshotId: "fake-snapshot",
    };
  }

  const env = getEnv();
  const snapshotImage = env.HETZNER_DEFAULT_SNAPSHOT_IMAGE;

  if (!snapshotImage) {
    throw new Error(
      "HETZNER_DEFAULT_SNAPSHOT_IMAGE is required for snapshot provisioning",
    );
  }

  const sshKeys = env.HETZNER_SSH_KEY_NAMES.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const server = await getHetznerClient().createServerFromSnapshot({
    image: snapshotImage,
    labels: {
      "otto/managed": "true",
      "otto/runtime": "openclaw",
      "otto/tenant_id": tenantId,
    },
    location: env.HETZNER_DEFAULT_LOCATION,
    name: buildHetznerServerName(tenantId),
    serverType: env.HETZNER_DEFAULT_SERVER_TYPE,
    sshKeys,
  });

  return {
    actionId: server.actionId,
    id: server.id,
    provider: "hetzner",
    sourceImage: snapshotImage,
    sourceSnapshotId: snapshotImage,
  };
}

async function bootstrapTenantRuntimeOnHost(tenantId: string, ipv4: string) {
  if (getProvisioningProvider() !== "hetzner") {
    return;
  }

  const openAiCredential = await ensureTenantOpenAiCredential(tenantId);

  if (openAiCredential.created) {
    // Event emission stays in the outer handler to keep this helper narrower.
  }

  const desiredState = await getLatestTenantDesiredState(tenantId);
  const gatewayToken = await ensureTenantRuntimeGatewayToken(tenantId);
  const tenantToken = await ensureTenantRuntimeTenantToken(tenantId);
  const slackBotToken = await getTenantSlackBotToken(tenantId);
  const managedConfigVersion = getManagedConfigVersionFromConfigJson(
    desiredState.configJson,
  );
  const managedConfig = managedConfigVersion
    ? await getTenantManagedConfigByVersion({
        tenantId,
        version: managedConfigVersion,
      })
    : await getLatestTenantManagedConfig(tenantId);
  const managedSkillVersionMap =
    getManagedSkillVersionMapFromConfigJson(desiredState.configJson) ??
    (await listLatestTenantManagedSkillVersionMapForTenant({
      tenantId,
    }));
  const managedSkillFiles = await listProjectedManagedSkillFilesForTenant({
    tenantId,
    versionMap: managedSkillVersionMap,
  });

  await runtimeManager.bootstrapTenantRuntime(
    {
      host: ipv4,
      port: getEnv().RUNTIME_SSH_PORT,
      username: getEnv().RUNTIME_SSH_USERNAME,
    },
    {
      desiredStateVersion: desiredState.version,
      gatewayToken,
      tenantToken,
      managedBootstrapFiles: managedConfig.files.map((file) => ({
        contents: file.renderedContent,
        filename: file.path,
      })),
      managedSkillFiles: managedSkillFiles.map((file) => ({
        contents: file.contents,
        filename: file.relativePath,
        projectionMode: file.projectionMode,
      })),
      openClawConfig: buildOpenClawTenantConfig({
        configJson: desiredState.configJson,
        slackBotToken,
        tenantId,
      }),
      slackBotToken,
      tenantId,
    },
  );
}

async function startRuntimeOnHost(ipv4: string) {
  if (getProvisioningProvider() !== "hetzner") {
    return;
  }

  await runtimeManager.restartGateway({
    host: ipv4,
    port: getEnv().RUNTIME_SSH_PORT,
    username: getEnv().RUNTIME_SSH_USERNAME,
  });
}

async function verifyRuntimeOnHost(ipv4: string) {
  if (getProvisioningProvider() !== "hetzner") {
    return;
  }

  await runtimeManager.checkGatewayHealth({
    host: ipv4,
    port: getEnv().RUNTIME_SSH_PORT,
    username: getEnv().RUNTIME_SSH_USERNAME,
  });
}

async function ensureTenantOpenAiCredential(tenantId: string): Promise<{
  apiKeyId: string | null;
  created: boolean;
  projectId: string | null;
  serviceAccountId: string | null;
}> {
  const existingKey = await getTenantOpenAiApiKey(tenantId);

  if (existingKey) {
    return {
      apiKeyId: null,
      created: false,
      projectId: null,
      serviceAccountId: null,
    };
  }

  const [tenant] = await getDb()
    .select({
      id: tenants.id,
      name: tenants.name,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    throw new Error(`Snapshot provisioning could not find tenant ${tenantId}`);
  }

  const existingAccount = await getProviderAccountByTenantAndKey(
    tenant.id,
    "openai",
  );
  const provisionedCredential = await openAiProvisioner.createTenantCredential({
    existingProjectId: existingAccount?.externalProjectId ?? null,
    tenantId: tenant.id,
    tenantName: tenant.name,
    verify: true,
  });

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

  return {
    apiKeyId: provisionedCredential.apiKeyId,
    created: true,
    projectId: provisionedCredential.projectId,
    serviceAccountId: provisionedCredential.serviceAccountId,
  };
}

async function updateTenantServer(
  tenantId: string,
  input: {
    ipv4?: string | null;
    provider?: string;
    providerServerId?: string;
    provisioningStrategy?: string | null;
    snapshotGeneration?: string | null;
    sourceImage?: string | null;
    sourceSnapshotId?: string | null;
    sshUsername?: string;
    status: string;
  },
) {
  await getDb()
    .update(tenantServers)
    .set({
      ...(input.ipv4 !== undefined ? { ipv4: input.ipv4 } : {}),
      ...(input.provider ? { provider: input.provider } : {}),
      ...(input.providerServerId
        ? { providerServerId: input.providerServerId }
        : {}),
      ...(input.provisioningStrategy !== undefined
        ? { provisioningStrategy: input.provisioningStrategy }
        : {}),
      ...(input.snapshotGeneration !== undefined
        ? { snapshotGeneration: input.snapshotGeneration }
        : {}),
      ...(input.sourceImage !== undefined ? { sourceImage: input.sourceImage } : {}),
      ...(input.sourceSnapshotId !== undefined
        ? { sourceSnapshotId: input.sourceSnapshotId }
        : {}),
      ...(input.sshUsername ? { sshUsername: input.sshUsername } : {}),
      status: input.status,
      updatedAt: new Date(),
    })
    .where(eq(tenantServers.tenantId, tenantId));
}

async function markTenantProvisioningFailed(tenantId: string) {
  await getDb().transaction(async (tx) => {
    await tx
      .update(tenantServers)
      .set({
        status: "failed",
        updatedAt: new Date(),
      })
      .where(eq(tenantServers.tenantId, tenantId));

    await tx
      .update(tenants)
      .set({
        status: "failed",
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));
  });
}

async function markTenantServerReady(
  tenantId: string,
  input: {
    ipv4: string;
    providerServerId: string;
  },
) {
  await getDb().transaction(async (tx) => {
    const [tenant] = await tx
      .select({
        organizationId: tenants.organizationId,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      throw new Error("Tenant not found while marking snapshot server ready");
    }

    await tx
      .update(tenantServers)
      .set({
        ipv4: input.ipv4,
        provider: getProvisioningProvider(),
        providerServerId: input.providerServerId,
        status: "ready",
        updatedAt: new Date(),
      })
      .where(eq(tenantServers.tenantId, tenantId));

    await tx
      .update(tenants)
      .set({
        status: "ready",
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));

    await tx
      .update(organizations)
      .set({
        isReady: true,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, tenant.organizationId));
  });
}

function buildHetznerServerName(tenantId: string) {
  return `otto-${tenantId.slice(0, 12)}`;
}

function getProvisioningDelayMs() {
  return getProvisioningProvider() === "hetzner" ? 0 : STEP_DELAY_MS;
}

function getProvisioningProvider() {
  return getEnv().HETZNER_API_TOKEN ? "hetzner" : "fake";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown snapshot provisioning error";
}

function logStep(
  jobId: string,
  tenantId: string,
  step: SnapshotProvisioningStep | undefined,
  message: string,
) {
  console.info(
    `[worker] snapshot job ${jobId} tenant ${tenantId} step ${step ?? "unknown"}: ${message}`,
  );
}

let cachedHetznerClient: HetznerClient | null = null;

function getHetznerClient() {
  if (!cachedHetznerClient) {
    cachedHetznerClient = new HetznerClient();
  }

  return cachedHetznerClient;
}

function getProvisioningClient() {
  return getProvisioningProvider() === "hetzner"
    ? getHetznerClient()
    : fakeHetznerClient;
}
