#!/usr/bin/env node

import { spawn } from "node:child_process";

const DEFAULT_GATEWAY_PORT = "18791";
const CRON_WATCHER_PATH = "/app/otto-helpers/cron-sync-watcher.mjs";
const BRIDGE_REPORTER_PATH = "/app/otto-helpers/runtime-bridge-reporter.mjs";
const BRIDGE_COMMAND_RUNNER_PATH = "/app/otto-helpers/runtime-bridge-command-runner.mjs";

const gatewayArgs = process.argv.slice(2);
const gatewayPort =
  readFlagValue(gatewayArgs, "--port") ||
  process.env.OPENCLAW_GATEWAY_PORT ||
  DEFAULT_GATEWAY_PORT;

let gatewayChild = null;
let cronWatcherChild = null;
let bridgeReporterChild = null;
let bridgeCommandRunnerChild = null;
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

  if (shouldStartCompanionProcesses()) {
    cronWatcherChild = startManagedHelper({
      disabledMessage:
        "[otto-runtime] cron watcher disabled: missing OTTO_CONTROL_PLANE_BASE_URL",
      path: CRON_WATCHER_PATH,
      restartLabel: "cron watcher",
    });
    bridgeReporterChild = startManagedHelper({
      disabledMessage:
        "[otto-runtime] bridge reporter disabled: missing OTTO_CONTROL_PLANE_BASE_URL",
      path: BRIDGE_REPORTER_PATH,
      restartLabel: "bridge reporter",
    });
    bridgeCommandRunnerChild = startManagedHelper({
      disabledMessage:
        "[otto-runtime] bridge command runner disabled: missing OTTO_CONTROL_PLANE_BASE_URL",
      path: BRIDGE_COMMAND_RUNNER_PATH,
      restartLabel: "bridge command runner",
    });
  } else {
    console.info(
      "[otto-runtime] runtime companions disabled: missing OTTO_CONTROL_PLANE_BASE_URL",
    );
  }

  gatewayChild.on("exit", (code, signal) => {
    shuttingDown = true;
    stopHelper(cronWatcherChild);
    stopHelper(bridgeReporterChild);
    stopHelper(bridgeCommandRunnerChild);
    exitWithChildStatus(code, signal);
  });

  process.on("SIGINT", handleShutdownSignal);
  process.on("SIGTERM", handleShutdownSignal);
}

function shouldStartCompanionProcesses() {
  return Boolean(process.env.OTTO_CONTROL_PLANE_BASE_URL?.trim());
}

function startManagedHelper(input) {
  if (!shouldStartCompanionProcesses()) {
    console.info(input.disabledMessage);
    return null;
  }

  const child = spawn(process.execPath, [input.path], {
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
      `[otto-runtime] ${input.restartLabel} exited (code=${code ?? "null"} signal=${signal ?? "null"}); restarting in 5s`,
    );

    setTimeout(() => {
      if (!shuttingDown) {
        if (input.path === CRON_WATCHER_PATH) {
          cronWatcherChild = startManagedHelper(input);
        } else if (input.path === BRIDGE_REPORTER_PATH) {
          bridgeReporterChild = startManagedHelper(input);
        } else if (input.path === BRIDGE_COMMAND_RUNNER_PATH) {
          bridgeCommandRunnerChild = startManagedHelper(input);
        }
      }
    }, 5_000);
  });

  return child;
}

function stopHelper(child) {
  if (!child || child.killed) {
    return;
  }

  try {
    child.kill("SIGTERM");
  } catch {
    // best effort cleanup
  }
}

function handleShutdownSignal(signal) {
  shuttingDown = true;
  stopHelper(cronWatcherChild);
  stopHelper(bridgeReporterChild);
  stopHelper(bridgeCommandRunnerChild);

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
