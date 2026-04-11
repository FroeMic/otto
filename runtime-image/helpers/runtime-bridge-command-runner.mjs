#!/usr/bin/env node

import { spawn } from "node:child_process";

const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_TIMEOUT_MS = 15_000;
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
  const target = `workspace:${command.payload.conversationId}`;
  const args = [
    "dist/index.js",
    "agent",
    "--message",
    command.payload.message,
    "--to",
    target,
    "--channel",
    WORKSPACE_CHAT_CHANNEL_ID,
    "--reply-channel",
    WORKSPACE_CHAT_CHANNEL_ID,
    "--reply-to",
    target,
    "--deliver",
    "--json",
  ];

  return await new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: "/app",
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      const completedAt = new Date().toISOString();
      if (typeof code === "number" && code === 0) {
        resolve({
          completedAt,
          exitCode: code,
          status: "succeeded",
          stderr: stderr.trim() || undefined,
          stdout: stdout.trim() || undefined,
        });
        return;
      }

      resolve({
        completedAt,
        error:
          stderr.trim() ||
          stdout.trim() ||
          `Bridge command exited with code ${String(code)}`,
        exitCode: typeof code === "number" ? code : undefined,
        status: "failed",
        stderr: stderr.trim() || undefined,
        stdout: stdout.trim() || undefined,
      });
    });

    child.on("error", (error) => {
      resolve({
        completedAt: new Date().toISOString(),
        error: error.message,
        status: "failed",
      });
    });
  });
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
