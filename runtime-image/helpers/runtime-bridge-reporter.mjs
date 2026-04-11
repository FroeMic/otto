#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";

const DEFAULT_GATEWAY_PORT = "18791";
const DEFAULT_REPORT_INTERVAL_MS = 30_000;
const DEFAULT_TIMEOUT_MS = 15_000;
const EXTENSIONS_ROOT = "/app/dist/extensions";
const OPENCLAW_CONFIG_PATH = "/home/node/.openclaw/openclaw.json";

const bridgeId = resolveBridgeId();
const controlPlaneBaseUrl = normalizeBaseUrl(
  process.env.OTTO_CONTROL_PLANE_BASE_URL || "",
);
const gatewayPort = process.env.OPENCLAW_GATEWAY_PORT || DEFAULT_GATEWAY_PORT;
const tenantToken = (process.env.TENANT_TOKEN || "").trim();
const reportIntervalMs = resolvePositiveInt(
  process.env.OTTO_RUNTIME_BRIDGE_REPORT_INTERVAL_MS,
  DEFAULT_REPORT_INTERVAL_MS,
);

let stopped = false;
let timer = null;

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

if (!controlPlaneBaseUrl || !tenantToken) {
  console.info(
    "[otto-runtime-bridge] reporter disabled: missing TENANT_TOKEN or OTTO_CONTROL_PLANE_BASE_URL",
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(
    "[otto-runtime-bridge] reporter crashed",
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});

async function main() {
  await reportOnce();
  scheduleNextReport();
}

function shutdown() {
  stopped = true;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

function scheduleNextReport() {
  if (stopped) {
    return;
  }

  timer = setTimeout(async () => {
    timer = null;

    try {
      await reportOnce();
    } catch (error) {
      console.error(
        "[otto-runtime-bridge] status report failed",
        error instanceof Error ? error.message : String(error),
      );
    }

    scheduleNextReport();
  }, reportIntervalMs);
}

async function reportOnce() {
  const [installedPluginIds, enabledPluginIds, gateway] = await Promise.all([
    listInstalledPluginIds(),
    listEnabledPluginIds(),
    probeGatewayHealth(),
  ]);

  const body = {
    bridgeId,
    gateway,
    runtime: {
      controlPlaneBaseUrl,
      enabledPluginIds,
      installedPluginIds,
      sessionReporterEnabled: enabledPluginIds.includes("otto-session-reporter"),
      workspaceChatEnabled: enabledPluginIds.includes("otto-workspace-chat"),
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${controlPlaneBaseUrl}/api/internal/runtime/bridge/report`,
      {
        body: JSON.stringify(body),
        headers: {
          authorization: `Bearer ${tenantToken}`,
          "content-type": "application/json",
        },
        method: "POST",
        signal: controller.signal,
      },
    );
    const payload = await parseJsonResponse(response);

    if (!response.ok) {
      throw new Error(
        payload?.error ||
          `bridge report failed with status ${response.status}`,
      );
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function listInstalledPluginIds() {
  try {
    const entries = await readdir(EXTENSIONS_ROOT, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name.trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

async function listEnabledPluginIds() {
  try {
    const raw = await readFile(OPENCLAW_CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const entries =
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      parsed.plugins &&
      typeof parsed.plugins === "object" &&
      !Array.isArray(parsed.plugins) &&
      parsed.plugins.entries &&
      typeof parsed.plugins.entries === "object" &&
      !Array.isArray(parsed.plugins.entries)
        ? parsed.plugins.entries
        : {};

    return Object.entries(entries)
      .filter(
        ([, value]) =>
          value &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          value.enabled === true,
      )
      .map(([pluginId]) => pluginId.trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

async function probeGatewayHealth() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(
      `http://127.0.0.1:${gatewayPort}/healthz`,
      {
        method: "GET",
        signal: controller.signal,
      },
    );

    return {
      healthy: response.ok,
      port: Number.parseInt(gatewayPort, 10) || undefined,
      statusCode: response.status,
    };
  } catch {
    return {
      healthy: false,
      port: Number.parseInt(gatewayPort, 10) || undefined,
    };
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
