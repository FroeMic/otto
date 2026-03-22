#!/usr/bin/env node

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

import { DisconnectReason } from "@whiskeysockets/baileys";
import QRCodeModule from "qrcode-terminal/vendor/QRCode/index.js";
import QRErrorCorrectLevelModule from "qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel.js";

import { loadConfig } from "../dist/index.js";
import { resolveWhatsAppAccount } from "../dist/plugin-sdk/whatsapp.js";

const ACTIVE_LOGIN_TTL_MS = 3 * 60_000;
const DEFAULT_ACCOUNT_ID = "default";
const DEFAULT_POLL_INTERVAL_MS = 500;
const DIST_DIR = "/app/dist";
const STATE_ROOT = "/home/node/.openclaw/otto/whatsapp-link";
const QRCode = QRCodeModule;
const QRErrorCorrectLevel = QRErrorCorrectLevelModule;

let webRuntimeModulesPromise;

const [, , command = "status", ...rawArgs] = process.argv;
const args = parseArgs(rawArgs);

try {
  switch (command) {
    case "run":
      await runCommand(args);
      break;
    case "start":
      await startCommand(args);
      break;
    case "status":
      await statusCommand(args);
      break;
    case "wait":
      await waitCommand(args);
      break;
    default:
      throw new Error(`Unsupported command: ${command}`);
  }
} catch (error) {
  writeJson({
    connected: false,
    error: getErrorMessage(error),
  });
  process.exitCode = 1;
}

async function startCommand(args) {
  const timeoutMs = Math.max(args.timeoutMs ?? 30_000, 5_000);
  const ctx = await createContext(args.accountId);
  const existingState = await readState(ctx.statePath);

  if (existingState && isStateFresh(existingState) && isSessionProcessRunning(existingState)) {
    if (existingState.status === "qr_ready" && typeof existingState.qrDataUrl === "string") {
      writeJson({
        events: existingState.events ?? [],
        message: "QR already active. Scan it in WhatsApp -> Linked Devices.",
        qrDataUrl: existingState.qrDataUrl,
        qrText: existingState.qrText ?? null,
        sessionId: existingState.sessionId,
      });
      return;
    }
    if (existingState.status === "connected") {
      writeJson({
        alreadyLinked: true,
        events: existingState.events ?? [],
        message: "WhatsApp login already completed.",
        self: existingState.self ?? null,
        sessionId: existingState.sessionId,
      });
      return;
    }
  }

  if (args.force && existingState?.pid && isSessionProcessRunning(existingState)) {
    try {
      process.kill(existingState.pid, "SIGTERM");
    } catch {
      // ignore best-effort cleanup
    }
  }

  if (args.force) {
    await ctx.webRuntime.logoutWeb({
      authDir: ctx.account.authDir,
      isLegacyAuthDir: ctx.account.isLegacyAuthDir,
    }).catch(() => false);
  }

  const hasWeb = await ctx.webRuntime.webAuthExists(ctx.account.authDir);
  if (hasWeb && !args.force) {
    const self = await readWebSelfId(ctx.account.authDir);
    writeJson({
      alreadyLinked: true,
      message: `WhatsApp is already linked (${self.e164 ?? self.jid ?? "unknown"}).`,
      self,
    });
    return;
  }

  await fs.mkdir(ctx.stateDir, { recursive: true });

  const childArgs = [ctx.scriptPath, "run", "--account-id", ctx.account.accountId];
  if (args.verbose) {
    childArgs.push("--verbose");
  }

  const child = spawn(process.execPath, childArgs, {
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  const startedAt = Date.now();
  await writeState(ctx.statePath, {
    accountId: ctx.account.accountId,
    message: "Starting WhatsApp login session.",
    pid: child.pid,
    sessionId: `session-${startedAt}`,
    startedAt,
    status: "starting",
    updatedAt: startedAt,
  });

  const state = await waitForState(
    ctx.statePath,
    timeoutMs,
    (next) =>
      next.status === "qr_ready" ||
      next.status === "connected" ||
      next.status === "failed",
  );

  if (!state) {
    writeJson({
      events: [],
      message: "Timed out waiting for WhatsApp QR.",
    });
    return;
  }

  writeJson({
    alreadyLinked: state.status === "connected" && !state.qrDataUrl,
    events: state.events ?? [],
    message: state.message,
    qrDataUrl: state.qrDataUrl,
    qrText: state.qrText ?? null,
    self: state.self ?? null,
    sessionId: state.sessionId,
  });
}

async function waitCommand(args) {
  const timeoutMs = Math.max(args.timeoutMs ?? 120_000, 1_000);
  const ctx = await createContext(args.accountId);
  const state = await waitForState(
    ctx.statePath,
    timeoutMs,
    (next) => next.status === "connected" || next.status === "failed",
  );

  if (!state) {
    writeJson({
      connected: false,
      events: [],
      message: "Still waiting for the QR scan. Let me know when you've scanned it.",
    });
    return;
  }

  writeJson({
    connected: state.status === "connected",
    events: state.events ?? [],
    message:
      state.message ??
      (state.status === "connected"
        ? "WhatsApp linked successfully."
        : "WhatsApp login failed."),
    self: state.self ?? null,
  });
}

async function statusCommand(args) {
  const ctx = await createContext(args.accountId);
  const state = await readState(ctx.statePath);

  writeJson({
    state,
  });
}

async function runCommand(args) {
  const ctx = await createContext(args.accountId);
  let current = (await readState(ctx.statePath)) ?? {
    sessionId: `session-${Date.now()}`,
    startedAt: Date.now(),
  };

  let sock = null;
  try {
    sock = await ctx.webRuntime.createWaSocket(false, Boolean(args.verbose), {
      authDir: ctx.account.authDir,
      onQr: async (qrText) => {
        const qrDataUrl = renderQrSvgDataUrl(qrText);
        current = await writeStateWithEvent(
          ctx.statePath,
          current,
          "WhatsApp QR received.",
          {
            accountId: ctx.account.accountId,
            message: "Scan this QR in WhatsApp -> Linked Devices.",
            pid: process.pid,
            qrDataUrl,
            qrText,
            status: "qr_ready",
            updatedAt: Date.now(),
          },
        );
      },
    });

    current = await writeStateWithEvent(
      ctx.statePath,
      current,
      "Waiting for WhatsApp connection.",
      {
        accountId: ctx.account.accountId,
        message: "Waiting for WhatsApp connection.",
        pid: process.pid,
        status: "starting",
        updatedAt: Date.now(),
      },
    );

    const restarted = await waitForConnectionWithRestart({
      authDir: ctx.account.authDir,
      createWaSocket: ctx.webRuntime.createWaSocket,
      onRestart: async () => {
        current = await writeStateWithEvent(
          ctx.statePath,
          current,
          "WhatsApp asked for a restart after pairing (code 515); retrying once.",
          {
            accountId: ctx.account.accountId,
            message:
              "WhatsApp asked for a restart after pairing (code 515); retrying once.",
            pid: process.pid,
            status: "starting",
            updatedAt: Date.now(),
          },
        );
      },
      sock,
      verbose: Boolean(args.verbose),
      waitForWaConnection: ctx.webRuntime.waitForWaConnection,
    });

    const self = await readWebSelfId(ctx.account.authDir);
    const successMessage = restarted
      ? "WhatsApp linked successfully after restart."
      : "WhatsApp linked successfully.";
    current = await writeStateWithEvent(
      ctx.statePath,
      current,
      successMessage,
      {
        accountId: ctx.account.accountId,
        message: successMessage,
        pid: process.pid,
        self,
        status: "connected",
        updatedAt: Date.now(),
      },
    );
  } catch (error) {
    const code = getStatusCodeLikeCli(error);
    const message = ctx.webRuntime.formatError(error);

    if (code === DisconnectReason.loggedOut) {
      await ctx.webRuntime.logoutWeb({
        authDir: ctx.account.authDir,
        isLegacyAuthDir: ctx.account.isLegacyAuthDir,
      }).catch(() => false);
    }

    current = await writeStateWithEvent(
      ctx.statePath,
      current,
      `WhatsApp login failed: ${message}`,
      {
        accountId: ctx.account.accountId,
        errorStatus: code ?? null,
        message: `WhatsApp login failed: ${message}`,
        pid: process.pid,
        status: "failed",
        updatedAt: Date.now(),
      },
    );
  } finally {
    closeSocket(sock);
  }
}

async function waitForConnectionWithRestart(input) {
  const { authDir, onRestart, verbose } = input;
  let sock = input.sock;
  let restarted = false;

  try {
    await input.waitForWaConnection(sock);
    return restarted;
  } catch (error) {
    const code = getStatusCodeLikeCli(error);
    if (code !== 515) {
      throw error;
    }

    restarted = true;
    await onRestart?.();
    closeSocket(sock);
    const retry = await input.createWaSocket(false, verbose, {
      authDir,
    });
    sock = retry;
    await input.waitForWaConnection(retry);
    return restarted;
  } finally {
    closeSocket(sock);
  }
}

async function createContext(accountId) {
  const cfg = loadConfig();
  const webRuntime = await loadWebRuntimeModules();
  const account = webRuntime.resolveWhatsAppAccount({
    cfg,
    accountId: accountId ?? DEFAULT_ACCOUNT_ID,
  });
  const stateDir = path.join(STATE_ROOT, account.accountId);
  const statePath = path.join(stateDir, "state.json");
  const scriptPath = fileURLToPath(import.meta.url);
  return { account, scriptPath, stateDir, statePath, webRuntime };
}

function closeSocket(sock) {
  try {
    sock?.ws?.close();
  } catch {
    // ignore
  }
}

function getStatusCodeLikeCli(err) {
  return (
    err?.error?.output?.statusCode ??
    err?.output?.statusCode ??
    err?.error?.status ??
    err?.status
  );
}

function getErrorMessage(error) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  return String(error);
}

function isSessionProcessRunning(state) {
  if (typeof state?.pid !== "number") {
    return false;
  }

  try {
    process.kill(state.pid, 0);
    return true;
  } catch {
    return false;
  }
}

function isStateFresh(state) {
  return (
    typeof state?.startedAt === "number" &&
    Date.now() - state.startedAt < ACTIVE_LOGIN_TTL_MS
  );
}

function parseArgs(argv) {
  const result = {
    accountId: DEFAULT_ACCOUNT_ID,
    force: false,
    timeoutMs: null,
    verbose: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    switch (value) {
      case "--account-id":
        result.accountId = argv[index + 1] ?? DEFAULT_ACCOUNT_ID;
        index += 1;
        break;
      case "--force":
        result.force = true;
        break;
      case "--timeout-ms":
        result.timeoutMs = Number(argv[index + 1]);
        index += 1;
        break;
      case "--verbose":
        result.verbose = true;
        break;
      default:
        break;
    }
  }

  return result;
}

async function loadWebRuntimeModules() {
  if (!webRuntimeModulesPromise) {
    webRuntimeModulesPromise = Promise.all([
      importDistModule("channel-web-"),
    ]).then(([channelWebModule]) => ({
      createWaSocket: channelWebModule.createWaSocket,
      formatError: channelWebModule.formatError,
      logoutWeb: channelWebModule.logoutWeb,
      resolveWhatsAppAccount,
      waitForWaConnection: channelWebModule.waitForWaConnection,
      webAuthExists: channelWebModule.webAuthExists,
    }));
  }

  return webRuntimeModulesPromise;
}

async function importDistModule(prefix) {
  const entries = await fs.readdir(DIST_DIR);
  const match = entries
    .filter((entry) => entry.startsWith(prefix) && entry.endsWith(".js"))
    .sort()
    .at(-1);

  if (!match) {
    throw new Error(`Could not find runtime module for prefix ${prefix}`);
  }

  return await import(pathToFileURL(path.join(DIST_DIR, match)).href);
}

async function readWebSelfId(authDir) {
  try {
    const raw = await fs.readFile(path.join(authDir, "creds.json"), "utf8");
    const parsed = JSON.parse(raw);
    const jid = typeof parsed?.me?.id === "string" ? parsed.me.id : null;
    const numberPart = jid?.split("@")[0]?.split(":")[0] ?? null;
    const e164 =
      numberPart && /^[0-9]+$/.test(numberPart) ? `+${numberPart}` : null;
    return { e164, jid };
  } catch {
    return { e164: null, jid: null };
  }
}

function createQrMatrix(input) {
  const qr = new QRCode(-1, QRErrorCorrectLevel.L);
  qr.addData(input);
  qr.make();
  return qr;
}

function renderQrSvgDataUrl(
  input,
  opts = { marginModules: 4, moduleSize: 6 },
) {
  const { marginModules = 4, moduleSize = 6 } = opts;
  const qr = createQrMatrix(input);
  const modules = qr.getModuleCount();
  const size = (modules + marginModules * 2) * moduleSize;
  const rects = [];

  for (let row = 0; row < modules; row += 1) {
    for (let col = 0; col < modules; col += 1) {
      if (!qr.isDark(row, col)) {
        continue;
      }
      rects.push(
        `<rect x="${(col + marginModules) * moduleSize}" y="${(row + marginModules) * moduleSize}" width="${moduleSize}" height="${moduleSize}" />`,
      );
    }
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges">` +
    `<rect width="${size}" height="${size}" fill="#fff"/>` +
    `<g fill="#000">${rects.join("")}</g>` +
    `</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

async function readState(statePath) {
  try {
    const raw = await fs.readFile(statePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function waitForState(statePath, timeoutMs, predicate) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const state = await readState(statePath);
    if (state && predicate(state)) {
      return state;
    }
    await sleep(DEFAULT_POLL_INTERVAL_MS);
  }

  return null;
}

async function writeState(statePath, state) {
  const tempPath = `${statePath}.tmp`;
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(tempPath, JSON.stringify(state), "utf8");
  await fs.rename(tempPath, statePath);
}

async function writeStateWithEvent(statePath, current, message, overrides) {
  const nextState = {
    ...withEvent(current, message),
    ...overrides,
  };
  await writeState(statePath, nextState);
  return nextState;
}

function withEvent(state, message) {
  const nextEvents = Array.isArray(state?.events) ? [...state.events] : [];
  nextEvents.push({
    at: new Date().toISOString(),
    message,
  });

  if (nextEvents.length > 20) {
    nextEvents.splice(0, nextEvents.length - 20);
  }

  return {
    ...state,
    events: nextEvents,
  };
}

function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
