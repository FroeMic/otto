#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "/app/dist/index.js";
import {
  resolveAgentDir,
  resolveAgentEffectiveModelPrimary,
  resolveAgentWorkspaceDir,
  resolveDefaultAgentId,
} from "/app/dist/agents/agent-scope.js";
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "/app/dist/agents/defaults.js";
import { parseModelRef } from "/app/dist/agents/model-selection.js";
import { runEmbeddedPiAgent } from "/app/dist/agents/pi-embedded.js";
import {
  buildWorkspaceChatCompletionParts,
  createWorkspaceChatStreamReporter,
} from "./workspace-chat-stream-reporter.mjs";

const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_WORKSPACE_CHAT_RUN_TIMEOUT_MS = 120_000;
const WORKSPACE_CHAT_CHANNEL_ID = "otto-workspace-chat";

const controlPlaneBaseUrl = normalizeBaseUrl(
  process.env.OTTO_CONTROL_PLANE_BASE_URL || "",
);
const tenantToken = (process.env.TENANT_TOKEN || "").trim();
const bridgeId = resolveBridgeId();
const pollIntervalMs = resolvePositiveInt(
  process.env.OTTO_RUNTIME_BRIDGE_COMMAND_POLL_INTERVAL_MS,
  DEFAULT_POLL_INTERVAL_MS,
);
const workspaceChatRunTimeoutMs = resolvePositiveInt(
  process.env.OTTO_WORKSPACE_CHAT_RUN_TIMEOUT_MS,
  DEFAULT_WORKSPACE_CHAT_RUN_TIMEOUT_MS,
);

let stopped = false;

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

if (!controlPlaneBaseUrl || !tenantToken) {
  console.info(
    "[otto-runtime-bridge] command runner disabled: missing TENANT_TOKEN or OTTO_CONTROL_PLANE_BASE_URL",
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(
    "[otto-runtime-bridge] command runner crashed",
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});

async function main() {
  while (!stopped) {
    try {
      const command = await claimNextCommand();
      if (!command) {
        await sleep(pollIntervalMs);
        continue;
      }

      const result = await executeCommand(command);
      await completeCommand(command.commandId, result);
    } catch (error) {
      console.error(
        "[otto-runtime-bridge] command processing failed",
        error instanceof Error ? error.message : String(error),
      );
      await sleep(pollIntervalMs);
    }
  }
}

function shutdown() {
  stopped = true;
}

async function claimNextCommand() {
  const payload = await requestControlPlane({
    body: {
      bridgeId,
    },
    method: "POST",
    path: "/api/internal/runtime/bridge/commands/claim",
  });

  return payload?.command ?? null;
}

async function completeCommand(commandId, result) {
  await requestControlPlane({
    body: {
      result,
    },
    method: "POST",
    path: `/api/internal/runtime/bridge/commands/${encodeURIComponent(commandId)}/complete`,
  });
}

async function executeCommand(command) {
  if (command.commandType !== "conversation.trigger_message") {
    return {
      completedAt: new Date().toISOString(),
      error: `Unsupported tenant bridge command type: ${String(command.commandType)}`,
      status: "failed",
    };
  }

  return await executeWorkspaceConversationTrigger(command);
}

async function executeWorkspaceConversationTrigger(command) {
  const assistantMessageId = String(command.payload.assistantMessageId || "").trim();
  if (!assistantMessageId) {
    return {
      completedAt: new Date().toISOString(),
      error: "Workspace chat bridge command is missing assistantMessageId.",
      status: "failed",
    };
  }

  const target = buildWorkspaceTarget(
    command.payload.conversationId,
    assistantMessageId,
  );
  const cfg = await loadConfig();
  const agentId = resolveDefaultAgentId(cfg);
  const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
  const agentDir = resolveAgentDir(cfg, agentId);
  const modelRef = resolveAgentEffectiveModelPrimary(cfg, agentId);
  const parsedModel = modelRef
    ? parseModelRef(modelRef, DEFAULT_PROVIDER)
    : null;
  const provider = parsedModel?.provider ?? DEFAULT_PROVIDER;
  const model = parsedModel?.model ?? DEFAULT_MODEL;
  const sessionId = `workspace-chat-${randomUUID()}`;
  const runId = `workspace-chat-run-${randomUUID()}`;
  const startedAt = new Date().toISOString();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "otto-workspace-chat-"));
  const sessionFile = path.join(tempDir, "session.jsonl");
  const reporter = createWorkspaceChatStreamReporter({
    sendDelta: async ({ sequence, text }) => {
      await requestControlPlane({
        body: {
          assistantDisplayName: "Otto",
          assistantMessageId,
          conversationId: command.payload.conversationId,
          message: {
            text,
          },
          sequence,
        },
        method: "POST",
        path: "/api/internal/runtime/workspace-chat/messages/delta",
      });
    },
  });

  try {
    const result = await runEmbeddedPiAgent({
      agentId,
      agentDir,
      config: cfg,
      messageChannel: WORKSPACE_CHAT_CHANNEL_ID,
      messageTo: target,
      onPartialReply: async (payload) => {
        if (typeof payload?.text === "string") {
          reporter.push(payload.text);
        }
      },
      prompt: command.payload.message,
      provider,
      runId,
      sessionFile,
      sessionId,
      sessionKey: target,
      timeoutMs: workspaceChatRunTimeoutMs,
      workspaceDir,
    });

    await reporter.flush();

    const parts = buildWorkspaceChatCompletionParts(result.payloads);
    if (parts.length === 0) {
      return {
        completedAt: new Date().toISOString(),
        error: "Workspace chat run completed without a visible assistant reply.",
        status: "failed",
      };
    }

    const completedAt = new Date().toISOString();
    const completionResponse = await requestControlPlane({
      body: {
        assistantDisplayName: "Otto",
        assistantMessageId,
        conversationId: command.payload.conversationId,
        message: {
          parts,
        },
        session: {
          endedAt: completedAt,
          externalSessionId: result.meta?.agentMeta?.sessionId,
          sessionKey: target,
          startedAt,
          status: "completed",
        },
      },
      method: "POST",
      path: "/api/internal/runtime/workspace-chat/messages/complete",
    });

    return {
      completedAt,
      status: "succeeded",
      stdout: JSON.stringify({
        conversationId: completionResponse?.conversationId,
        messageId: completionResponse?.messageId,
        runId,
        sessionId: result.meta?.agentMeta?.sessionId,
      }),
    };
  } catch (error) {
    await reporter.flush();
    return {
      completedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      status: "failed",
    };
  } finally {
    await fs.rm(tempDir, { force: true, recursive: true });
  }
}

function buildWorkspaceTarget(conversationId, assistantMessageId) {
  const normalizedConversationId = String(conversationId || "").trim();
  const normalizedAssistantMessageId = String(assistantMessageId || "").trim();

  if (!normalizedConversationId) {
    return "workspace:";
  }

  if (!normalizedAssistantMessageId) {
    return `workspace:${normalizedConversationId}`;
  }

  const params = new URLSearchParams({
    assistantMessageId: normalizedAssistantMessageId,
  });

  return `workspace:${normalizedConversationId}?${params.toString()}`;
}

async function requestControlPlane(input) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${controlPlaneBaseUrl}${input.path}`, {
      body: input.body ? JSON.stringify(input.body) : undefined,
      headers: {
        authorization: `Bearer ${tenantToken}`,
        "content-type": "application/json",
      },
      method: input.method,
      signal: controller.signal,
    });
    const payload = await parseJsonResponse(response);

    if (!response.ok) {
      throw new Error(
        payload?.error ||
          `tenant bridge command request failed with status ${response.status}`,
      );
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function parseJsonResponse(response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const text = await response.text();
    return text ? { error: text } : {};
  }

  return await response.json();
}

function normalizeBaseUrl(value) {
  const normalized = value.trim().replace(/\/+$/, "");
  return normalized || null;
}

function resolveBridgeId() {
  const hostname = (process.env.HOSTNAME || "").trim();
  return hostname ? `runtime-bridge:${hostname}` : "runtime-bridge:local";
}

function resolvePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value || "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
