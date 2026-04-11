import { randomUUID } from "node:crypto";

import {
  sendWorkspaceChatCompletion,
  sendWorkspaceChatDelta,
  sendWorkspaceChatFailure,
} from "./control-plane-client.js";
import { buildWorkspaceChatCompletionParts, createWorkspaceChatStreamReporter } from "./stream-reporter.js";

const WORKSPACE_CHAT_GATEWAY_METHOD = "otto.workspaceChat.runTurn";
const DEFAULT_PROVIDER = "openai";
const DEFAULT_MODEL = "gpt-5.4";
const DEFAULT_AGENT_NAME = "Otto";

export function registerWorkspaceChatGatewayMethods(api) {
  api.registerGatewayMethod(
    WORKSPACE_CHAT_GATEWAY_METHOD,
    async ({ params, respond }) => {
      try {
        const conversationId =
          typeof params?.conversationId === "string" ? params.conversationId.trim() : "";
        const message = typeof params?.message === "string" ? params.message.trim() : "";
        const assistantMessageId =
          typeof params?.assistantMessageId === "string" &&
          params.assistantMessageId.trim().length > 0
            ? params.assistantMessageId.trim()
            : undefined;

        console.info("[workspace-chat] gateway method invoked", {
          assistantMessageId: assistantMessageId ?? null,
          conversationId: conversationId || null,
          messageLength: message.length,
        });

        if (!conversationId) {
          console.warn("[workspace-chat] gateway method missing conversationId");
          respond(false, { error: "conversationId required" });
          return;
        }

        if (!message) {
          console.warn("[workspace-chat] gateway method missing message", {
            conversationId,
          });
          respond(false, { error: "message required" });
          return;
        }

        const result = await runWorkspaceChatTurn({
          ...(assistantMessageId ? { assistantMessageId } : {}),
          cfg: api.config,
          conversationId,
          message,
          runtime: api.runtime,
        });

        console.info("[workspace-chat] gateway method completed", {
          assistantMessageId: assistantMessageId ?? null,
          conversationId,
          sessionKey: result.sessionKey,
        });
        respond(true, result);
      } catch (error) {
        console.error("[workspace-chat] gateway method failed", {
          error: getErrorMessage(error),
        });
        respond(false, { error: getErrorMessage(error) });
      }
    },
    {
      scope: "operator.write",
    },
  );
}

export async function runWorkspaceChatTurn(input) {
  const runtime = input.runtime;
  const cfg = input.cfg ?? {};
  const assistantName =
    runtime.agent.resolveAgentIdentity?.(cfg)?.name?.trim() || DEFAULT_AGENT_NAME;
  const modelRef =
    runtime.agent.defaults?.model?.trim() ||
    `${runtime.agent.defaults?.provider?.trim() || DEFAULT_PROVIDER}/${DEFAULT_MODEL}`;
  const { model, provider } = parseModelRef(
    modelRef,
    runtime.agent.defaults?.provider?.trim() || DEFAULT_PROVIDER,
  );
  const sessionId = [
    "workspace-chat",
    input.conversationId,
    input.assistantMessageId || randomUUID(),
  ].join(":");
  const sessionKey = buildWorkspaceChatSessionKey({
    assistantMessageId: input.assistantMessageId,
    conversationId: input.conversationId,
  });
  const agentDir = runtime.agent.resolveAgentDir(cfg);
  const workspaceDir = runtime.agent.resolveAgentWorkspaceDir(cfg);
  const thinkLevel = runtime.agent.resolveThinkingDefault(cfg, provider, model);
  const timeoutMs = runtime.agent.resolveAgentTimeoutMs(cfg);
  const sessionFile = runtime.agent.session.resolveSessionFilePath(cfg, sessionId);

  console.info("[workspace-chat] plugin turn starting", {
    agentDir,
    assistantMessageId: input.assistantMessageId ?? null,
    conversationId: input.conversationId,
    model,
    provider,
    sessionId,
    sessionKey,
    timeoutMs,
    workspaceDir,
  });

  await runtime.agent.ensureAgentWorkspace(cfg);
  await sendWorkspaceChatDelta({
    assistantDisplayName: assistantName,
    assistantMessageId: input.assistantMessageId,
    conversationId: input.conversationId,
    sequence: 1,
    text: "",
  });

  console.info("[workspace-chat] plugin initial delta sent", {
    assistantMessageId: input.assistantMessageId ?? null,
    conversationId: input.conversationId,
    sequence: 1,
  });

  const reporter = createWorkspaceChatStreamReporter({
    sendDelta: async ({ sequence, text }) =>
      await sendWorkspaceChatDeltaWithLogging({
        assistantDisplayName: assistantName,
        assistantMessageId: input.assistantMessageId,
        conversationId: input.conversationId,
        sequence,
        text,
      }),
    startingSequence: 2,
  });

  try {
    const result = await runtime.agent.runEmbeddedPiAgent({
      agentDir,
      config: cfg,
      lane: "chat",
      messageChannel: "otto-workspace-chat",
      messageProvider: "otto-workspace-chat",
      messageTo: sessionKey,
      model,
      onPartialReply: async (payload) => {
        await reporter.push(typeof payload?.text === "string" ? payload.text : "");
      },
      prompt: input.message,
      provider,
      runId: `workspace-chat:${input.conversationId}:${Date.now()}`,
      sessionFile,
      sessionId,
      sessionKey,
      thinkLevel,
      timeoutMs,
      verboseLevel: "off",
      workspaceDir,
    });

    await reporter.flush();

    console.info("[workspace-chat] plugin stream flushed", {
      assistantMessageId: input.assistantMessageId ?? null,
      conversationId: input.conversationId,
    });

    await sendWorkspaceChatCompletion({
      assistantDisplayName: assistantName,
      assistantMessageId: input.assistantMessageId,
      conversationId: input.conversationId,
      parts: buildWorkspaceChatCompletionParts(result.payloads),
      session: {
        externalSessionId: result.meta?.agentMeta?.sessionId,
        sessionKey,
        status: "completed",
      },
    });

    console.info("[workspace-chat] plugin completion sent", {
      assistantMessageId: input.assistantMessageId ?? null,
      conversationId: input.conversationId,
      payloadCount: Array.isArray(result.payloads) ? result.payloads.length : 0,
      sessionKey,
    });

    return {
      ok: true,
      sessionKey,
    };
  } catch (error) {
    console.error("[workspace-chat] plugin turn failed", {
      assistantMessageId: input.assistantMessageId ?? null,
      conversationId: input.conversationId,
      error: getErrorMessage(error),
      sessionKey,
    });

    await sendWorkspaceChatFailure({
      assistantDisplayName: assistantName,
      assistantMessageId: input.assistantMessageId,
      conversationId: input.conversationId,
      error: getErrorMessage(error),
    });
    throw error;
  }
}

function buildWorkspaceChatSessionKey(input) {
  const base = `workspace:${input.conversationId}`;

  if (!input.assistantMessageId) {
    return base;
  }

  return `${base}?assistantMessageId=${encodeURIComponent(input.assistantMessageId)}`;
}

function parseModelRef(modelRef, defaultProvider) {
  const normalized = String(modelRef || "").trim();

  if (!normalized) {
    return {
      model: DEFAULT_MODEL,
      provider: defaultProvider || DEFAULT_PROVIDER,
    };
  }

  const slashIndex = normalized.indexOf("/");

  if (slashIndex <= 0 || slashIndex === normalized.length - 1) {
    return {
      model: normalized,
      provider: defaultProvider || DEFAULT_PROVIDER,
    };
  }

  return {
    model: normalized.slice(slashIndex + 1).trim() || DEFAULT_MODEL,
    provider:
      normalized.slice(0, slashIndex).trim() || defaultProvider || DEFAULT_PROVIDER,
  };
}

function getErrorMessage(error) {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "Workspace chat turn failed";
}

async function sendWorkspaceChatDeltaWithLogging(input) {
  await sendWorkspaceChatDelta(input);

  console.info("[workspace-chat] plugin delta sent", {
    assistantMessageId: input.assistantMessageId ?? null,
    conversationId: input.conversationId,
    sequence: input.sequence,
    textLength: input.text.length,
  });
}
