import { createWorkspaceChatActivityEventReporter } from "./activity-events.js";
import { sendWorkspaceChatFailure } from "./control-plane-client.js";
import { buildWorkspaceChatInboundContext } from "./inbound-context.js";
import { createWorkspaceChatReplyDispatcher } from "./reply-dispatcher.js";

const DEFAULT_ASSISTANT_NAME = "Otto";

export function prepareWorkspaceChatInboundTurn(input, dependencies) {
  const prepared = buildPreparedTurn(input, dependencies);

  const run = async () => {
    await runWorkspaceChatInboundTurn({
      assistantDisplayName: prepared.assistantDisplayName,
      dispatchInboundReply: prepared.dispatchInboundReply,
      inbound: prepared.inbound,
      input,
      replyDispatcher: prepared.replyDispatcher,
      rethrowOnFailure: false,
      runtime: prepared.runtime,
    });
  };

  return {
    accepted: true,
    ok: true,
    run,
    sessionKey: prepared.inbound.sessionKey,
  };
}

export async function dispatchWorkspaceChatInboundTurn(input, dependencies) {
  const prepared = buildPreparedTurn(input, dependencies);

  await runWorkspaceChatInboundTurn({
    assistantDisplayName: prepared.assistantDisplayName,
    dispatchInboundReply: prepared.dispatchInboundReply,
    inbound: prepared.inbound,
    input,
    replyDispatcher: prepared.replyDispatcher,
    rethrowOnFailure: true,
    runtime: prepared.runtime,
  });

  return {
    ok: true,
    sessionKey: prepared.inbound.sessionKey,
  };
}

async function runWorkspaceChatInboundTurn({
  assistantDisplayName,
  dispatchInboundReply,
  inbound,
  input,
  replyDispatcher,
  rethrowOnFailure,
  runtime,
}) {
  console.info("[workspace-chat] plugin turn starting", {
    agentId: inbound.route.agentId,
    assistantMessageId: input.assistantMessageId ?? null,
    conversationId: input.conversationId,
    senderExternalId: input.senderExternalId,
    sessionKey: inbound.sessionKey,
    target: inbound.target,
  });

  const activityEventReporter = createWorkspaceChatActivityEventReporter({
    assistantMessageId: input.assistantMessageId,
    conversationId: input.conversationId,
    runtime,
    sessionKey: inbound.sessionKey,
  });

  try {
    await dispatchInboundReply({
      accountId: inbound.accountId,
      cfg: inbound.cfg,
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

    await activityEventReporter.flush();
    await replyDispatcher.sendCompletion();

    console.info("[workspace-chat] plugin completion sent", {
      assistantMessageId: input.assistantMessageId ?? null,
      conversationId: input.conversationId,
      sessionKey: inbound.sessionKey,
    });
  } catch (error) {
    const message = getErrorMessage(error);

    console.error("[workspace-chat] plugin turn failed", {
      assistantMessageId: input.assistantMessageId ?? null,
      conversationId: input.conversationId,
      error: message,
      sessionKey: inbound.sessionKey,
    });

    try {
      await sendWorkspaceChatFailure({
        assistantDisplayName,
        assistantMessageId: input.assistantMessageId,
        conversationId: input.conversationId,
        error: message,
      });
    } catch (callbackError) {
      console.error("[workspace-chat] plugin failure callback failed", {
        assistantMessageId: input.assistantMessageId ?? null,
        callbackError: getErrorMessage(callbackError),
        conversationId: input.conversationId,
        error: message,
        sessionKey: inbound.sessionKey,
      });
    }

    if (rethrowOnFailure) {
      throw error;
    }
  } finally {
    try {
      await activityEventReporter.flush();
    } catch (error) {
      console.error("[workspace-chat] plugin activity event flush failed", {
        assistantMessageId: input.assistantMessageId ?? null,
        conversationId: input.conversationId,
        error: getErrorMessage(error),
        sessionKey: inbound.sessionKey,
      });
    }

    activityEventReporter.stop();
  }
}

function buildPreparedTurn(input, dependencies) {
  const cfg = dependencies.cfg ?? {};
  const runtime = dependencies.runtime;
  const dispatchInboundReply = dependencies.dispatchInboundReplyWithBase;

  if (typeof dispatchInboundReply !== "function") {
    throw new Error(
      "Workspace chat inbound dispatch requires dispatchInboundReplyWithBase",
    );
  }

  const assistantDisplayName =
    typeof input.assistantDisplayName === "string" &&
    input.assistantDisplayName.trim().length > 0
      ? input.assistantDisplayName.trim()
      : DEFAULT_ASSISTANT_NAME;
  const inbound = buildWorkspaceChatInboundContext({
    assistantMessageId: input.assistantMessageId,
    cfg,
    conversationKind: input.conversationKind,
    conversationId: input.conversationId,
    conversationTitle: input.conversationTitle,
    conversationVisibility: input.conversationVisibility,
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

  return {
    assistantDisplayName,
    dispatchInboundReply,
    inbound: {
      ...inbound,
      cfg,
    },
    replyDispatcher,
    runtime,
  };
}

function getErrorMessage(error) {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "Workspace chat turn failed";
}
