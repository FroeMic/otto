#!/usr/bin/env node

import { spawn } from "node:child_process";

const DEFAULT_GATEWAY_PORT = "18791";
const WATCHER_PATH = "/app/otto-helpers/cron-sync-watcher.mjs";

const gatewayArgs = process.argv.slice(2);
const gatewayPort =
  readFlagValue(gatewayArgs, "--port") ||
  process.env.OPENCLAW_GATEWAY_PORT ||
  DEFAULT_GATEWAY_PORT;

let gatewayChild = null;
let watcherChild = null;
let shuttingDown = false;

startProcesses();

function startProcesses() {
  gatewayChild = spawn(
    process.execPath,
    ["dist/index.js", "gateway", ...gatewayArgs],
    {
      cwd: "/app",
      env: {
        ...process.env,
        OPENCLAW_GATEWAY_PORT: gatewayPort,
      },
      stdio: "inherit",
    },
  );

  if (shouldStartWatcher()) {
    watcherChild = startWatcher();
  } else {
    console.info(
      "[otto-runtime] cron watcher disabled: missing OTTO_CONTROL_PLANE_BASE_URL",
    );
  }

  gatewayChild.on("exit", (code, signal) => {
    shuttingDown = true;
    stopWatcher();
    exitWithChildStatus(code, signal);
  });

  process.on("SIGINT", handleShutdownSignal);
  process.on("SIGTERM", handleShutdownSignal);
}

function shouldStartWatcher() {
  return Boolean(process.env.OTTO_CONTROL_PLANE_BASE_URL?.trim());
}

function startWatcher() {
  const child = spawn(process.execPath, [WATCHER_PATH], {
    cwd: "/app",
    env: {
      ...process.env,
      OPENCLAW_GATEWAY_PORT: gatewayPort,
    },
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    console.error(
      `[otto-runtime] cron watcher exited (code=${code ?? "null"} signal=${signal ?? "null"}); restarting in 5s`,
    );

    setTimeout(() => {
      if (!shuttingDown) {
        watcherChild = startWatcher();
      }
    }, 5_000);
  });

  return child;
}

function stopWatcher() {
  if (!watcherChild || watcherChild.killed) {
    return;
  }

  try {
    watcherChild.kill("SIGTERM");
  } catch {
    // best effort cleanup
  }
}

function handleShutdownSignal(signal) {
  shuttingDown = true;
  stopWatcher();

  if (gatewayChild && !gatewayChild.killed) {
    try {
      gatewayChild.kill(signal);
      return;
    } catch {
      // fall through to direct exit
    }
  }

  process.exit(0);
}

function exitWithChildStatus(code, signal) {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(typeof code === "number" ? code : 0);
}

function readFlagValue(args, flagName) {
  const flagIndex = args.indexOf(flagName);
  if (flagIndex === -1) {
    return null;
  }

  const value = args[flagIndex + 1];
  return typeof value === "string" && value.length > 0 ? value : null;
}
