import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  tenantIntegrations,
  tenantServers,
  tenants,
  whatsappInstallations,
  whatsappLinkSessions,
} from "@/db/schema";
import { getEnv } from "@/lib/env";
import { RuntimeManager } from "@/lib/runtime/manager";

import { appendJobEvent, markJobFailed, markJobSucceeded } from "./queue";
import type {
  ClaimedJob,
  WhatsAppDisconnectPayload,
  WhatsAppLinkSessionPayload,
} from "./types";
import { JOB_TYPES } from "./types";

const runtimeManager = new RuntimeManager();
const WHATSAPP_PROVIDER_KEY = "whatsapp";
const LINK_START_TIMEOUT_MS = 30_000;
const LINK_WAIT_TIMEOUT_MS = 120_000;

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
      getTenantRuntimeConnection(payload.tenantId),
      getLinkSession(payload.linkSessionId),
    ]);

    if (!linkSession) {
      throw new Error("WhatsApp link session not found");
    }

    await markLinkSessionStatus(payload.linkSessionId, {
      status: "starting",
    });
    await markIntegrationStatus(payload.tenantId, "linking");

    const startResponse = await runtimeManager.invokeGatewayTool(
      runtimeConnection,
      {
        action: "start",
        args: {
          force: linkSession.forceRelink,
          timeoutMs: LINK_START_TIMEOUT_MS,
        },
        tool: "whatsapp_login",
      },
    );
    const startResult = parseGatewayToolResult(startResponse);
    const startText = getGatewayToolText(startResult.result);
    const qrDataUrl = extractQrDataUrl(startText);

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
      const selfId = await runtimeManager.readWhatsAppSelfId(runtimeConnection);
      await completeLinkSession({
        linkSessionId: payload.linkSessionId,
        selfE164: selfId.e164 ?? null,
        selfJid: selfId.jid ?? null,
        tenantId: payload.tenantId,
      });
      await appendJobEvent(
        job.id,
        "whatsapp_already_linked",
        "WhatsApp was already linked",
      );
      await markJobSucceeded(job.id, {
        alreadyLinked: true,
        linkSessionId: payload.linkSessionId,
      });
      return;
    } else {
      throw new Error(startText || "WhatsApp QR code was not returned");
    }

    const waitResponse = await runtimeManager.invokeGatewayTool(
      runtimeConnection,
      {
        action: "wait",
        args: {
          timeoutMs: LINK_WAIT_TIMEOUT_MS,
        },
        tool: "whatsapp_login",
      },
    );
    const waitResult = parseGatewayToolResult(waitResponse);
    const waitText = getGatewayToolText(waitResult.result);
    const connected = getGatewayToolConnected(waitResult.result);

    if (!connected) {
      await failLinkSession({
        error: waitText || "WhatsApp QR scan timed out",
        linkSessionId: payload.linkSessionId,
        tenantId: payload.tenantId,
      });
      await appendJobEvent(
        job.id,
        "whatsapp_link_failed",
        "WhatsApp linking did not complete",
        {
          error: waitText,
        },
      );
      await markJobFailed(
        job.id,
        waitText || "WhatsApp linking did not complete",
      );
      return;
    }

    const selfId = await runtimeManager.readWhatsAppSelfId(runtimeConnection);
    await completeLinkSession({
      linkSessionId: payload.linkSessionId,
      selfE164: selfId.e164 ?? null,
      selfJid: selfId.jid ?? null,
      tenantId: payload.tenantId,
    });
    await appendJobEvent(
      job.id,
      "whatsapp_connected",
      "WhatsApp linked successfully",
      {
        selfE164: selfId.e164 ?? null,
      },
    );
    await markJobSucceeded(job.id, {
      linkSessionId: payload.linkSessionId,
      selfE164: selfId.e164 ?? null,
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
    );
    await runtimeManager.logoutWhatsApp(runtimeConnection);
    await markWhatsAppDisconnected(payload.tenantId);
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

  if (typeof tenantId !== "string" || tenantId.length === 0) {
    throw new Error("WhatsApp disconnect job payload is missing tenantId");
  }

  return {
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
    throw new Error("Tenant server IP is missing for WhatsApp jobs");
  }

  if (
    tenantServer.serverStatus !== "ready" ||
    tenantServer.tenantStatus !== "ready"
  ) {
    throw new Error("WhatsApp jobs require a ready tenant runtime");
  }

  return {
    host: tenantServer.ipv4,
    port: getEnv().RUNTIME_SSH_PORT,
    username: tenantServer.sshUsername ?? getEnv().RUNTIME_SSH_USERNAME,
  };
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
        connectedAt: now,
        disconnectedAt: null,
        lastError: null,
        lastErrorAt: null,
        status: "connected",
        updatedAt: now,
      })
      .where(eq(tenantIntegrations.id, integration.id));

    await tx
      .update(whatsappLinkSessions)
      .set({
        completedAt: now,
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

function parseGatewayToolResult(response: Record<string, unknown>) {
  if (response.ok !== true) {
    const error = response.error;

    if (error && typeof error === "object" && !Array.isArray(error)) {
      const message = (error as { message?: unknown }).message;

      throw new Error(
        typeof message === "string"
          ? message
          : "Tenant runtime rejected the WhatsApp tool request",
      );
    }

    throw new Error("Tenant runtime rejected the WhatsApp tool request");
  }

  const result = response.result;

  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("Tenant runtime returned an invalid WhatsApp tool result");
  }

  return {
    result: result as Record<string, unknown>,
  };
}

function getGatewayToolText(result: Record<string, unknown>) {
  const content = result.content;

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return "";
      }

      const maybeText = (entry as { text?: unknown }).text;
      return typeof maybeText === "string" ? maybeText : "";
    })
    .filter(Boolean)
    .join("\n");
}

function getGatewayToolConnected(result: Record<string, unknown>) {
  const details = result.details;

  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return false;
  }

  return Boolean((details as { connected?: unknown }).connected);
}

function extractQrDataUrl(text: string) {
  const match = text.match(
    /!\[whatsapp-qr\]\((data:image\/png;base64,[^)]+)\)/,
  );

  return match?.[1] ?? null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown WhatsApp job error";
}
