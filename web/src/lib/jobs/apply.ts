import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  ensureTenantRuntimeTenantToken,
  getLatestTenantManagedConfig,
  getManagedConfigVersionFromConfigJson,
  getTenantDesiredStateByVersion,
  getTenantManagedConfigByVersion,
  getTenantRuntimeGatewayToken,
  getTenantSlackBotToken,
  storeTenantRuntimeGatewayToken,
} from "@/db/control-plane";
import {
  integrationWhatsAppInstallations,
  tenantApplyRuns,
  tenantIntegrations,
  tenantRuntimeConfigEntries,
} from "@/db/schema";
import { buildOpenClawTenantConfig } from "@/lib/openclaw/config";
import { getTenantRuntimeConnection } from "@/lib/runtime/connection";
import { RuntimeManager } from "@/lib/runtime/manager";
import {
  WHATSAPP_RUNTIME_CONFIG_SURFACE_KEY,
  WHATSAPP_RUNTIME_CONFIG_SURFACE_KIND,
} from "@/lib/whatsapp-config";

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
const WHATSAPP_PROVIDER_KEY = "whatsapp";

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

  let slackEnabledInDesiredState = false;
  let whatsAppEnabledInDesiredState = false;

  try {
    await markApplyRun(job.id, {
      startedAt: new Date(),
      status: APPLY_STEPS.loadingDesiredState,
    });
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
      getTenantRuntimeConnection(payload.tenantId, "runtime apply"),
    ]);
    slackEnabledInDesiredState = desiredStateUsesSlack(desiredState.configJson);
    whatsAppEnabledInDesiredState = desiredStateUsesWhatsApp(
      desiredState.configJson,
    );

    if (slackEnabledInDesiredState) {
      await markIntegrationStatus(
        payload.tenantId,
        SLACK_PROVIDER_KEY,
        "applying",
      );
    }

    if (whatsAppEnabledInDesiredState) {
      await markIntegrationStatus(
        payload.tenantId,
        WHATSAPP_PROVIDER_KEY,
        "applying",
      );
    }

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
    const tenantToken = await ensureTenantRuntimeTenantToken(payload.tenantId);

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
      tenantToken,
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
    await runtimeManager.verifyTenantConfigFiles(runtimeConnection, {
      metadataPath: "/opt/openclaw/runtime/apply-metadata.json",
      openClawConfig,
    });

    const restartStep = payload.pullImageFirst
      ? APPLY_STEPS.pullingRuntimeImage
      : APPLY_STEPS.restartingRuntime;

    await markApplyRun(job.id, {
      status: restartStep,
    });
    await appendJobEvent(
      job.id,
      restartStep,
      payload.pullImageFirst
        ? "Pulling runtime image and recreating tenant runtime"
        : "Restarting tenant runtime",
      {
        host: runtimeConnection.host,
        pullImageFirst: payload.pullImageFirst === true,
      },
    );

    const restart = await runtimeManager.restartGatewayWithResult(
      runtimeConnection,
      {
        pullImage: payload.pullImageFirst ?? false,
        strategy: payload.pullImageFirst ? "recreate" : "restart-container",
      },
    );

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
    if (slackEnabledInDesiredState) {
      await markIntegrationStatus(
        payload.tenantId,
        SLACK_PROVIDER_KEY,
        "connected",
      );
    }

    if (whatsAppEnabledInDesiredState) {
      await markWhatsAppApplySuccessStatus(payload.tenantId);
    }

    await appendJobEvent(
      job.id,
      APPLY_STEPS.succeeded,
      "Tenant runtime apply completed successfully",
      {
        desiredStateVersion: desiredState.version,
        pullImageFirst: payload.pullImageFirst === true,
      },
    );
    await markJobSucceeded(job.id, {
      desiredStateVersion: desiredState.version,
      pullImageFirst: payload.pullImageFirst === true,
    });
  } catch (error) {
    const message = getErrorMessage(error);

    await markApplyRun(job.id, {
      error: message,
      finishedAt: new Date(),
      status: APPLY_STEPS.failed,
    });
    if (slackEnabledInDesiredState) {
      await markIntegrationStatus(
        payload.tenantId,
        SLACK_PROVIDER_KEY,
        "apply_failed",
        message,
      );
    }

    if (whatsAppEnabledInDesiredState) {
      await markIntegrationStatus(
        payload.tenantId,
        WHATSAPP_PROVIDER_KEY,
        "apply_failed",
        message,
      );
    }

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
  const pullImageFirst = payload.pullImageFirst;

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
    ...(typeof pullImageFirst === "boolean" ? { pullImageFirst } : {}),
    tenantId,
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

async function markIntegrationStatus(
  tenantId: string,
  providerKey: string,
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
        eq(tenantIntegrations.providerKey, providerKey),
      ),
    );
}

async function markWhatsAppApplySuccessStatus(tenantId: string) {
  const db = getDb();
  const now = new Date();
  const [integration] = await db
    .select({
      connectedAt: tenantIntegrations.connectedAt,
      disconnectedAt: tenantIntegrations.disconnectedAt,
      id: tenantIntegrations.id,
      status: tenantIntegrations.status,
      whatsappSelfE164: integrationWhatsAppInstallations.selfE164,
      whatsappSelfJid: integrationWhatsAppInstallations.selfJid,
    })
    .from(tenantIntegrations)
    .leftJoin(
      integrationWhatsAppInstallations,
      eq(
        integrationWhatsAppInstallations.tenantIntegrationId,
        tenantIntegrations.id,
      ),
    )
    .where(
      and(
        eq(tenantIntegrations.tenantId, tenantId),
        eq(tenantIntegrations.providerKey, WHATSAPP_PROVIDER_KEY),
      ),
    )
    .limit(1);

  const [runtimeConfigEntry] = await db
    .select({
      enabled: tenantRuntimeConfigEntries.enabled,
      installState: tenantRuntimeConfigEntries.installState,
    })
    .from(tenantRuntimeConfigEntries)
    .where(
      and(
        eq(tenantRuntimeConfigEntries.tenantId, tenantId),
        eq(
          tenantRuntimeConfigEntries.surfaceKind,
          WHATSAPP_RUNTIME_CONFIG_SURFACE_KIND,
        ),
        eq(
          tenantRuntimeConfigEntries.surfaceKey,
          WHATSAPP_RUNTIME_CONFIG_SURFACE_KEY,
        ),
      ),
    )
    .limit(1);

  const isInstalled =
    runtimeConfigEntry?.installState === "installed" &&
    runtimeConfigEntry.enabled === true;

  const nextStatus = !isInstalled
    ? "ready_to_link"
    : integration?.status === "disconnected"
      ? "disconnected"
      : integration?.whatsappSelfE164 || integration?.whatsappSelfJid
        ? "connected"
        : "ready_to_link";

  await db
    .update(tenantIntegrations)
    .set({
      lastError: null,
      lastErrorAt: null,
      status: nextStatus,
      updatedAt: now,
    })
    .where(
      and(
        eq(tenantIntegrations.tenantId, tenantId),
        eq(tenantIntegrations.providerKey, WHATSAPP_PROVIDER_KEY),
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

function desiredStateUsesWhatsApp(configJson: unknown) {
  if (
    !configJson ||
    typeof configJson !== "object" ||
    Array.isArray(configJson)
  ) {
    return false;
  }

  const integrations = (configJson as Record<string, unknown>).integrations;

  return Array.isArray(integrations) && integrations.includes("whatsapp");
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
