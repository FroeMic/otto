import { randomBytes } from "node:crypto";
import { desc, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { tenantDesiredStates, tenantServers, tenants } from "@/db/schema";
import { getEnv } from "@/lib/env";
import { HetznerClient } from "@/lib/hetzner/client";
import { renderCloudInit } from "@/lib/hetzner/cloud-init";
import { FakeHetznerClient } from "@/lib/hetzner/fake";
import type { OpenClawTenantConfig } from "@/lib/openclaw/config";
import { RuntimeManager } from "@/lib/runtime/manager";
import { SshClient } from "@/lib/ssh/client";

import {
  appendJobEvent,
  markJobFailed,
  markJobSucceeded,
  requeueJob,
} from "./queue";
import {
  type ClaimedJob,
  JOB_TYPES,
  PROVISIONING_STEPS,
  type ProvisioningStep,
  type ProvisionTenantServerPayload,
} from "./types";

const fakeHetznerClient = new FakeHetznerClient();
const runtimeManager = new RuntimeManager();
const sshClient = new SshClient();
const STEP_DELAY_MS = 10_000;

export async function processProvisionTenantServerJob(
  job: ClaimedJob,
): Promise<void> {
  if (job.jobType !== JOB_TYPES.provisionTenantServer) {
    throw new Error(
      `Unsupported job type for provisioning handler: ${job.jobType}`,
    );
  }

  const payload = parseProvisionPayload(job.payload);
  logStep(job.id, payload.tenantId, payload.step, "starting");

  try {
    switch (payload.step) {
      case PROVISIONING_STEPS.createServer:
        await createServer(job.id, payload);
        return;
      case PROVISIONING_STEPS.waitForHetznerAction:
        await waitForServerAction(job.id, payload);
        return;
      case PROVISIONING_STEPS.fetchServerIp:
        await fetchServerIp(job.id, payload);
        return;
      case PROVISIONING_STEPS.waitForSsh:
        await waitForSsh(job.id, payload);
        return;
      case PROVISIONING_STEPS.bootstrapRuntime:
        await bootstrapRuntime(job.id, payload);
        return;
      case PROVISIONING_STEPS.startRuntime:
        await startRuntime(job.id, payload);
        return;
      case PROVISIONING_STEPS.verifyRuntime:
        await verifyRuntime(job.id, payload);
        return;
      case PROVISIONING_STEPS.markServerReady:
        await markServerReady(job.id, payload);
        return;
      default:
        throw new Error(`Unsupported provisioning step: ${payload.step}`);
    }
  } catch (error) {
    console.error(
      `[worker] job ${job.id} tenant ${payload.tenantId} step ${payload.step} failed: ${getErrorMessage(error)}`,
    );
    await markTenantProvisioningFailed(payload.tenantId);
    await appendJobEvent(job.id, "failed", "Provisioning failed", {
      error: getErrorMessage(error),
      step: payload.step,
    });
    await markJobFailed(job.id, getErrorMessage(error));
    throw error;
  }
}

function parseProvisionPayload(
  payload: Record<string, unknown>,
): ProvisionTenantServerPayload {
  const tenantId = payload.tenantId;
  const step = payload.step;
  const providerServerId = payload.providerServerId;
  const actionId = payload.actionId;
  const ipv4 = payload.ipv4;

  if (typeof tenantId !== "string" || tenantId.length === 0) {
    throw new Error("Provisioning job payload is missing tenantId");
  }

  return {
    tenantId,
    step:
      typeof step === "string" && isProvisioningStep(step)
        ? step
        : PROVISIONING_STEPS.createServer,
    providerServerId:
      typeof providerServerId === "string" ? providerServerId : undefined,
    actionId: typeof actionId === "string" ? actionId : undefined,
    ipv4: typeof ipv4 === "string" ? ipv4 : undefined,
  };
}

function isProvisioningStep(value: string): value is ProvisioningStep {
  return Object.values(PROVISIONING_STEPS).includes(
    value as (typeof PROVISIONING_STEPS)[keyof typeof PROVISIONING_STEPS],
  );
}

async function createServer(
  jobId: string,
  payload: ProvisionTenantServerPayload,
) {
  logStep(
    jobId,
    payload.tenantId,
    PROVISIONING_STEPS.createServer,
    `creating ${getProvisioningProvider()} server`,
  );
  const createdServer = await createProviderServer(payload.tenantId);
  const provider = getProvisioningProvider();

  await updateTenantServer(payload.tenantId, {
    provider,
    providerServerId: createdServer.id,
    sshUsername: getEnv().RUNTIME_SSH_USERNAME,
    status: "creating_server",
  });

  await appendJobEvent(jobId, "creating_server", `Created ${provider} server`, {
    provider,
    providerServerId: createdServer.id,
  });

  logRequeue(
    jobId,
    payload.tenantId,
    PROVISIONING_STEPS.waitForHetznerAction,
    createdServer.id,
  );
  await requeueJob(
    jobId,
    {
      ...payload,
      actionId: createdServer.actionId,
      providerServerId: createdServer.id,
      step: PROVISIONING_STEPS.waitForHetznerAction,
    },
    new Date(Date.now() + getProvisioningDelayMs()),
  );
}

async function waitForServerAction(
  jobId: string,
  payload: ProvisionTenantServerPayload,
) {
  if (!payload.providerServerId || !payload.actionId) {
    throw new Error(
      "Provisioning job cannot wait for action without server ids",
    );
  }

  logStep(
    jobId,
    payload.tenantId,
    PROVISIONING_STEPS.waitForHetznerAction,
    `waiting for action ${payload.actionId}`,
  );
  await getProvisioningClient().waitForServerAction(
    payload.providerServerId,
    payload.actionId,
  );

  await updateTenantServer(payload.tenantId, {
    status: "waiting_for_server_action",
  });

  await appendJobEvent(
    jobId,
    "waiting_for_server_action",
    `${getProvisioningProvider()} server action completed`,
    {
      actionId: payload.actionId,
      provider: getProvisioningProvider(),
      providerServerId: payload.providerServerId,
    },
  );

  logRequeue(
    jobId,
    payload.tenantId,
    PROVISIONING_STEPS.fetchServerIp,
    payload.providerServerId,
  );
  await requeueJob(
    jobId,
    {
      ...payload,
      step: PROVISIONING_STEPS.fetchServerIp,
    },
    new Date(Date.now() + getProvisioningDelayMs()),
  );
}

async function fetchServerIp(
  jobId: string,
  payload: ProvisionTenantServerPayload,
) {
  if (!payload.providerServerId) {
    throw new Error(
      "Provisioning job cannot fetch server IP without a server id",
    );
  }

  logStep(
    jobId,
    payload.tenantId,
    PROVISIONING_STEPS.fetchServerIp,
    `fetching IP for ${payload.providerServerId}`,
  );
  const server = await getProvisioningClient().getServer(
    payload.providerServerId,
  );

  await updateTenantServer(payload.tenantId, {
    ipv4: server.ipv4,
    status: "fetching_server_ip",
  });

  await appendJobEvent(
    jobId,
    "fetching_server_ip",
    `Fetched ${getProvisioningProvider()} server IP`,
    {
      ipv4: server.ipv4,
      provider: getProvisioningProvider(),
      providerServerId: payload.providerServerId,
    },
  );

  console.info(
    `[worker] job ${jobId} tenant ${payload.tenantId} got ${getProvisioningProvider()} IP ${server.ipv4}`,
  );
  logRequeue(
    jobId,
    payload.tenantId,
    PROVISIONING_STEPS.waitForSsh,
    payload.providerServerId,
  );
  await requeueJob(
    jobId,
    {
      ...payload,
      ipv4: server.ipv4,
      step: PROVISIONING_STEPS.waitForSsh,
    },
    new Date(Date.now() + getProvisioningDelayMs()),
  );
}

async function waitForSsh(
  jobId: string,
  payload: ProvisionTenantServerPayload,
) {
  if (!payload.ipv4) {
    throw new Error(
      "Provisioning job cannot wait for SSH without an IPv4 address",
    );
  }

  logStep(
    jobId,
    payload.tenantId,
    PROVISIONING_STEPS.waitForSsh,
    `waiting for SSH on ${payload.ipv4}`,
  );
  await updateTenantServer(payload.tenantId, {
    status: "waiting_for_ssh",
  });

  if (getProvisioningProvider() === "hetzner") {
    await appendJobEvent(
      jobId,
      "waiting_for_ssh",
      "Waiting for SSH banner on Hetzner server",
      {
        ipv4: payload.ipv4,
        providerServerId: payload.providerServerId,
      },
    );

    await sshClient.waitUntilReachable({
      host: payload.ipv4,
      port: getEnv().RUNTIME_SSH_PORT,
      username: getEnv().RUNTIME_SSH_USERNAME,
    });
  }

  await appendJobEvent(
    jobId,
    "waiting_for_ssh",
    `${getProvisioningProvider()} server is reachable over SSH`,
    {
      ipv4: payload.ipv4,
    },
  );

  logRequeue(
    jobId,
    payload.tenantId,
    PROVISIONING_STEPS.bootstrapRuntime,
    payload.providerServerId,
  );
  await requeueJob(
    jobId,
    {
      ...payload,
      step: PROVISIONING_STEPS.bootstrapRuntime,
    },
    new Date(Date.now() + getProvisioningDelayMs()),
  );
}

async function bootstrapRuntime(
  jobId: string,
  payload: ProvisionTenantServerPayload,
) {
  if (!payload.ipv4 || !payload.providerServerId) {
    throw new Error(
      "Provisioning job cannot bootstrap runtime without server metadata",
    );
  }

  logStep(
    jobId,
    payload.tenantId,
    PROVISIONING_STEPS.bootstrapRuntime,
    `bootstrapping runtime on ${payload.ipv4}`,
  );
  await updateTenantServer(payload.tenantId, {
    status: "bootstrapping_runtime",
  });

  if (getProvisioningProvider() === "hetzner") {
    await appendJobEvent(
      jobId,
      "bootstrapping_runtime",
      "Applying initial runtime files over SSH",
      {
        ipv4: payload.ipv4,
        providerServerId: payload.providerServerId,
      },
    );

    const desiredState = await getLatestDesiredState(payload.tenantId);

    await runtimeManager.bootstrapTenantRuntime(
      {
        host: payload.ipv4,
        port: getEnv().RUNTIME_SSH_PORT,
        username: getEnv().RUNTIME_SSH_USERNAME,
      },
      {
        desiredStateVersion: desiredState.version,
        gatewayToken: buildGatewayToken(),
        openClawConfig: buildOpenClawTenantConfig(
          payload.tenantId,
          desiredState.configJson,
        ),
        tenantId: payload.tenantId,
      },
    );
  }

  await appendJobEvent(
    jobId,
    "bootstrapping_runtime",
    `${getProvisioningProvider()} runtime bootstrap completed`,
    {
      ipv4: payload.ipv4,
      providerServerId: payload.providerServerId,
    },
  );

  logRequeue(
    jobId,
    payload.tenantId,
    PROVISIONING_STEPS.startRuntime,
    payload.providerServerId,
  );
  await requeueJob(
    jobId,
    {
      ...payload,
      step: PROVISIONING_STEPS.startRuntime,
    },
    new Date(Date.now() + getProvisioningDelayMs()),
  );
}

async function startRuntime(
  jobId: string,
  payload: ProvisionTenantServerPayload,
) {
  if (!payload.ipv4 || !payload.providerServerId) {
    throw new Error(
      "Provisioning job cannot start runtime without server metadata",
    );
  }

  logStep(
    jobId,
    payload.tenantId,
    PROVISIONING_STEPS.startRuntime,
    `starting OpenClaw runtime on ${payload.ipv4}`,
  );
  await updateTenantServer(payload.tenantId, {
    status: "starting_runtime",
  });

  if (getProvisioningProvider() === "hetzner") {
    await appendJobEvent(
      jobId,
      "starting_runtime",
      "Starting OpenClaw container on tenant server",
      {
        ipv4: payload.ipv4,
        providerServerId: payload.providerServerId,
        runtimeImage: getEnv().RUNTIME_OPENCLAW_IMAGE,
      },
    );

    await runtimeManager.restartGateway({
      host: payload.ipv4,
      port: getEnv().RUNTIME_SSH_PORT,
      username: getEnv().RUNTIME_SSH_USERNAME,
    });
  }

  logRequeue(
    jobId,
    payload.tenantId,
    PROVISIONING_STEPS.verifyRuntime,
    payload.providerServerId,
  );
  await requeueJob(
    jobId,
    {
      ...payload,
      step: PROVISIONING_STEPS.verifyRuntime,
    },
    new Date(Date.now() + getProvisioningDelayMs()),
  );
}

async function verifyRuntime(
  jobId: string,
  payload: ProvisionTenantServerPayload,
) {
  if (!payload.ipv4 || !payload.providerServerId) {
    throw new Error(
      "Provisioning job cannot verify runtime without server metadata",
    );
  }

  logStep(
    jobId,
    payload.tenantId,
    PROVISIONING_STEPS.verifyRuntime,
    `verifying OpenClaw runtime on ${payload.ipv4}`,
  );
  await updateTenantServer(payload.tenantId, {
    status: "verifying_runtime",
  });

  if (getProvisioningProvider() === "hetzner") {
    await appendJobEvent(
      jobId,
      "verifying_runtime",
      "Checking OpenClaw gateway health",
      {
        ipv4: payload.ipv4,
        providerServerId: payload.providerServerId,
      },
    );

    await runtimeManager.checkGatewayHealth({
      host: payload.ipv4,
      port: getEnv().RUNTIME_SSH_PORT,
      username: getEnv().RUNTIME_SSH_USERNAME,
    });
  }

  await appendJobEvent(
    jobId,
    "verifying_runtime",
    "OpenClaw runtime health check passed",
    {
      ipv4: payload.ipv4,
      providerServerId: payload.providerServerId,
    },
  );

  logRequeue(
    jobId,
    payload.tenantId,
    PROVISIONING_STEPS.markServerReady,
    payload.providerServerId,
  );
  await requeueJob(
    jobId,
    {
      ...payload,
      step: PROVISIONING_STEPS.markServerReady,
    },
    new Date(Date.now() + getProvisioningDelayMs()),
  );
}

async function markServerReady(
  jobId: string,
  payload: ProvisionTenantServerPayload,
) {
  if (!payload.providerServerId || !payload.ipv4) {
    throw new Error("Provisioning job cannot complete without server metadata");
  }

  logStep(
    jobId,
    payload.tenantId,
    PROVISIONING_STEPS.markServerReady,
    `marking ready with IP ${payload.ipv4}`,
  );
  const db = getDb();

  await db.transaction(async (tx) => {
    await tx
      .update(tenantServers)
      .set({
        ipv4: payload.ipv4,
        provider: getProvisioningProvider(),
        providerServerId: payload.providerServerId,
        status: "ready",
        updatedAt: new Date(),
      })
      .where(eq(tenantServers.tenantId, payload.tenantId));

    await tx
      .update(tenants)
      .set({
        status: "ready",
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, payload.tenantId));
  });

  await appendJobEvent(jobId, "ready", "Tenant server marked ready", {
    ipv4: payload.ipv4,
    providerServerId: payload.providerServerId,
  });

  await markJobSucceeded(jobId, {
    ipv4: payload.ipv4,
    provider: getProvisioningProvider(),
    providerServerId: payload.providerServerId,
  });

  console.info(
    `[worker] job ${jobId} tenant ${payload.tenantId} ready on ${getProvisioningProvider()} server ${payload.providerServerId} (${payload.ipv4})`,
  );
}

async function updateTenantServer(
  tenantId: string,
  input: {
    ipv4?: string | null;
    provider?: string;
    providerServerId?: string;
    sshUsername?: string;
    status: string;
  },
) {
  const db = getDb();

  await db
    .update(tenantServers)
    .set({
      ...(input.ipv4 !== undefined ? { ipv4: input.ipv4 } : {}),
      ...(input.provider ? { provider: input.provider } : {}),
      ...(input.providerServerId
        ? { providerServerId: input.providerServerId }
        : {}),
      ...(input.sshUsername ? { sshUsername: input.sshUsername } : {}),
      status: input.status,
      updatedAt: new Date(),
    })
    .where(eq(tenantServers.tenantId, tenantId));
}

async function markTenantProvisioningFailed(tenantId: string) {
  const db = getDb();

  await db.transaction(async (tx) => {
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown provisioning error";
}

async function getLatestDesiredState(tenantId: string) {
  const db = getDb();
  const [desiredState] = await db
    .select({
      configJson: tenantDesiredStates.configJson,
      version: tenantDesiredStates.version,
    })
    .from(tenantDesiredStates)
    .where(eq(tenantDesiredStates.tenantId, tenantId))
    .orderBy(desc(tenantDesiredStates.version))
    .limit(1);

  if (!desiredState) {
    throw new Error(`No desired state found for tenant ${tenantId}`);
  }

  return desiredState;
}

function buildOpenClawTenantConfig(
  tenantId: string,
  configJson: unknown,
): OpenClawTenantConfig {
  const config = parseRecord(configJson);
  const env = getEnv();
  const hasSlackTokens =
    Boolean(env.RUNTIME_SLACK_APP_TOKEN) &&
    Boolean(env.RUNTIME_SLACK_BOT_TOKEN);

  return {
    authTokenEnvVar: "OPENCLAW_GATEWAY_TOKEN",
    gatewayPort: 18789,
    integrations: Array.isArray(config.integrations)
      ? config.integrations.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
    prompts: parseStringRecord(config.prompts),
    ...(hasSlackTokens
      ? {
          slack: {
            enabled: true,
            mode: "socket" as const,
          },
        }
      : {}),
    tenantId,
    workspacePath: "/home/node/.openclaw/workspace",
  };
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function parseStringRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => {
      return typeof entry[1] === "string";
    }),
  );
}

function buildGatewayToken() {
  return randomBytes(24).toString("base64url");
}

function logStep(
  jobId: string,
  tenantId: string,
  step: ProvisioningStep | undefined,
  message: string,
) {
  console.info(
    `[worker] job ${jobId} tenant ${tenantId} step ${step ?? "unknown"}: ${message}`,
  );
}

function logRequeue(
  jobId: string,
  tenantId: string,
  nextStep: ProvisioningStep,
  providerServerId?: string,
) {
  const availableAt = new Date(
    Date.now() + getProvisioningDelayMs(),
  ).toISOString();
  const serverText = providerServerId ? ` server ${providerServerId}` : "";

  console.info(
    `[worker] job ${jobId} tenant ${tenantId}${serverText} requeued for ${nextStep} at ${availableAt}`,
  );
}

async function createProviderServer(tenantId: string) {
  if (getProvisioningProvider() === "hetzner") {
    const env = getEnv();
    const sshKeys = env.HETZNER_SSH_KEY_NAMES.split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    console.info(
      `[worker] tenant ${tenantId} hetzner config: server_type=${env.HETZNER_DEFAULT_SERVER_TYPE} image=${env.HETZNER_DEFAULT_IMAGE} location=${env.HETZNER_DEFAULT_LOCATION} ssh_keys=${sshKeys.join(",") || "none"}`,
    );

    return getHetznerClient().createServer({
      image: env.HETZNER_DEFAULT_IMAGE,
      labels: {
        "otto/managed": "true",
        "otto/runtime": "openclaw",
        "otto/tenant_id": tenantId,
      },
      location: env.HETZNER_DEFAULT_LOCATION,
      name: buildHetznerServerName(tenantId),
      serverType: env.HETZNER_DEFAULT_SERVER_TYPE,
      sshKeys,
      userData: renderCloudInit(),
    });
  }

  return fakeHetznerClient.createServer({ tenantId });
}

function buildHetznerServerName(tenantId: string) {
  return `otto-${tenantId.slice(0, 12)}`;
}

function getProvisioningClient() {
  return getProvisioningProvider() === "hetzner"
    ? getHetznerClient()
    : fakeHetznerClient;
}

function getProvisioningDelayMs() {
  return getProvisioningProvider() === "hetzner" ? 0 : STEP_DELAY_MS;
}

function getProvisioningProvider() {
  return getEnv().HETZNER_API_TOKEN ? "hetzner" : "fake";
}

let cachedHetznerClient: HetznerClient | null = null;

function getHetznerClient() {
  if (!cachedHetznerClient) {
    cachedHetznerClient = new HetznerClient();
  }

  return cachedHetznerClient;
}
