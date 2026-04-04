#!/usr/bin/env node

import { watch } from "node:fs";

const CONTROL_PLANE_TIMEOUT_MS = 15_000;
const DEFAULT_DEBOUNCE_MS = 1_500;
const DEFAULT_GATEWAY_PORT = "18791";
const GATEWAY_READY_POLL_MS = 2_000;
const GATEWAY_WATCH_RETRY_MS = 5_000;
const INITIAL_SYNC_RETRY_MS = 10_000;
const MAX_RUNS_PER_REQUEST = 200;
const CRON_ROOT = "/home/node/.openclaw/cron";
const CRON_JOBS_FILE = "jobs.json";
const CRON_RUNS_DIR = `${CRON_ROOT}/runs`;

const gatewayPort = process.env.OPENCLAW_GATEWAY_PORT || DEFAULT_GATEWAY_PORT;
const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN || "";
const controlPlaneBaseUrl = normalizeBaseUrl(
  process.env.OTTO_CONTROL_PLANE_BASE_URL || "",
);

let isStopping = false;
let flushTimer = null;
let flushInFlight = false;
let flushRequestedWhileBusy = false;
let initialSyncDone = false;
let initialSyncTimer = null;
let pendingTaskRefresh = false;
let rootWatcher = null;
let runsWatcher = null;
const pendingReasons = new Set();
const pendingRunJobIds = new Set();

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

if (!gatewayToken || !controlPlaneBaseUrl) {
  console.info(
    "[otto-cron-sync] watcher disabled: missing OPENCLAW_GATEWAY_TOKEN or OTTO_CONTROL_PLANE_BASE_URL",
  );
  process.exit(0);
}

main().catch((error) => {
  console.error("[otto-cron-sync] watcher crashed", getErrorMessage(error));
  process.exitCode = 1;
});

async function main() {
  await waitForGateway();
  await runInitialSync();
  startCronRootWatcher();
  startRunsWatcher();
}

async function waitForGateway() {
  while (!isStopping) {
    try {
      const response = await fetch(localGatewayUrl("/healthz"));
      if (response.ok) {
        return;
      }
    } catch {
      // keep polling until the gateway is ready
    }

    await sleep(GATEWAY_READY_POLL_MS);
  }
}

async function runInitialSync() {
  try {
    const tasks = await listCronTasks();
    const runs = [];

    for (const task of tasks) {
      if (typeof task.id !== "string" || task.id.length === 0) {
        continue;
      }

      const taskRuns = await listCronRuns(task.id);
      runs.push(...taskRuns);
    }

    await pushSnapshot({
      reason: "startup",
      runs,
      tasks,
    });
    initialSyncDone = true;
    console.info(
      `[otto-cron-sync] initial sync pushed ${tasks.length} tasks and ${runs.length} runs`,
    );
  } catch (error) {
    console.error(
      "[otto-cron-sync] initial sync failed",
      getErrorMessage(error),
    );
    scheduleInitialSyncRetry();
  }
}

function scheduleInitialSyncRetry() {
  if (isStopping || initialSyncDone || initialSyncTimer) {
    return;
  }

  initialSyncTimer = setTimeout(async () => {
    initialSyncTimer = null;
    await runInitialSync();
  }, INITIAL_SYNC_RETRY_MS);
}

function startCronRootWatcher() {
  startWatcherLoop({
    label: "cron-root",
    onEvent: (_, fileName) => {
      if (fileName === CRON_JOBS_FILE) {
        queueTaskRefresh("jobs_file_change");
        return;
      }

      if (fileName === "runs" && !runsWatcher) {
        startRunsWatcher();
      }
    },
    onWatcherReady: (watcher) => {
      rootWatcher = watcher;
    },
    path: CRON_ROOT,
  });
}

function startRunsWatcher() {
  startWatcherLoop({
    label: "cron-runs",
    onEvent: (_, fileName) => {
      if (!fileName || !fileName.endsWith(".jsonl")) {
        return;
      }

      const jobId = fileName.slice(0, -".jsonl".length).trim();
      if (!jobId) {
        return;
      }

      queueRunRefresh(jobId);
    },
    onWatcherReady: (watcher) => {
      runsWatcher = watcher;
    },
    path: CRON_RUNS_DIR,
  });
}

function startWatcherLoop(input) {
  const { label, onEvent, onWatcherReady, path } = input;

  const start = () => {
    if (isStopping) {
      return;
    }

    try {
      const watcher = watch(path, (eventType, fileName) => {
        if (isStopping) {
          return;
        }

        const normalizedFileName =
          typeof fileName === "string"
            ? fileName
            : Buffer.isBuffer(fileName)
              ? fileName.toString("utf-8")
              : "";

        try {
          onEvent(eventType, normalizedFileName);
        } catch (error) {
          console.error(
            `[otto-cron-sync] ${label} event handler failed`,
            getErrorMessage(error),
          );
        }
      });

      let restartScheduled = false;
      const scheduleRestart = () => {
        if (isStopping || restartScheduled) {
          return;
        }

        restartScheduled = true;
        try {
          watcher.close();
        } catch {
          // best effort cleanup
        }

        setTimeout(() => {
          if (label === "cron-root") {
            rootWatcher = null;
          }
          if (label === "cron-runs") {
            runsWatcher = null;
          }
          start();
        }, GATEWAY_WATCH_RETRY_MS);
      };

      watcher.on("error", (error) => {
        console.error(
          `[otto-cron-sync] ${label} watcher error`,
          getErrorMessage(error),
        );
        scheduleRestart();
      });

      watcher.on("close", () => {
        if (!isStopping) {
          scheduleRestart();
        }
      });

      onWatcherReady(watcher);
      console.info(`[otto-cron-sync] watching ${path}`);
    } catch (error) {
      console.error(
        `[otto-cron-sync] failed to watch ${path}`,
        getErrorMessage(error),
      );
      setTimeout(start, GATEWAY_WATCH_RETRY_MS);
    }
  };

  start();
}

function queueTaskRefresh(reason) {
  pendingTaskRefresh = true;
  pendingReasons.add(reason);
  scheduleFlush();
}

function queueRunRefresh(jobId) {
  pendingTaskRefresh = true;
  pendingReasons.add("run_log_change");
  pendingRunJobIds.add(jobId);
  scheduleFlush();
}

function scheduleFlush() {
  if (isStopping) {
    return;
  }

  if (flushTimer) {
    clearTimeout(flushTimer);
  }

  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushPendingChanges();
  }, DEFAULT_DEBOUNCE_MS);
}

async function flushPendingChanges() {
  if (flushInFlight) {
    flushRequestedWhileBusy = true;
    return;
  }

  if (!pendingTaskRefresh && pendingRunJobIds.size === 0) {
    return;
  }

  flushInFlight = true;

  const runJobIds = [...pendingRunJobIds];
  const reason = joinReasons(pendingReasons);

  pendingTaskRefresh = false;
  pendingReasons.clear();
  pendingRunJobIds.clear();

  try {
    const tasks = await listCronTasks();
    const runs = [];

    for (const jobId of runJobIds) {
      const taskRuns = await listCronRuns(jobId);
      runs.push(...taskRuns);
    }

    await pushSnapshot({ reason, runs, tasks });
    console.info(
      `[otto-cron-sync] pushed ${tasks.length} tasks and ${runs.length} runs (${reason})`,
    );
  } catch (error) {
    console.error(
      "[otto-cron-sync] incremental sync failed",
      getErrorMessage(error),
    );
    pendingTaskRefresh = true;
    pendingReasons.add("retry_after_error");
    for (const jobId of runJobIds) {
      pendingRunJobIds.add(jobId);
    }
  } finally {
    flushInFlight = false;

    if (flushRequestedWhileBusy || pendingTaskRefresh || pendingRunJobIds.size) {
      flushRequestedWhileBusy = false;
      scheduleFlush();
    }
  }
}

async function pushSnapshot(input) {
  const tasks = Array.isArray(input.tasks) ? input.tasks : [];
  const runs = Array.isArray(input.runs) ? input.runs : [];
  const runChunks = chunk(runs, MAX_RUNS_PER_REQUEST);

  if (runChunks.length === 0) {
    await postScheduledTaskSync({
      reason: input.reason,
      source: "watcher",
      tasks,
    });
    return;
  }

  const [firstChunk, ...remainingChunks] = runChunks;

  await postScheduledTaskSync({
    reason: input.reason,
    runs: firstChunk,
    source: "watcher",
    tasks,
  });

  for (const chunkRuns of remainingChunks) {
    await postScheduledTaskSync({
      reason: input.reason,
      runs: chunkRuns,
      source: "watcher",
    });
  }
}

async function listCronTasks() {
  const payload = await invokeGatewayTool({
    action: "list",
    args: { includeDisabled: true },
    tool: "cron",
  });

  return readEntries(payload, ["jobs", "entries"]);
}

async function listCronRuns(jobId) {
  const payload = await invokeGatewayTool({
    action: "runs",
    args: { jobId },
    tool: "cron",
  });

  return readEntries(payload, ["entries"]);
}

async function invokeGatewayTool(input) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    CONTROL_PLANE_TIMEOUT_MS,
  );

  try {
    const response = await fetch(localGatewayUrl("/tools/invoke"), {
      body: JSON.stringify({
        ...(input.action ? { action: input.action } : {}),
        ...(input.args ? { args: input.args } : {}),
        tool: input.tool,
      }),
      headers: {
        Authorization: `Bearer ${gatewayToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Gateway tool invoke failed: ${response.status} ${await response.text()}`,
      );
    }

    const envelope = await response.json();
    if (!envelope || typeof envelope !== "object") {
      throw new Error("Gateway tool invoke returned a non-object response");
    }

    if (envelope.ok !== true) {
      const message =
        typeof envelope.error?.message === "string"
          ? envelope.error.message
          : "Tenant runtime tool invocation failed";
      throw new Error(message);
    }

    if (
      envelope.result &&
      typeof envelope.result === "object" &&
      !Array.isArray(envelope.result) &&
      envelope.result.details &&
      typeof envelope.result.details === "object" &&
      !Array.isArray(envelope.result.details)
    ) {
      return envelope.result.details;
    }

    throw new Error("Gateway tool invoke response did not include details");
  } finally {
    clearTimeout(timeout);
  }
}

async function postScheduledTaskSync(payload) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    CONTROL_PLANE_TIMEOUT_MS,
  );

  try {
    const response = await fetch(
      `${controlPlaneBaseUrl}/api/internal/runtime/scheduled-tasks/sync`,
      {
        body: JSON.stringify(payload),
        headers: {
          Authorization: `Bearer ${gatewayToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(
        `Control-plane scheduled task sync failed: ${response.status} ${await response.text()}`,
      );
    }
  } finally {
    clearTimeout(timeout);
  }
}

function readEntries(payload, fieldNames) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Gateway response was not an object");
  }

  for (const fieldName of fieldNames) {
    const value = payload[fieldName];
    if (Array.isArray(value)) {
      return value.filter(
        (entry) =>
          Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
      );
    }
  }

  throw new Error(
    `Gateway response did not include any of: ${fieldNames.join(", ")}`,
  );
}

function localGatewayUrl(pathName) {
  return `http://127.0.0.1:${gatewayPort}${pathName}`;
}

function normalizeBaseUrl(value) {
  const normalized = value.trim().replace(/\/+$/, "");
  return normalized.length > 0 ? normalized : null;
}

function joinReasons(reasons) {
  if (reasons.size === 0) {
    return "watch";
  }

  return [...reasons].sort().join(",");
}

function chunk(entries, size) {
  if (entries.length === 0) {
    return [];
  }

  const chunks = [];
  for (let index = 0; index < entries.length; index += size) {
    chunks.push(entries.slice(index, index + size));
  }
  return chunks;
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shutdown() {
  isStopping = true;

  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (initialSyncTimer) {
    clearTimeout(initialSyncTimer);
    initialSyncTimer = null;
  }

  try {
    rootWatcher?.close();
  } catch {
    // best effort cleanup
  }

  try {
    runsWatcher?.close();
  } catch {
    // best effort cleanup
  }
}
