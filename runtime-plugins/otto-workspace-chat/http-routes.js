import { prepareWorkspaceChatInboundTurn } from "./inbound-dispatch.js";

export const WORKSPACE_CHAT_HTTP_INGRESS_PATH = "/otto/workspace-chat/events";

export function registerWorkspaceChatPluginHttpRoutes(api, dependencies = {}) {
  api.registerHttpRoute({
    auth: "gateway",
    handler: async (req, res) =>
      await handleWorkspaceChatHttpRequest(req, res, {
        cfg: api.config ?? {},
        dispatchInboundReplyWithBase: dependencies.dispatchInboundReplyWithBase,
        runtime: api.runtime,
      }),
    path: WORKSPACE_CHAT_HTTP_INGRESS_PATH,
  });
}

export async function handleWorkspaceChatHttpRequest(req, res, dependencies) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Method Not Allowed" }));
    return true;
  }

  try {
    const params = parseWorkspaceChatIngressPayload(await readJsonBody(req));

    console.info("[workspace-chat] http ingress received", {
      assistantMessageId: params.assistantMessageId ?? null,
      conversationId: params.conversationId,
      partsCount: params.parts.length,
      senderExternalId: params.senderExternalId,
      userMessageId: params.userMessageId ?? null,
    });

    const acceptedTurn = await prepareWorkspaceChatInboundTurn(params, {
      cfg: dependencies.cfg ?? {},
      dispatchInboundReplyWithBase: dependencies.dispatchInboundReplyWithBase,
      fetchAttachment: dependencies.fetchAttachment,
      runtime: dependencies.runtime,
    });

    queueMicrotask(() => {
      void acceptedTurn.run().catch((error) => {
        console.error("[workspace-chat] accepted turn execution rejected", {
          assistantMessageId: params.assistantMessageId ?? null,
          conversationId: params.conversationId,
          error: getErrorMessage(error),
          sessionKey: acceptedTurn.sessionKey,
        });
      });
    });

    console.info("[workspace-chat] http ingress accepted", {
      assistantMessageId: params.assistantMessageId ?? null,
      conversationId: params.conversationId,
      sessionKey: acceptedTurn.sessionKey,
    });

    res.statusCode = 202;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        accepted: true,
        ok: true,
        sessionKey: acceptedTurn.sessionKey,
      }),
    );
    return true;
  } catch (error) {
    const message = getErrorMessage(error);

    console.error("[workspace-chat] http ingress failed", {
      error: message,
    });

    const statusCode =
      error instanceof Error &&
      (error.message === "conversationId required" ||
        error.message === "parts required")
        ? 400
        : 500;

    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: message }));
    return true;
  }
}

function parseWorkspaceChatIngressPayload(params) {
  const conversationId =
    typeof params?.conversationId === "string" ? params.conversationId.trim() : "";
  const assistantMessageId =
    typeof params?.assistantMessageId === "string" &&
    params.assistantMessageId.trim().length > 0
      ? params.assistantMessageId.trim()
      : undefined;
  const conversationKind =
    params?.conversationKind === "ad_hoc" ||
    params?.conversationKind === "durable_named" ||
    params?.conversationKind === "external_surface"
      ? params.conversationKind
      : "ad_hoc";
  const conversationTitle =
    typeof params?.conversationTitle === "string" &&
    params.conversationTitle.trim().length > 0
      ? params.conversationTitle.trim()
      : `Workspace conversation ${conversationId || "unknown"}`;
  const conversationVisibility =
    params?.conversationVisibility === "personal" ? "personal" : "open";
  const parts = Array.isArray(params?.parts)
    ? params.parts
        .map((part) => normalizeWorkspaceChatIngressPart(part))
        .filter(Boolean)
    : [];
  const senderDisplayName =
    typeof params?.senderDisplayName === "string" &&
    params.senderDisplayName.trim().length > 0
      ? params.senderDisplayName.trim()
      : "Workspace user";
  const senderExternalId =
    typeof params?.senderExternalId === "string" &&
    params.senderExternalId.trim().length > 0
      ? params.senderExternalId.trim()
      : "workspace-user";
  const userMessageId =
    typeof params?.userMessageId === "string" && params.userMessageId.trim().length > 0
      ? params.userMessageId.trim()
      : undefined;

  if (!conversationId) {
    throw new Error("conversationId required");
  }

  if (parts.length === 0) {
    throw new Error("parts required");
  }

  return {
    ...(assistantMessageId ? { assistantMessageId } : {}),
    conversationKind,
    conversationId,
    conversationTitle,
    conversationVisibility,
    parts,
    senderDisplayName,
    senderExternalId,
    ...(userMessageId ? { userMessageId } : {}),
  };
}

async function readJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");

  if (raw.trim().length === 0) {
    return {};
  }

  return JSON.parse(raw);
}

function getErrorMessage(error) {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "Workspace chat ingress failed";
}

function normalizeWorkspaceChatIngressPart(part) {
  if (part?.type === "text" && typeof part.text === "string") {
    const text = part.text.trim();

    return text
      ? {
          text,
          type: "text",
        }
      : null;
  }

  if (
    part?.type === "file" &&
    typeof part.attachmentId === "string" &&
    typeof part.fileName === "string" &&
    typeof part.mimeType === "string"
  ) {
    const attachmentId = part.attachmentId.trim();
    const fileName = part.fileName.trim();
    const mimeType = part.mimeType.trim();

    return attachmentId && fileName && mimeType
      ? {
          attachmentId,
          fileName,
          mimeType,
          type: "file",
        }
      : null;
  }

  if (
    part?.type === "audio" &&
    typeof part.attachmentId === "string" &&
    typeof part.mimeType === "string"
  ) {
    const attachmentId = part.attachmentId.trim();
    const mimeType = part.mimeType.trim();
    const transcript =
      typeof part.transcript === "string" && part.transcript.trim().length > 0
        ? part.transcript.trim()
        : undefined;

    return attachmentId && mimeType
      ? {
          attachmentId,
          ...(typeof part.durationMs === "number" ? { durationMs: part.durationMs } : {}),
          mimeType,
          ...(transcript ? { transcript } : {}),
          type: "audio",
        }
      : null;
  }

  return null;
}
