import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  getLatestTenantManagedConfig,
  getManagedConfigVersionFromConfigJson,
  getTenantDesiredStateByVersion,
  getTenantManagedConfigByVersion,
  getTenantRuntimeGatewayToken,
  getTenantSlackBotToken,
  storeTenantRuntimeGatewayToken,
} from "@/db/control-plane";
import {
  tenantApplyRuns,
  tenantIntegrations,
  tenantServers,
  tenants,
} from "@/db/schema";
import { getEnv } from "@/lib/env";
import { buildOpenClawTenantConfig } from "@/lib/openclaw/config";
import { RuntimeManager } from "@/lib/runtime/manager";

import { appendJobEvent, markJobFailed, markJobSucceeded } from "./queue";
import {
  APPLY_STEPS,
  type ApplyStep,
  type ApplyTenantConfigPayload,
  type ClaimedJob,
  JOB_TYPES,
} from "./types";

const runtimeManager = new RuntimeManager();
const SLACK_PROVIDER_KEY = "slack";

export async function processApplyTenantConfigJob(
  job: ClaimedJob,
): Promise<void> {
  if (job.jobType !== JOB_TYPES.applyTenantConfig) {
    throw new Error(`Unsupported job type for apply handler: ${job.jobType}`);
  }

  const payload = parseApplyPayload(job.payload);
  logStep(
    job.id,
    payload.tenantId,
    APPLY_STEPS.loadingDesiredState,
    "starting",
  );

  try {
    await markApplyRun(job.id, {
      startedAt: new Date(),
      status: APPLY_STEPS.loadingDesiredState,
    });
    await markSlackIntegrationStatus(payload.tenantId, "applying");
    await appendJobEvent(
      job.id,
      APPLY_STEPS.loadingDesiredState,
      "Loading desired state for tenant runtime apply",
      {
        desiredStateVersion: payload.desiredStateVersion,
      },
    );

    const [desiredState, runtimeConnection] = await Promise.all([
      getTenantDesiredStateByVersion({
        tenantId: payload.tenantId,
        version: payload.desiredStateVersion,
      }),
      getTenantRuntimeConnection(payload.tenantId),
    ]);

    await markApplyRun(job.id, {
      status: APPLY_STEPS.renderingFiles,
    });
    await appendJobEvent(
      job.id,
      APPLY_STEPS.renderingFiles,
      "Rendering runtime files for desired state",
      {
        desiredStateVersion: desiredState.version,
      },
    );

    let gatewayToken = await getTenantRuntimeGatewayToken(payload.tenantId);

    if (!gatewayToken) {
      gatewayToken = await runtimeManager.readRuntimeEnvValue(
        runtimeConnection,
        "OPENCLAW_GATEWAY_TOKEN",
      );

      if (!gatewayToken) {
        throw new Error(
          "Gateway token is missing from both control-plane storage and the tenant runtime",
        );
      }

      await storeTenantRuntimeGatewayToken({
        gatewayToken,
        tenantId: payload.tenantId,
      });
    }

    const slackBotToken = await getTenantSlackBotToken(payload.tenantId);

    if (desiredStateUsesSlack(desiredState.configJson) && !slackBotToken) {
      throw new Error(
        "Slack is enabled in desired state but the tenant Slack bot token is missing",
      );
    }

    const openClawConfig = buildOpenClawTenantConfig({
      configJson: desiredState.configJson,
      slackBotToken,
      tenantId: payload.tenantId,
    });
    const managedConfigVersion = getManagedConfigVersionFromConfigJson(
      desiredState.configJson,
    );
    const managedConfig = managedConfigVersion
      ? await getTenantManagedConfigByVersion({
          tenantId: payload.tenantId,
          version: managedConfigVersion,
        })
      : await getLatestTenantManagedConfig(payload.tenantId);

    await markApplyRun(job.id, {
      status: APPLY_STEPS.writingFiles,
    });
    await appendJobEvent(
      job.id,
      APPLY_STEPS.writingFiles,
      "Writing runtime files to tenant server",
      {
        host: runtimeConnection.host,
      },
    );

    await runtimeManager.ensureRuntimeDirectories(runtimeConnection);
    await runtimeManager.writeTenantConfigFiles(runtimeConnection, {
      desiredStateVersion: desiredState.version,
      gatewayToken,
      metadataPath: "/opt/openclaw/runtime/apply-metadata.json",
      metadataTimestampKey: "appliedAt",
      managedBootstrapFiles: managedConfig.files.map((file) => ({
        contents: file.renderedContent,
        filename: file.path,
      })),
      openClawConfig,
      slackBotToken,
      tenantId: payload.tenantId,
    });
    await runtimeManager.verifyTenantConfigFiles(
      runtimeConnection,
      "/opt/openclaw/runtime/apply-metadata.json",
    );

    await markApplyRun(job.id, {
      status: APPLY_STEPS.restartingRuntime,
    });
    await appendJobEvent(
      job.id,
      APPLY_STEPS.restartingRuntime,
      "Restarting tenant runtime",
      {
        host: runtimeConnection.host,
      },
    );

    const restart =
      await runtimeManager.restartGatewayWithResult(runtimeConnection);

    await markApplyRun(job.id, {
      restartStderr: restart.stderr,
      restartStdout: restart.stdout,
      status: APPLY_STEPS.verifyingRuntime,
    });
    await appendJobEvent(
      job.id,
      APPLY_STEPS.verifyingRuntime,
      "Verifying tenant runtime health",
      {
        host: runtimeConnection.host,
      },
    );

    const verify =
      await runtimeManager.checkGatewayHealthWithResult(runtimeConnection);

    await markApplyRun(job.id, {
      finishedAt: new Date(),
      restartStderr: restart.stderr,
      restartStdout: restart.stdout,
      status: APPLY_STEPS.succeeded,
      verifyStderr: verify.stderr,
      verifyStdout: verify.stdout,
    });
    await markSlackIntegrationStatus(payload.tenantId, "connected");
    await appendJobEvent(
      job.id,
      APPLY_STEPS.succeeded,
      "Tenant runtime apply completed successfully",
      {
        desiredStateVersion: desiredState.version,
      },
    );
    await markJobSucceeded(job.id, {
      desiredStateVersion: desiredState.version,
    });
  } catch (error) {
    const message = getErrorMessage(error);

    await markApplyRun(job.id, {
      error: message,
      finishedAt: new Date(),
      status: APPLY_STEPS.failed,
    });
    await markSlackIntegrationStatus(payload.tenantId, "apply_failed", message);
    await appendJobEvent(
      job.id,
      APPLY_STEPS.failed,
      "Tenant runtime apply failed",
      {
        error: message,
      },
    );
    await markJobFailed(job.id, message);
    throw error;
  }
}

function parseApplyPayload(
  payload: Record<string, unknown>,
): ApplyTenantConfigPayload {
  const tenantId = payload.tenantId;
  const desiredStateVersion = payload.desiredStateVersion;

  if (typeof tenantId !== "string" || tenantId.length === 0) {
    throw new Error("Apply job payload is missing tenantId");
  }

  if (
    typeof desiredStateVersion !== "number" ||
    !Number.isInteger(desiredStateVersion) ||
    desiredStateVersion < 1
  ) {
    throw new Error("Apply job payload is missing desiredStateVersion");
  }

  return {
    desiredStateVersion,
    tenantId,
  };
}

async function getTenantRuntimeConnection(tenantId: string) {
  const db = getDb();
  const [tenantServer] = await db
    .select({
      ipv4: tenantServers.ipv4,
      serverStatus: tenantServers.status,
      sshUsername: tenantServers.sshUsername,
      tenantStatus: tenants.status,
    })
    .from(tenantServers)
    .innerJoin(tenants, eq(tenantServers.tenantId, tenants.id))
    .where(eq(tenantServers.tenantId, tenantId))
    .limit(1);

  if (!tenantServer?.ipv4) {
    throw new Error("Tenant server IP is missing for runtime apply");
  }

  if (
    tenantServer.serverStatus !== "ready" ||
    tenantServer.tenantStatus !== "ready"
  ) {
    throw new Error("Tenant runtime apply requires a ready tenant server");
  }

  return {
    host: tenantServer.ipv4,
    port: getEnv().RUNTIME_SSH_PORT,
    username: tenantServer.sshUsername ?? getEnv().RUNTIME_SSH_USERNAME,
  };
}

async function markApplyRun(
  jobRunId: string,
  input: {
    error?: string;
    finishedAt?: Date;
    restartStderr?: string;
    restartStdout?: string;
    startedAt?: Date;
    status: ApplyStep;
    verifyStderr?: string;
    verifyStdout?: string;
  },
) {
  const db = getDb();

  await db
    .update(tenantApplyRuns)
    .set({
      ...(input.error !== undefined ? { error: input.error } : {}),
      ...(input.finishedAt ? { finishedAt: input.finishedAt } : {}),
      ...(input.restartStderr !== undefined
        ? { restartStderr: input.restartStderr }
        : {}),
      ...(input.restartStdout !== undefined
        ? { restartStdout: input.restartStdout }
        : {}),
      ...(input.startedAt ? { startedAt: input.startedAt } : {}),
      status: input.status,
      updatedAt: new Date(),
      ...(input.verifyStderr !== undefined
        ? { verifyStderr: input.verifyStderr }
        : {}),
      ...(input.verifyStdout !== undefined
        ? { verifyStdout: input.verifyStdout }
        : {}),
    })
    .where(eq(tenantApplyRuns.jobRunId, jobRunId));
}

async function markSlackIntegrationStatus(
  tenantId: string,
  status: string,
  error?: string,
) {
  const db = getDb();
  const now = new Date();

  await db
    .update(tenantIntegrations)
    .set({
      lastError: error ?? null,
      lastErrorAt: error ? now : null,
      status,
      updatedAt: now,
    })
    .where(
      and(
        eq(tenantIntegrations.tenantId, tenantId),
        eq(tenantIntegrations.providerKey, SLACK_PROVIDER_KEY),
      ),
    );
}

function desiredStateUsesSlack(configJson: unknown) {
  if (
    !configJson ||
    typeof configJson !== "object" ||
    Array.isArray(configJson)
  ) {
    return false;
  }

  const integrations = (configJson as Record<string, unknown>).integrations;

  return Array.isArray(integrations) && integrations.includes("slack");
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown runtime apply error";
}

function logStep(
  jobId: string,
  tenantId: string,
  step: ApplyStep,
  message: string,
) {
  console.info(
    `[worker] job ${jobId} tenant ${tenantId} step ${step}: ${message}`,
  );
}
