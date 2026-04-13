import {
  WORKSPACE_CHAT_CHANNEL_ID,
  WORKSPACE_CHAT_DEFAULT_ACCOUNT_ID,
} from "./channel-config.js";
import { buildWorkspaceTarget } from "./target.js";

const DEFAULT_CONVERSATION_LABEL_PREFIX = "Workspace conversation";
const CONTROL_UI_SURFACE = "webchat";

export function buildWorkspaceChatInboundContext(input) {
  const cfg = input.cfg ?? {};
  const runtime = input.runtime;
  const timestamp = new Date().toISOString();
  const chatType = input.conversationVisibility === "personal" ? "direct" : "group";
  const target = buildWorkspaceTarget({
    assistantMessageId: input.assistantMessageId,
    conversationId: input.conversationId,
    conversationVisibility: input.conversationVisibility,
  });
  const route = runtime.channel.routing.resolveAgentRoute({
    accountId: WORKSPACE_CHAT_DEFAULT_ACCOUNT_ID,
    cfg,
    channel: WORKSPACE_CHAT_CHANNEL_ID,
    peer: {
      id: target,
      kind: chatType === "direct" ? "direct" : "channel",
    },
  });
  const storePath = runtime.channel.session.resolveStorePath(cfg.session?.store, {
    agentId: route.agentId,
  });
  const previousTimestamp = runtime.channel.session.readSessionUpdatedAt({
    sessionKey: route.sessionKey,
    storePath,
  });
  const senderDisplayName =
    normalizeOptionalString(input.senderDisplayName) ||
    normalizeOptionalString(input.senderExternalId) ||
    "Workspace user";
  const senderExternalId =
    normalizeOptionalString(input.senderExternalId) || "workspace-user";
  const conversationLabel =
    normalizeOptionalString(input.conversationTitle) ||
    `${DEFAULT_CONVERSATION_LABEL_PREFIX} ${input.conversationId}`;
  const from = buildWorkspaceChatSenderAddress({
    conversationId: input.conversationId,
    senderExternalId,
    visibility: input.conversationVisibility,
  });
  const body = runtime.channel.reply.formatAgentEnvelope({
    body: input.message,
    channel: "Workspace Chat",
    envelope: runtime.channel.reply.resolveEnvelopeFormatOptions(cfg),
    from: senderDisplayName,
    previousTimestamp,
    timestamp,
  });
  const mediaAttachments = Array.isArray(input.mediaAttachments)
    ? input.mediaAttachments.filter(isWorkspaceChatMediaAttachment)
    : [];
  const mediaPaths = mediaAttachments.map((attachment) => attachment.localPath);
  const mediaTypes = mediaAttachments.map((attachment) => attachment.mimeType);
  const transcript = normalizeOptionalString(input.transcript);

  return {
    accountId: route.accountId ?? WORKSPACE_CHAT_DEFAULT_ACCOUNT_ID,
    channel: WORKSPACE_CHAT_CHANNEL_ID,
    ctxPayload: runtime.channel.reply.finalizeInboundContext({
      AccountId: route.accountId ?? WORKSPACE_CHAT_DEFAULT_ACCOUNT_ID,
      Body: body,
      BodyForAgent: input.message,
      BodyForCommands: input.message,
      ChatType: chatType,
      CommandAuthorized: true,
      CommandBody: input.message,
      ConversationLabel: conversationLabel,
      From: from,
      GroupChannel: chatType === "group" ? input.conversationId : undefined,
      GroupSubject: chatType === "group" ? conversationLabel : undefined,
      MessageSid:
        normalizeOptionalString(input.userMessageId) ||
        `workspace-user-message:${input.conversationId}`,
      MessageSidFull:
        normalizeOptionalString(input.userMessageId) ||
        `workspace-user-message:${input.conversationId}`,
      NativeChannelId: input.conversationId,
      OriginatingChannel: WORKSPACE_CHAT_CHANNEL_ID,
      OriginatingTo: target,
      // Mark the run as a control-UI-visible surface so OpenClaw includes
      // session keys on agent events while the actual routing channel remains
      // otto-workspace-chat.
      Provider: CONTROL_UI_SURFACE,
      RawBody: input.message,
      SenderId: senderExternalId,
      SenderName: senderDisplayName,
      SessionKey: route.sessionKey,
      Surface: CONTROL_UI_SURFACE,
      Timestamp: timestamp,
      To: target,
      ...(mediaPaths.length > 0
        ? {
            MediaPath: mediaPaths[0],
            MediaPaths: mediaPaths,
            MediaType: mediaTypes[0] ?? "application/octet-stream",
            MediaTypes: mediaTypes,
          }
        : {}),
      ...(transcript ? { Transcript: transcript } : {}),
    }),
    route,
    sessionKey: route.sessionKey,
    storePath,
    target,
  };
}

function isWorkspaceChatMediaAttachment(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof value.localPath === "string" &&
    value.localPath.trim().length > 0 &&
    typeof value.mimeType === "string" &&
    value.mimeType.trim().length > 0
  );
}

function normalizeOptionalString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function buildWorkspaceChatSenderAddress(input) {
  if (input.visibility === "personal") {
    return `workspace-dm-user:${input.senderExternalId}`;
  }

  return `workspace-user:${input.senderExternalId}@${input.conversationId}`;
}
