import { getEnv } from "../env";
import { HetznerClient } from "../hetzner/client";
import { renderCloudInit } from "../hetzner/cloud-init";
import { RuntimeManager } from "../runtime/manager";
import { SshClient } from "../ssh/client";

import {
  appendJobEvent,
  markJobFailed,
  markJobSucceeded,
  requeueJob,
} from "./queue";
import {
  BAKE_ONBOARDING_SNAPSHOT_STEPS,
  type BakeHetznerOnboardingSnapshotPayload,
  type BakeOnboardingSnapshotStep,
  type ClaimedJob,
  JOB_TYPES,
} from "./types";

const runtimeManager = new RuntimeManager();
const sshClient = new SshClient();
const STEP_DELAY_MS = 10_000;

export type BakeHetznerOnboardingSnapshotDeps = {
  appendJobEvent: typeof appendJobEvent;
  createSnapshot: (input: {
    baseImage: string;
    generation: string;
    providerServerId: string;
    runtimeImage: string;
  }) => Promise<{
    actionId: string | null;
    id: string;
  }>;
  createTemporaryServer: (input: {
    baseImage: string;
    generation: string;
  }) => Promise<{
    actionId: string | null;
    id: string;
    provider: string;
  }>;
  deleteServer: (providerServerId: string) => Promise<void>;
  fetchServer: (providerServerId: string) => Promise<{
    ipv4: string | null;
    status: string | null;
  }>;
  markJobFailed: typeof markJobFailed;
  markJobSucceeded: typeof markJobSucceeded;
  powerOffServer: (providerServerId: string) => Promise<string | null>;
  prepareSnapshotHost: (input: {
    baseImage: string;
    generation: string;
    ipv4: string;
    runtimeImage: string;
  }) => Promise<void>;
  requeueJob: typeof requeueJob;
  waitForHostBootstrap: (ipv4: string) => Promise<void>;
  waitForServerAction: (
    providerServerId: string,
    actionId: string,
  ) => Promise<void>;
  waitForSsh: (ipv4: string) => Promise<void>;
};

const defaultDeps: BakeHetznerOnboardingSnapshotDeps = {
  appendJobEvent,
  createSnapshot: async (input) => {
    return await getHetznerClient().createSnapshot(
      input.providerServerId,
      `Otto onboarding snapshot ${input.generation}`,
    );
  },
  createTemporaryServer: async (input) => {
    const env = getEnv();
    const sshKeys = env.HETZNER_SSH_KEY_NAMES.split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const server = await getHetznerClient().createServer({
      image: input.baseImage,
      labels: {
        "otto/managed": "true",
        "otto/onboarding_snapshot_bake": "true",
        "otto/snapshot_generation": input.generation,
      },
      location: env.HETZNER_DEFAULT_LOCATION,
      name: buildBakeServerName(input.generation),
      serverType: env.HETZNER_DEFAULT_SERVER_TYPE,
      sshKeys,
      userData: renderCloudInit(),
    });

    return {
      actionId: server.actionId,
      id: server.id,
      provider: "hetzner",
    };
  },
  deleteServer: async (providerServerId) => {
    await getHetznerClient().deleteServer(providerServerId);
  },
  fetchServer: async (providerServerId) => {
    const server = await getHetznerClient().getServer(providerServerId);

    return {
      ipv4: server.ipv4,
      status: server.status,
    };
  },
  markJobFailed,
  markJobSucceeded,
  powerOffServer: async (providerServerId) => {
    return await getHetznerClient().powerOffServer(providerServerId);
  },
  prepareSnapshotHost: async (input) => {
    await runtimeManager.prepareOnboardingSnapshotHost(
      {
        host: input.ipv4,
        port: getEnv().RUNTIME_SSH_PORT,
        username: getEnv().RUNTIME_SSH_USERNAME,
      },
      {
        baseImage: input.baseImage,
        generation: input.generation,
        runtimeImage: input.runtimeImage,
      },
    );
  },
  requeueJob,
  waitForHostBootstrap: async (ipv4) => {
    await runtimeManager.waitForHostBootstrap({
      host: ipv4,
      port: getEnv().RUNTIME_SSH_PORT,
      username: getEnv().RUNTIME_SSH_USERNAME,
    });
  },
  waitForServerAction: async (providerServerId, actionId) => {
    await getHetznerClient().waitForServerAction(providerServerId, actionId);
  },
  waitForSsh: async (ipv4) => {
    await sshClient.waitUntilReachable({
      host: ipv4,
      port: getEnv().RUNTIME_SSH_PORT,
      username: getEnv().RUNTIME_SSH_USERNAME,
    });
  },
};

export async function processBakeHetznerOnboardingSnapshotJob(
  job: ClaimedJob,
  deps: BakeHetznerOnboardingSnapshotDeps = defaultDeps,
): Promise<void> {
  if (job.jobType !== JOB_TYPES.bakeHetznerOnboardingSnapshot) {
    throw new Error(`Unsupported job type for snapshot bake handler: ${job.jobType}`);
  }

  const payload = parsePayload(job.payload);

  try {
    switch (payload.step) {
      case BAKE_ONBOARDING_SNAPSHOT_STEPS.createServer:
        await createServer(job.id, payload, deps);
        return;
      case BAKE_ONBOARDING_SNAPSHOT_STEPS.waitForServerAction:
        await waitForServerAction(job.id, payload, deps);
        return;
      case BAKE_ONBOARDING_SNAPSHOT_STEPS.fetchServerIp:
        await fetchServerIp(job.id, payload, deps);
        return;
      case BAKE_ONBOARDING_SNAPSHOT_STEPS.waitForSsh:
        await waitForSsh(job.id, payload, deps);
        return;
      case BAKE_ONBOARDING_SNAPSHOT_STEPS.waitForHostBootstrap:
        await waitForHostBootstrap(job.id, payload, deps);
        return;
      case BAKE_ONBOARDING_SNAPSHOT_STEPS.prepareSnapshotHost:
        await prepareSnapshotHost(job.id, payload, deps);
        return;
      case BAKE_ONBOARDING_SNAPSHOT_STEPS.powerOffServer:
        await powerOffServer(job.id, payload, deps);
        return;
      case BAKE_ONBOARDING_SNAPSHOT_STEPS.waitForPowerOff:
        await waitForPowerOff(job.id, payload, deps);
        return;
      case BAKE_ONBOARDING_SNAPSHOT_STEPS.createSnapshot:
        await createSnapshot(job.id, payload, deps);
        return;
      default:
        throw new Error(`Unsupported snapshot bake step: ${payload.step}`);
    }
  } catch (error) {
    await deps.appendJobEvent(
      job.id,
      "failed",
      "Onboarding snapshot bake failed",
      {
        error: getErrorMessage(error),
        step: payload.step,
      },
    );
    await deps.markJobFailed(job.id, getErrorMessage(error));
    throw error;
  }
}

function parsePayload(
  payload: Record<string, unknown>,
): BakeHetznerOnboardingSnapshotPayload {
  const generation = payload.generation;
  const baseImage = payload.baseImage;
  const runtimeImage = payload.runtimeImage;
  const step = payload.step;

  if (typeof generation !== "string" || generation.length === 0) {
    throw new Error("Snapshot bake job payload is missing generation");
  }

  if (typeof baseImage !== "string" || baseImage.length === 0) {
    throw new Error("Snapshot bake job payload is missing baseImage");
  }

  if (typeof runtimeImage !== "string" || runtimeImage.length === 0) {
    throw new Error("Snapshot bake job payload is missing runtimeImage");
  }

  return {
    actionId: typeof payload.actionId === "string" ? payload.actionId : undefined,
    baseImage,
    generation,
    ipv4: typeof payload.ipv4 === "string" ? payload.ipv4 : undefined,
    organizationId:
      typeof payload.organizationId === "string" ? payload.organizationId : undefined,
    organizationSlug:
      typeof payload.organizationSlug === "string"
        ? payload.organizationSlug
        : undefined,
    providerServerId:
      typeof payload.providerServerId === "string"
        ? payload.providerServerId
        : undefined,
    runtimeImage,
    step:
      typeof step === "string" && isBakeStep(step)
        ? step
        : BAKE_ONBOARDING_SNAPSHOT_STEPS.createServer,
  };
}

function isBakeStep(value: string): value is BakeOnboardingSnapshotStep {
  return Object.values(BAKE_ONBOARDING_SNAPSHOT_STEPS).includes(
    value as BakeOnboardingSnapshotStep,
  );
}

async function createServer(
  jobId: string,
  payload: BakeHetznerOnboardingSnapshotPayload,
  deps: BakeHetznerOnboardingSnapshotDeps,
) {
  const server = await deps.createTemporaryServer({
    baseImage: payload.baseImage,
    generation: payload.generation,
  });

  await deps.appendJobEvent(jobId, "creating_server", "Created temporary bake server", {
    generation: payload.generation,
    provider: server.provider,
    providerServerId: server.id,
  });

  await deps.requeueJob(
    jobId,
    {
      ...payload,
      actionId: server.actionId ?? undefined,
      providerServerId: server.id,
      step: BAKE_ONBOARDING_SNAPSHOT_STEPS.waitForServerAction,
    },
    new Date(Date.now() + STEP_DELAY_MS),
  );
}

async function waitForServerAction(
  jobId: string,
  payload: BakeHetznerOnboardingSnapshotPayload,
  deps: BakeHetznerOnboardingSnapshotDeps,
) {
  if (!payload.providerServerId || !payload.actionId) {
    throw new Error("Snapshot bake job cannot wait for server action without ids");
  }

  await deps.waitForServerAction(payload.providerServerId, payload.actionId);
  await deps.requeueJob(
    jobId,
    {
      ...payload,
      step: BAKE_ONBOARDING_SNAPSHOT_STEPS.fetchServerIp,
    },
    new Date(Date.now() + STEP_DELAY_MS),
  );
}

async function fetchServerIp(
  jobId: string,
  payload: BakeHetznerOnboardingSnapshotPayload,
  deps: BakeHetznerOnboardingSnapshotDeps,
) {
  if (!payload.providerServerId) {
    throw new Error("Snapshot bake job cannot fetch a server IP without server id");
  }

  const server = await deps.fetchServer(payload.providerServerId);

  if (!server.ipv4) {
    throw new Error(`Snapshot bake server ${payload.providerServerId} does not have an IPv4 address`);
  }

  await deps.requeueJob(
    jobId,
    {
      ...payload,
      ipv4: server.ipv4,
      step: BAKE_ONBOARDING_SNAPSHOT_STEPS.waitForSsh,
    },
    new Date(Date.now() + STEP_DELAY_MS),
  );
}

async function waitForSsh(
  jobId: string,
  payload: BakeHetznerOnboardingSnapshotPayload,
  deps: BakeHetznerOnboardingSnapshotDeps,
) {
  if (!payload.ipv4) {
    throw new Error("Snapshot bake job cannot wait for SSH without an IPv4 address");
  }

  await deps.waitForSsh(payload.ipv4);
  await deps.requeueJob(
    jobId,
    {
      ...payload,
      step: BAKE_ONBOARDING_SNAPSHOT_STEPS.waitForHostBootstrap,
    },
    new Date(Date.now() + STEP_DELAY_MS),
  );
}

async function waitForHostBootstrap(
  jobId: string,
  payload: BakeHetznerOnboardingSnapshotPayload,
  deps: BakeHetznerOnboardingSnapshotDeps,
) {
  if (!payload.ipv4) {
    throw new Error("Snapshot bake job cannot wait for host bootstrap without an IPv4 address");
  }

  await deps.waitForHostBootstrap(payload.ipv4);
  await deps.requeueJob(
    jobId,
    {
      ...payload,
      step: BAKE_ONBOARDING_SNAPSHOT_STEPS.prepareSnapshotHost,
    },
    new Date(Date.now() + STEP_DELAY_MS),
  );
}

async function prepareSnapshotHost(
  jobId: string,
  payload: BakeHetznerOnboardingSnapshotPayload,
  deps: BakeHetznerOnboardingSnapshotDeps,
) {
  if (!payload.ipv4 || !payload.providerServerId) {
    throw new Error("Snapshot bake job cannot prepare host without server metadata");
  }

  await deps.prepareSnapshotHost({
    baseImage: payload.baseImage,
    generation: payload.generation,
    ipv4: payload.ipv4,
    runtimeImage: payload.runtimeImage,
  });

  const actionId = await deps.powerOffServer(payload.providerServerId);

  if (!actionId) {
    await deps.requeueJob(
      jobId,
      {
        ...payload,
        step: BAKE_ONBOARDING_SNAPSHOT_STEPS.createSnapshot,
      },
      new Date(Date.now() + STEP_DELAY_MS),
    );
    return;
  }

  await deps.requeueJob(
    jobId,
    {
      ...payload,
      actionId,
      step: BAKE_ONBOARDING_SNAPSHOT_STEPS.waitForPowerOff,
    },
    new Date(Date.now() + STEP_DELAY_MS),
  );
}

async function powerOffServer(
  jobId: string,
  payload: BakeHetznerOnboardingSnapshotPayload,
  deps: BakeHetznerOnboardingSnapshotDeps,
): Promise<void> {
  if (!payload.providerServerId) {
    throw new Error("Snapshot bake job cannot power off server without a server id");
  }

  const actionId = await deps.powerOffServer(payload.providerServerId);

  await deps.requeueJob(
    jobId,
    {
      ...payload,
      actionId: actionId ?? undefined,
      step: actionId
        ? BAKE_ONBOARDING_SNAPSHOT_STEPS.waitForPowerOff
        : BAKE_ONBOARDING_SNAPSHOT_STEPS.createSnapshot,
    },
    new Date(Date.now() + STEP_DELAY_MS),
  );
}

async function waitForPowerOff(
  jobId: string,
  payload: BakeHetznerOnboardingSnapshotPayload,
  deps: BakeHetznerOnboardingSnapshotDeps,
) {
  if (!payload.providerServerId) {
    throw new Error("Snapshot bake job cannot wait for power off without a server id");
  }

  if (payload.actionId) {
    await deps.waitForServerAction(payload.providerServerId, payload.actionId);
  }

  const server = await deps.fetchServer(payload.providerServerId);

  if (server.status && server.status !== "off") {
    throw new Error(
      `Snapshot bake server ${payload.providerServerId} is not powered off (status=${server.status})`,
    );
  }

  await deps.requeueJob(
    jobId,
    {
      ...payload,
      step: BAKE_ONBOARDING_SNAPSHOT_STEPS.createSnapshot,
    },
    new Date(Date.now() + STEP_DELAY_MS),
  );
}

async function createSnapshot(
  jobId: string,
  payload: BakeHetznerOnboardingSnapshotPayload,
  deps: BakeHetznerOnboardingSnapshotDeps,
) {
  if (!payload.providerServerId) {
    throw new Error("Snapshot bake job cannot create snapshot without a server id");
  }

  const snapshot = await deps.createSnapshot({
    baseImage: payload.baseImage,
    generation: payload.generation,
    providerServerId: payload.providerServerId,
    runtimeImage: payload.runtimeImage,
  });
  await deps.deleteServer(payload.providerServerId);
  await deps.markJobSucceeded(jobId, {
    baseImage: payload.baseImage,
    generation: payload.generation,
    providerServerId: payload.providerServerId,
    runtimeImage: payload.runtimeImage,
    snapshotId: snapshot.id,
  });
}

function buildBakeServerName(generation: string) {
  return `otto-bake-${generation.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32)}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "Unknown snapshot bake error";
}

let cachedHetznerClient: HetznerClient | null = null;

function getHetznerClient() {
  if (!cachedHetznerClient) {
    cachedHetznerClient = new HetznerClient();
  }

  return cachedHetznerClient;
}
