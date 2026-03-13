import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { tenantServers, tenants } from "@/db/schema";
import { FakeHetznerClient } from "@/lib/hetzner/fake";

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
      case PROVISIONING_STEPS.markServerReady:
        await markServerReady(job.id, payload);
        return;
      default:
        throw new Error(`Unsupported provisioning step: ${payload.step}`);
    }
  } catch (error) {
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
  const createdServer = await fakeHetznerClient.createServer({
    tenantId: payload.tenantId,
  });

  await updateTenantServer(payload.tenantId, {
    provider: "fake",
    providerServerId: createdServer.id,
    status: "creating_server",
  });

  await appendJobEvent(jobId, "creating_server", "Created fake server", {
    provider: "fake",
    providerServerId: createdServer.id,
  });

  await requeueJob(
    jobId,
    {
      ...payload,
      actionId: createdServer.actionId,
      providerServerId: createdServer.id,
      step: PROVISIONING_STEPS.waitForHetznerAction,
    },
    new Date(Date.now() + STEP_DELAY_MS),
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

  await fakeHetznerClient.waitForServerAction(
    payload.providerServerId,
    payload.actionId,
  );

  await updateTenantServer(payload.tenantId, {
    status: "waiting_for_server_action",
  });

  await appendJobEvent(
    jobId,
    "waiting_for_server_action",
    "Fake server action completed",
    {
      actionId: payload.actionId,
      providerServerId: payload.providerServerId,
    },
  );

  await requeueJob(
    jobId,
    {
      ...payload,
      step: PROVISIONING_STEPS.fetchServerIp,
    },
    new Date(Date.now() + STEP_DELAY_MS),
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

  const server = await fakeHetznerClient.getServer(payload.providerServerId);

  await updateTenantServer(payload.tenantId, {
    ipv4: server.ipv4,
    status: "fetching_server_ip",
  });

  await appendJobEvent(jobId, "fetching_server_ip", "Fetched fake server IP", {
    ipv4: server.ipv4,
    providerServerId: payload.providerServerId,
  });

  await requeueJob(
    jobId,
    {
      ...payload,
      ipv4: server.ipv4,
      step: PROVISIONING_STEPS.waitForSsh,
    },
    new Date(Date.now() + STEP_DELAY_MS),
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

  await updateTenantServer(payload.tenantId, {
    status: "waiting_for_ssh",
  });

  await appendJobEvent(
    jobId,
    "waiting_for_ssh",
    "Fake server is reachable over SSH",
    {
      ipv4: payload.ipv4,
    },
  );

  await requeueJob(
    jobId,
    {
      ...payload,
      step: PROVISIONING_STEPS.markServerReady,
    },
    new Date(Date.now() + STEP_DELAY_MS),
  );
}

async function markServerReady(
  jobId: string,
  payload: ProvisionTenantServerPayload,
) {
  if (!payload.providerServerId || !payload.ipv4) {
    throw new Error("Provisioning job cannot complete without server metadata");
  }

  const db = getDb();

  await db.transaction(async (tx) => {
    await tx
      .update(tenantServers)
      .set({
        ipv4: payload.ipv4,
        provider: "fake",
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
    provider: "fake",
    providerServerId: payload.providerServerId,
  });
}

async function updateTenantServer(
  tenantId: string,
  input: {
    ipv4?: string;
    provider?: string;
    providerServerId?: string;
    status: string;
  },
) {
  const db = getDb();

  await db
    .update(tenantServers)
    .set({
      ...(input.ipv4 ? { ipv4: input.ipv4 } : {}),
      ...(input.provider ? { provider: input.provider } : {}),
      ...(input.providerServerId
        ? { providerServerId: input.providerServerId }
        : {}),
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
