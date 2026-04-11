import { sendWorkspaceChatFailure } from "./control-plane-client.js";
import { buildWorkspaceChatInboundContext } from "./inbound-context.js";
import { createWorkspaceChatReplyDispatcher } from "./reply-dispatcher.js";

const DEFAULT_ASSISTANT_NAME = "Otto";

export async function dispatchWorkspaceChatInboundTurn(input, dependencies) {
  const cfg = dependencies.cfg ?? {};
  const runtime = dependencies.runtime;
  const dispatchInboundReplyWithBase =
    dependencies.dispatchInboundReplyWithBase ??
    (await loadDispatchInboundReplyWithBase());
  const assistantDisplayName =
    typeof input.assistantDisplayName === "string" &&
    input.assistantDisplayName.trim().length > 0
      ? input.assistantDisplayName.trim()
      : DEFAULT_ASSISTANT_NAME;
  const inbound = buildWorkspaceChatInboundContext({
    assistantMessageId: input.assistantMessageId,
    cfg,
    conversationId: input.conversationId,
    conversationTitle: input.conversationTitle,
    message: input.message,
    runtime,
    senderDisplayName: input.senderDisplayName,
    senderExternalId: input.senderExternalId,
    userMessageId: input.userMessageId,
  });
  const replyDispatcher = createWorkspaceChatReplyDispatcher({
    assistantDisplayName,
    assistantMessageId: input.assistantMessageId,
    conversationId: input.conversationId,
    sessionKey: inbound.sessionKey,
  });

  console.info("[workspace-chat] plugin turn starting", {
    agentId: inbound.route.agentId,
    assistantMessageId: input.assistantMessageId ?? null,
    conversationId: input.conversationId,
    senderExternalId: input.senderExternalId,
    sessionKey: inbound.sessionKey,
    target: inbound.target,
  });

  try {
    await dispatchInboundReplyWithBase({
      accountId: inbound.accountId,
      cfg,
      channel: inbound.channel,
      core: runtime,
      ctxPayload: inbound.ctxPayload,
      deliver: replyDispatcher.deliver,
      onDispatchError: (error) => {
        throw error instanceof Error
          ? error
          : new Error(`workspace chat dispatch failed: ${String(error)}`);
      },
      onRecordError: (error) => {
        throw error instanceof Error
          ? error
          : new Error(`workspace chat session record failed: ${String(error)}`);
      },
      replyOptions: replyDispatcher.replyOptions,
      route: inbound.route,
      storePath: inbound.storePath,
    });

    await replyDispatcher.sendCompletion();

    console.info("[workspace-chat] plugin completion sent", {
      assistantMessageId: input.assistantMessageId ?? null,
      conversationId: input.conversationId,
      sessionKey: inbound.sessionKey,
    });

    return {
      ok: true,
      sessionKey: inbound.sessionKey,
    };
  } catch (error) {
    const message = getErrorMessage(error);

    console.error("[workspace-chat] plugin turn failed", {
      assistantMessageId: input.assistantMessageId ?? null,
      conversationId: input.conversationId,
      error: message,
      sessionKey: inbound.sessionKey,
    });

    await sendWorkspaceChatFailure({
      assistantDisplayName,
      assistantMessageId: input.assistantMessageId,
      conversationId: input.conversationId,
      error: message,
    });

    throw error;
  }
}

async function loadDispatchInboundReplyWithBase() {
  const module = await import("openclaw/plugin-sdk/inbound-reply-dispatch");
  return module.dispatchInboundReplyWithBase;
}

function getErrorMessage(error) {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "Workspace chat turn failed";
}
