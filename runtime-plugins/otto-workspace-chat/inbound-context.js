import {
  WORKSPACE_CHAT_CHANNEL_ID,
  WORKSPACE_CHAT_DEFAULT_ACCOUNT_ID,
} from "./channel-config.js";
import { buildWorkspaceTarget } from "./target.js";

const DEFAULT_CONVERSATION_LABEL_PREFIX = "Workspace conversation";

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
      Provider: WORKSPACE_CHAT_CHANNEL_ID,
      RawBody: input.message,
      SenderId: senderExternalId,
      SenderName: senderDisplayName,
      SessionKey: route.sessionKey,
      Surface: WORKSPACE_CHAT_CHANNEL_ID,
      Timestamp: timestamp,
      To: target,
    }),
    route,
    sessionKey: route.sessionKey,
    storePath,
    target,
  };
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
