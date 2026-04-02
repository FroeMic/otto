import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { activateTenantWhatsAppAfterPairing } from "@/db/control-plane";
import {
  tenantIntegrations,
  tenantRuntimeConfigEntries,
  whatsappInstallations,
  whatsappLinkSessions,
} from "@/db/schema";
import { getTenantRuntimeConnection } from "@/lib/runtime/connection";
import { RuntimeManager } from "@/lib/runtime/manager";
import {
  WHATSAPP_RUNTIME_CONFIG_SURFACE_KEY,
  WHATSAPP_RUNTIME_CONFIG_SURFACE_KIND,
} from "@/lib/whatsapp-config";

import {
  appendJobEvent,
  enqueueJob,
  markJobFailed,
  markJobSucceeded,
} from "./queue";
import type {
  ClaimedJob,
  WhatsAppDisconnectPayload,
  WhatsAppLinkSessionPayload,
} from "./types";
import { JOB_TYPES } from "./types";

const runtimeManager = new RuntimeManager();
const WHATSAPP_PROVIDER_KEY = "whatsapp";
const LINK_START_TIMEOUT_MS = 30_000;
const LINK_WAIT_TIMEOUT_MS = 200_000;
const LINK_STATUS_VERIFICATION_ATTEMPTS = 6;
const LINK_STATUS_VERIFICATION_DELAY_MS = 5_000;

type WhatsAppLinkedIdentity = {
  selfE164: string | null;
  selfJid: string | null;
};

export async function processWhatsAppLinkSessionJob(
  job: ClaimedJob,
): Promise<void> {
  if (job.jobType !== JOB_TYPES.whatsappLinkSession) {
    throw new Error(
      `Unsupported job type for WhatsApp link handler: ${job.jobType}`,
    );
  }

  const payload = parseLinkPayload(job.payload);

  try {
    await appendJobEvent(
      job.id,
      "whatsapp_link_start",
      "Starting WhatsApp QR generation",
      {
        linkSessionId: payload.linkSessionId,
      },
    );

    const [runtimeConnection, linkSession] = await Promise.all([
      getTenantRuntimeConnection(payload.tenantId, "WhatsApp jobs"),
      getLinkSession(payload.linkSessionId),
    ]);

    if (!linkSession) {
      throw new Error("WhatsApp link session not found");
    }

    await markLinkSessionStatus(payload.linkSessionId, {
      status: "starting",
    });
    await markIntegrationStatus(payload.tenantId, "linking");

    const startResult = await runtimeManager.startWhatsAppLoginWithQr(
      runtimeConnection,
      {
        force: linkSession.forceRelink,
        timeoutMs: LINK_START_TIMEOUT_MS,
      },
    );
    const startText = startResult.message.trim();
    const qrDataUrl = startResult.qrDataUrl?.trim();
    const startEvents = summarizeWhatsAppHelperEvents(startResult.events);
    console.info(
      `[worker][whatsapp] helper start linkSession=${payload.linkSessionId} message=${startText}${startEvents ? ` events=${startEvents}` : ""}`,
    );

    if (qrDataUrl) {
      await markLinkSessionStatus(payload.linkSessionId, {
        expiresAt: new Date(Date.now() + 3 * 60_000),
        qrDataUrl,
        status: "qr_ready",
      });
      await appendJobEvent(
        job.id,
        "whatsapp_qr_ready",
        "WhatsApp QR code generated",
      );
    } else if (startText.toLowerCase().includes("already linked")) {
      const helperIdentity = getWhatsAppLinkedIdentity(startResult.self);
      const activationMode = await getWhatsAppRuntimeActivationMode(
        payload.tenantId,
      );

      if (activationMode === "install_after_pair") {
        await completeLinkSession({
          integrationStatus: "activating",
          linkSessionId: payload.linkSessionId,
          selfE164: helperIdentity.selfE164,
          selfJid: helperIdentity.selfJid,
          tenantId: payload.tenantId,
        });
        await appendJobEvent(
          job.id,
          "whatsapp_already_linked",
          "WhatsApp was already linked and Otto is activating it in the tenant runtime",
          {
            selfE164: helperIdentity.selfE164,
          },
        );

        const activationResult = await activatePairedWhatsAppRuntime({
          jobId: job.id,
          tenantId: payload.tenantId,
        });

        await markJobSucceeded(job.id, {
          activationMode,
          alreadyLinked: true,
          linkSessionId: payload.linkSessionId,
          runtimeActivationError: activationResult.runtimeActivationError,
          selfE164: helperIdentity.selfE164,
        });
        return;
      }

      const linkedState =
        await ensureWhatsAppRuntimeConnected(runtimeConnection);

      if (linkedState?.connected) {
        await completeLinkSession({
          integrationStatus: "connected",
          linkSessionId: payload.linkSessionId,
          selfE164: linkedState.selfE164,
          selfJid: linkedState.selfJid,
          tenantId: payload.tenantId,
        });
        await appendJobEvent(
          job.id,
          "whatsapp_already_linked",
          "WhatsApp was already linked",
          {
            selfE164: linkedState.selfE164,
          },
        );
        await markJobSucceeded(job.id, {
          alreadyLinked: true,
          linkSessionId: payload.linkSessionId,
          selfE164: linkedState.selfE164,
        });
      } else {
        const error = formatInactiveWhatsAppRuntimeMessage(
          linkedState ?? {
            connected: false,
            lastError: null,
            linked: false,
            running: false,
          },
          "WhatsApp credentials already exist, but the tenant runtime is not connected.",
        );
        await failLinkSession({
          error,
          linkSessionId: payload.linkSessionId,
          tenantId: payload.tenantId,
        });
        await appendJobEvent(job.id, "whatsapp_link_failed", error);
        await markJobFailed(job.id, error);
      }
      return;
    } else {
      throw new Error(startText || "WhatsApp QR code was not returned");
    }

    const waitResult = await runtimeManager.waitForWhatsAppLogin(
      runtimeConnection,
      {
        timeoutMs: LINK_WAIT_TIMEOUT_MS,
      },
    );
    const waitText = waitResult.message.trim();
    const connected = waitResult.connected;
    const waitEvents = summarizeWhatsAppHelperEvents(waitResult.events);
    console.info(
      `[worker][whatsapp] helper wait linkSession=${payload.linkSessionId} connected=${connected ? "true" : "false"} message=${waitText}${waitEvents ? ` events=${waitEvents}` : ""}`,
    );

    if (!connected) {
      const linkedState =
        await ensureWhatsAppRuntimeConnected(runtimeConnection);

      if (linkedState?.connected) {
        const selfE164 = linkedState.selfE164 ?? null;
        await completeLinkSession({
          integrationStatus: "connected",
          linkSessionId: payload.linkSessionId,
          selfE164,
          selfJid: linkedState.selfJid ?? null,
          tenantId: payload.tenantId,
        });
        await appendJobEvent(
          job.id,
          "whatsapp_connected_after_verification",
          "WhatsApp linked successfully after runtime verification",
          {
            selfE164,
            waitMessage: waitText,
          },
        );
        await markJobSucceeded(job.id, {
          linkSessionId: payload.linkSessionId,
          recoveredFromWaitFailure: true,
          selfE164,
        });
        return;
      }

      const error = linkedState
        ? formatInactiveWhatsAppRuntimeMessage(linkedState, waitText)
        : waitText || "WhatsApp QR scan timed out";
      await failLinkSession({
        error,
        linkSessionId: payload.linkSessionId,
        tenantId: payload.tenantId,
      });
      await appendJobEvent(
        job.id,
        "whatsapp_link_failed",
        "WhatsApp linking did not complete",
        {
          error,
        },
      );
      await markJobFailed(job.id, error);
      return;
    }

    const helperIdentity = getWhatsAppLinkedIdentity(waitResult.self);
    const activationMode = await getWhatsAppRuntimeActivationMode(
      payload.tenantId,
    );
    await completeLinkSession({
      integrationStatus:
        activationMode === "install_after_pair" ? "activating" : "connected",
      linkSessionId: payload.linkSessionId,
      selfE164: helperIdentity.selfE164,
      selfJid: helperIdentity.selfJid,
      tenantId: payload.tenantId,
    });
    await appendJobEvent(
      job.id,
      "whatsapp_connected",
      "WhatsApp linked successfully",
      {
        selfE164: helperIdentity.selfE164,
      },
    );

    if (activationMode === "install_after_pair") {
      const activationResult = await activatePairedWhatsAppRuntime({
        jobId: job.id,
        tenantId: payload.tenantId,
      });

      await markJobSucceeded(job.id, {
        activationMode,
        linkSessionId: payload.linkSessionId,
        runtimeActivationError: activationResult.runtimeActivationError,
        selfE164: helperIdentity.selfE164,
      });
      return;
    }

    let runtimeActivationError: string | null = null;
    let finalStatus: Awaited<
      ReturnType<typeof runtimeManager.readWhatsAppLinkStatus>
    > | null = null;

    try {
      finalStatus = await ensureWhatsAppRuntimeConnected(runtimeConnection);

      if (finalStatus?.connected) {
        console.info(
          `[worker][whatsapp] runtime connected linkSession=${payload.linkSessionId} self=${finalStatus.selfE164 ?? finalStatus.selfJid ?? "unknown"}`,
        );
        await appendJobEvent(
          job.id,
          "whatsapp_runtime_connected",
          "WhatsApp runtime is connected on the tenant server",
          {
            selfE164: finalStatus.selfE164 ?? helperIdentity.selfE164,
          },
        );
      } else {
        runtimeActivationError = formatInactiveWhatsAppRuntimeMessage(
          finalStatus ?? {
            connected: false,
            lastError: null,
            linked: false,
            running: false,
          },
          "WhatsApp linked successfully, but the tenant runtime is still reconnecting.",
        );
      }
    } catch (error) {
      runtimeActivationError = getErrorMessage(error);
    }

    if (runtimeActivationError) {
      console.warn(
        `[worker][whatsapp] runtime activation warning linkSession=${payload.linkSessionId} warning=${runtimeActivationError}`,
      );
      await appendJobEvent(
        job.id,
        "whatsapp_runtime_activation_warning",
        runtimeActivationError,
      );
    }

    await markJobSucceeded(job.id, {
      linkSessionId: payload.linkSessionId,
      runtimeActivationError,
      runtimeConnected: finalStatus?.connected === true,
      selfE164: finalStatus?.selfE164 ?? helperIdentity.selfE164,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    await failLinkSession({
      error: message,
      linkSessionId: payload.linkSessionId,
      tenantId: payload.tenantId,
    });
    await appendJobEvent(job.id, "whatsapp_link_failed", message);
    await markJobFailed(job.id, message);
    throw error;
  }
}

export async function processWhatsAppDisconnectJob(
  job: ClaimedJob,
): Promise<void> {
  if (job.jobType !== JOB_TYPES.whatsappDisconnect) {
    throw new Error(
      `Unsupported job type for WhatsApp disconnect handler: ${job.jobType}`,
    );
  }

  const payload = parseDisconnectPayload(job.payload);

  try {
    await appendJobEvent(
      job.id,
      "whatsapp_disconnect_start",
      "Disconnecting WhatsApp from the tenant runtime",
    );
    const runtimeConnection = await getTenantRuntimeConnection(
      payload.tenantId,
      "WhatsApp jobs",
    );
    await runtimeManager.logoutWhatsApp(runtimeConnection);
    await markWhatsAppDisconnected(payload.tenantId);

    if (typeof payload.desiredStateVersion === "number") {
      await enqueueJob({
        jobType: JOB_TYPES.applyTenantConfig,
        payload: {
          desiredStateVersion: payload.desiredStateVersion,
          tenantId: payload.tenantId,
        },
      });
      await appendJobEvent(
        job.id,
        "whatsapp_disable_apply_enqueued",
        "Queued runtime apply to remove WhatsApp from the tenant runtime",
        {
          desiredStateVersion: payload.desiredStateVersion,
        },
      );
    }

    await appendJobEvent(
      job.id,
      "whatsapp_disconnected",
      "WhatsApp disconnected successfully",
    );
    await markJobSucceeded(job.id, {
      tenantId: payload.tenantId,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    await appendJobEvent(job.id, "whatsapp_disconnect_failed", message);
    await markJobFailed(job.id, message);
    throw error;
  }
}

function parseLinkPayload(
  payload: Record<string, unknown>,
): WhatsAppLinkSessionPayload {
  const tenantId = payload.tenantId;
  const linkSessionId = payload.linkSessionId;

  if (typeof tenantId !== "string" || tenantId.length === 0) {
    throw new Error("WhatsApp link job payload is missing tenantId");
  }

  if (typeof linkSessionId !== "string" || linkSessionId.length === 0) {
    throw new Error("WhatsApp link job payload is missing linkSessionId");
  }

  return {
    linkSessionId,
    tenantId,
  };
}

function parseDisconnectPayload(
  payload: Record<string, unknown>,
): WhatsAppDisconnectPayload {
  const tenantId = payload.tenantId;
  const desiredStateVersion = payload.desiredStateVersion;

  if (typeof tenantId !== "string" || tenantId.length === 0) {
    throw new Error("WhatsApp disconnect job payload is missing tenantId");
  }

  if (
    desiredStateVersion !== undefined &&
    (typeof desiredStateVersion !== "number" ||
      !Number.isInteger(desiredStateVersion) ||
      desiredStateVersion <= 0)
  ) {
    throw new Error(
      "WhatsApp disconnect job payload has an invalid desiredStateVersion",
    );
  }

  return {
    ...(typeof desiredStateVersion === "number" ? { desiredStateVersion } : {}),
    tenantId,
  };
}

async function getWhatsAppRuntimeActivationMode(tenantId: string) {
  const db = getDb();
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

  if (
    !runtimeConfigEntry ||
    runtimeConfigEntry.installState !== "installed" ||
    runtimeConfigEntry.enabled !== true
  ) {
    return "install_after_pair" as const;
  }

  return "runtime_reconnect" as const;
}

async function activatePairedWhatsAppRuntime(input: {
  jobId: string;
  tenantId: string;
}) {
  try {
    const result = await activateTenantWhatsAppAfterPairing({
      createdByType: "system",
      tenantId: input.tenantId,
    });

    if (result.changed && result.desiredStateVersion) {
      await appendJobEvent(
        input.jobId,
        "whatsapp_runtime_activation_queued",
        "WhatsApp pairing succeeded. Otto is now activating WhatsApp in the tenant runtime.",
        {
          desiredStateVersion: result.desiredStateVersion,
        },
      );
    } else {
      await appendJobEvent(
        input.jobId,
        "whatsapp_runtime_activation_skipped",
        "WhatsApp pairing succeeded and the tenant runtime was already configured.",
      );
    }

    return {
      runtimeActivationError: null,
    };
  } catch (error) {
    const message = getErrorMessage(error);
    await markIntegrationStatus(input.tenantId, "apply_failed", message);
    await appendJobEvent(
      input.jobId,
      "whatsapp_runtime_activation_warning",
      "WhatsApp paired successfully, but Otto could not activate it in the tenant runtime yet.",
      {
        error: message,
      },
    );

    return {
      runtimeActivationError: message,
    };
  }
}

async function ensureWhatsAppRuntimeConnected(
  runtimeConnection: Awaited<ReturnType<typeof getTenantRuntimeConnection>>,
) {
  let lastStatus: Awaited<
    ReturnType<typeof runtimeManager.readWhatsAppLinkStatus>
  > | null = null;
  let restartedGateway = false;

  for (
    let attempt = 0;
    attempt < LINK_STATUS_VERIFICATION_ATTEMPTS;
    attempt += 1
  ) {
    if (attempt > 0) {
      await sleep(LINK_STATUS_VERIFICATION_DELAY_MS);
    }

    try {
      const status =
        await runtimeManager.readWhatsAppLinkStatus(runtimeConnection);
      lastStatus = status;
      if (status.connected) {
        return status;
      }

      if (!restartedGateway && status.linked) {
        console.info(
          `[worker][whatsapp] restarting gateway after helper completion linked=${status.linked} running=${status.running} connected=${status.connected}`,
        );
        await runtimeManager.restartGatewayContainer(runtimeConnection);
        restartedGateway = true;
      }
    } catch {
      // The gateway may still be settling after QR pairing; keep probing.
    }
  }

  return lastStatus;
}

async function getLinkSession(linkSessionId: string) {
  const db = getDb();
  const [linkSession] = await db
    .select({
      forceRelink: whatsappLinkSessions.forceRelink,
      id: whatsappLinkSessions.id,
      tenantIntegrationId: whatsappLinkSessions.tenantIntegrationId,
    })
    .from(whatsappLinkSessions)
    .where(eq(whatsappLinkSessions.id, linkSessionId))
    .limit(1);

  return linkSession ?? null;
}

async function markLinkSessionStatus(
  linkSessionId: string,
  input: {
    completedAt?: Date | null;
    expiresAt?: Date | null;
    lastError?: string | null;
    qrDataUrl?: string | null;
    status: string;
  },
) {
  const db = getDb();

  await db
    .update(whatsappLinkSessions)
    .set({
      ...(input.completedAt !== undefined
        ? { completedAt: input.completedAt }
        : {}),
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
      ...(input.lastError !== undefined ? { lastError: input.lastError } : {}),
      ...(input.qrDataUrl !== undefined ? { qrDataUrl: input.qrDataUrl } : {}),
      status: input.status,
      updatedAt: new Date(),
    })
    .where(eq(whatsappLinkSessions.id, linkSessionId));
}

async function markIntegrationStatus(
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
        eq(tenantIntegrations.providerKey, WHATSAPP_PROVIDER_KEY),
      ),
    );
}

async function completeLinkSession(input: {
  integrationStatus: "activating" | "connected";
  linkSessionId: string;
  selfE164: string | null;
  selfJid: string | null;
  tenantId: string;
}) {
  const db = getDb();
  const now = new Date();

  await db.transaction(async (tx) => {
    const [integration] = await tx
      .select({
        id: tenantIntegrations.id,
      })
      .from(tenantIntegrations)
      .where(
        and(
          eq(tenantIntegrations.tenantId, input.tenantId),
          eq(tenantIntegrations.providerKey, WHATSAPP_PROVIDER_KEY),
        ),
      )
      .limit(1);

    if (!integration) {
      throw new Error("WhatsApp integration not found");
    }

    const [existingInstallation] = await tx
      .select({
        id: whatsappInstallations.id,
      })
      .from(whatsappInstallations)
      .where(eq(whatsappInstallations.tenantIntegrationId, integration.id))
      .limit(1);

    if (existingInstallation) {
      await tx
        .update(whatsappInstallations)
        .set({
          lastSeenAt: now,
          linkedAt: now,
          selfE164: input.selfE164,
          selfJid: input.selfJid,
          updatedAt: now,
        })
        .where(eq(whatsappInstallations.id, existingInstallation.id));
    } else {
      await tx.insert(whatsappInstallations).values({
        lastSeenAt: now,
        linkedAt: now,
        selfE164: input.selfE164,
        selfJid: input.selfJid,
        tenantIntegrationId: integration.id,
      });
    }

    await tx
      .update(tenantIntegrations)
      .set({
        connectedAt: input.integrationStatus === "connected" ? now : null,
        disconnectedAt: null,
        lastError: null,
        lastErrorAt: null,
        status: input.integrationStatus,
        updatedAt: now,
      })
      .where(eq(tenantIntegrations.id, integration.id));

    await tx
      .update(whatsappLinkSessions)
      .set({
        completedAt: now,
        expiresAt: null,
        lastError: null,
        status: "connected",
        updatedAt: now,
      })
      .where(eq(whatsappLinkSessions.id, input.linkSessionId));
  });
}

async function failLinkSession(input: {
  error: string;
  linkSessionId: string;
  tenantId: string;
}) {
  const db = getDb();
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(whatsappLinkSessions)
      .set({
        completedAt: now,
        lastError: input.error,
        status: "failed",
        updatedAt: now,
      })
      .where(eq(whatsappLinkSessions.id, input.linkSessionId));

    await tx
      .update(tenantIntegrations)
      .set({
        lastError: input.error,
        lastErrorAt: now,
        status: "link_failed",
        updatedAt: now,
      })
      .where(
        and(
          eq(tenantIntegrations.tenantId, input.tenantId),
          eq(tenantIntegrations.providerKey, WHATSAPP_PROVIDER_KEY),
        ),
      );
  });
}

async function markWhatsAppDisconnected(tenantId: string) {
  const db = getDb();
  const now = new Date();

  await db.transaction(async (tx) => {
    const [integration] = await tx
      .select({
        id: tenantIntegrations.id,
      })
      .from(tenantIntegrations)
      .where(
        and(
          eq(tenantIntegrations.tenantId, tenantId),
          eq(tenantIntegrations.providerKey, WHATSAPP_PROVIDER_KEY),
        ),
      )
      .limit(1);

    if (!integration) {
      return;
    }

    await tx
      .update(whatsappInstallations)
      .set({
        lastSeenAt: now,
        linkedAt: null,
        selfE164: null,
        selfJid: null,
        updatedAt: now,
      })
      .where(eq(whatsappInstallations.tenantIntegrationId, integration.id));

    await tx
      .update(tenantIntegrations)
      .set({
        connectedAt: null,
        disconnectedAt: now,
        lastError: null,
        lastErrorAt: null,
        status: "disconnected",
        updatedAt: now,
      })
      .where(eq(tenantIntegrations.id, integration.id));
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown WhatsApp job error";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatInactiveWhatsAppRuntimeMessage(
  status: {
    connected: boolean;
    lastError: string | null;
    linked: boolean;
    running: boolean;
  },
  baseMessage: string,
) {
  const detailParts = [
    `linked=${status.linked ? "true" : "false"}`,
    `running=${status.running ? "true" : "false"}`,
    `connected=${status.connected ? "true" : "false"}`,
  ];

  if (status.lastError) {
    detailParts.push(`lastError=${status.lastError}`);
  }

  return `${baseMessage} Runtime status: ${detailParts.join(", ")}`;
}

function summarizeWhatsAppHelperEvents(
  events: Array<{ at?: string; message?: string }> | undefined,
) {
  if (!Array.isArray(events) || events.length === 0) {
    return null;
  }

  return events
    .map((event) => {
      const message =
        typeof event?.message === "string" ? event.message.trim() : "";
      if (!message) {
        return null;
      }

      const at = typeof event?.at === "string" ? event.at.trim() : "";
      return at ? `${at} ${message}` : message;
    })
    .filter((value): value is string => Boolean(value))
    .slice(-5)
    .join(" | ");
}

function getWhatsAppLinkedIdentity(value: unknown): WhatsAppLinkedIdentity {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      selfE164: null,
      selfJid: null,
    };
  }

  const record = value as Record<string, unknown>;

  return {
    selfE164:
      typeof record.e164 === "string" && record.e164.trim().length > 0
        ? record.e164.trim()
        : null,
    selfJid:
      typeof record.jid === "string" && record.jid.trim().length > 0
        ? record.jid.trim()
        : null,
  };
}
