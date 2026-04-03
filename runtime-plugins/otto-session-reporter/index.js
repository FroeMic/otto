import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_DEBOUNCE_MS = 5_000;

export default definePluginEntry({
  id: "otto-session-reporter",
  name: "Otto Session Reporter",
  description:
    "Reports session lifecycle and transcript data to the Otto control plane.",
  configSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      timeoutMs: { type: "integer", minimum: 1000 },
      debounceMs: { type: "integer", minimum: 500 },
    },
  },
  register(api) {
    logPluginInfo("register() called — setting up hooks");

    const pendingFlush = new Map();

    // -- Typed lifecycle hooks (api.on → registry.typedHooks) ----------------

    api.on("session_start", async (event, ctx) => {
      logPluginInfo("session_start hook fired", {
        sessionId: event.sessionId,
        sessionKey: ctx.sessionKey,
        agentId: ctx.agentId,
      });
      try {
        await syncSession(api, {
          sessionKey: ctx.sessionKey ?? event.sessionId,
          externalSessionId: event.sessionId,
          status: "running",
          sessionUpdatedAt: Date.now(),
        });
      } catch (error) {
        logPluginError("session_start handler threw", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    api.on("session_end", async (event, ctx) => {
      logPluginInfo("session_end hook fired", {
        sessionId: event.sessionId,
        sessionKey: ctx.sessionKey,
        agentId: ctx.agentId,
        messageCount: event.messageCount,
        durationMs: event.durationMs,
      });
      try {
        clearDebounce(pendingFlush, ctx.sessionKey ?? event.sessionId);

        const sessionKey = ctx.sessionKey ?? event.sessionId;
        const entry = await loadSessionEntry(api, sessionKey);
        const transcript = await readTranscript(api, ctx.agentId, sessionKey, entry);
        logPluginInfo("session_end transcript read", {
          sessionKey,
          hasTranscript: !!transcript,
          transcriptSize: transcript?.transcriptJsonl?.length ?? 0,
        });

        await syncSessionFull(api, sessionKey, entry, transcript, {
          externalSessionId: event.sessionId,
          status: "done",
          runtimeMs: event.durationMs ?? null,
          messageCount: event.messageCount,
          sessionUpdatedAt: Date.now(),
        });
      } catch (error) {
        logPluginError("session_end handler threw", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    // -- Transcript update events (runtime.events → real session keys) -------

    api.runtime.events.onSessionTranscriptUpdate((update) => {
      const sessionKey = update.sessionKey;
      if (!sessionKey) {
        logPluginInfo("transcriptUpdate: no sessionKey, skipping", {
          sessionFile: update.sessionFile,
        });
        return;
      }

      logPluginInfo("transcriptUpdate fired", { sessionKey });
      debouncedSync(api, pendingFlush, sessionKey);
    });

    logPluginInfo("register() complete — all hooks registered");
  },
});

// ---------------------------------------------------------------------------
// Debounced sync for mid-session updates
// ---------------------------------------------------------------------------

function debouncedSync(api, pendingFlush, sessionKey) {
  clearDebounce(pendingFlush, sessionKey);

  const debounceMs = resolveDebounceMs(api);
  logPluginInfo("debouncedSync scheduled", { sessionKey, debounceMs });
  const timer = setTimeout(async () => {
    pendingFlush.delete(sessionKey);
    logPluginInfo("debouncedSync executing", { sessionKey });
    try {
      const entry = await loadSessionEntry(api, sessionKey);
      if (!entry) {
        logPluginInfo("debouncedSync: no session entry found", { sessionKey });
        return;
      }

      const transcript = await readTranscript(api, undefined, sessionKey, entry);
      logPluginInfo("debouncedSync transcript read", {
        sessionKey,
        hasTranscript: !!transcript,
      });

      await syncSessionFull(api, sessionKey, entry, transcript, {
        sessionUpdatedAt: entry.updatedAt ?? Date.now(),
      });
    } catch (error) {
      logPluginError("Debounced sync failed", {
        sessionKey,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, debounceMs);

  pendingFlush.set(sessionKey, timer);
}

function clearDebounce(pendingFlush, sessionKey) {
  const existing = pendingFlush.get(sessionKey);
  if (existing) {
    clearTimeout(existing);
    pendingFlush.delete(sessionKey);
  }
}

// ---------------------------------------------------------------------------
// Session store helpers
// ---------------------------------------------------------------------------

async function loadSessionEntry(api, sessionKey) {
  try {
    const storePath = api.runtime.agent.session.resolveStorePath();
    const store = await api.runtime.agent.session.loadSessionStore(storePath);
    const normalized = sessionKey.trim().toLowerCase();
    return store[normalized] ?? null;
  } catch (error) {
    logPluginError("loadSessionEntry failed", {
      sessionKey,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function readTranscript(api, agentId, sessionKey, entry) {
  try {
    // Try resolveSessionFilePath first, fall back to the entry's sessionFile
    let filePath = null;
    try {
      filePath = api.runtime.agent.session.resolveSessionFilePath(
        sessionKey,
        agentId,
      );
    } catch {
      // resolveSessionFilePath may not support all key formats
    }

    if (!filePath && entry?.sessionFile) {
      filePath = entry.sessionFile;
    }

    logPluginInfo("readTranscript resolvedPath", { sessionKey, agentId, filePath });
    if (!filePath) return null;

    const content = await readFile(filePath, "utf-8");
    const hash = createHash("sha256").update(content).digest("hex");
    const lineCount = content.split("\n").filter((l) => l.trim()).length;
    const messageCount = Math.max(0, lineCount - 1);

    return {
      transcriptJsonl: content,
      transcriptHash: hash,
      messageCount,
    };
  } catch (error) {
    logPluginError("readTranscript failed", {
      sessionKey,
      agentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Build full session payload from entry + overrides
// ---------------------------------------------------------------------------

async function syncSessionFull(api, sessionKey, entry, transcript, overrides) {
  const data = {
    sessionKey,
    externalSessionId: entry?.sessionId ?? overrides.externalSessionId ?? null,
    displayName: entry?.displayName ?? null,
    label: entry?.label ?? null,
    subject: entry?.subject ?? null,
    channel: entry?.channel ?? entry?.lastChannel ?? null,
    channelProvider: entry?.origin?.provider ?? null,
    chatType: entry?.chatType ?? entry?.origin?.chatType ?? null,
    originFrom: entry?.origin?.from ?? null,
    originTo: entry?.origin?.to ?? null,
    originAccountId:
      entry?.lastAccountId ?? entry?.origin?.accountId ?? null,
    originThreadId: entry?.lastThreadId
      ? String(entry.lastThreadId)
      : entry?.origin?.threadId
        ? String(entry.origin.threadId)
        : null,
    status: entry?.status ?? overrides.status ?? "active",
    startedAt: entry?.startedAt ?? null,
    endedAt: entry?.endedAt ?? null,
    runtimeMs: entry?.runtimeMs ?? null,
    model: entry?.model ?? null,
    modelProvider: entry?.modelProvider ?? null,
    inputTokens: entry?.inputTokens ?? null,
    outputTokens: entry?.outputTokens ?? null,
    cacheReadTokens: entry?.cacheRead ?? null,
    cacheWriteTokens: entry?.cacheWrite ?? null,
    totalTokens: entry?.totalTokens ?? null,
    estimatedCostUsd: entry?.estimatedCostUsd
      ? String(entry.estimatedCostUsd)
      : null,
    parentSessionKey: entry?.parentSessionKey ?? null,
    spawnDepth: entry?.spawnDepth ?? 0,
    subagentRole: entry?.subagentRole ?? null,
    sessionUpdatedAt: entry?.updatedAt ?? Date.now(),
    ...overrides,
    ...(transcript ?? {}),
  };

  await syncSession(api, data);
}

// ---------------------------------------------------------------------------
// Control plane communication
// ---------------------------------------------------------------------------

async function syncSession(api, sessionData) {
  logPluginInfo("syncSession called", {
    sessionKey: sessionData.sessionKey,
    status: sessionData.status,
    hasTranscript: !!sessionData.transcriptJsonl,
  });

  const response = await requestControlPlane(api, {
    method: "POST",
    path: "/api/internal/runtime/sessions/sync",
    body: {
      sessions: [sessionData],
    },
  });

  if (!response.ok) {
    logPluginError("Session sync failed", {
      sessionKey: sessionData.sessionKey,
      error: response.error,
      code: response.code,
      status: response.status,
    });
  } else {
    logPluginInfo("Session synced OK", {
      sessionKey: sessionData.sessionKey,
      status: sessionData.status,
      httpStatus: response.status,
    });
  }
}

function resolveControlPlaneBaseUrl() {
  const raw = process.env.OTTO_CONTROL_PLANE_BASE_URL ?? "";
  const value = raw.trim().replace(/\/+$/, "");
  return value || null;
}

function resolveGatewayToken() {
  const raw = process.env.OPENCLAW_GATEWAY_TOKEN ?? "";
  const value = raw.trim();
  return value || null;
}

function resolveTimeoutMs(api) {
  const configured = api?.config?.timeoutMs;

  if (
    typeof configured === "number" &&
    Number.isFinite(configured) &&
    configured >= 1000
  ) {
    return configured;
  }

  return DEFAULT_TIMEOUT_MS;
}

function resolveDebounceMs(api) {
  const configured = api?.config?.debounceMs;

  if (
    typeof configured === "number" &&
    Number.isFinite(configured) &&
    configured >= 500
  ) {
    return configured;
  }

  return DEFAULT_DEBOUNCE_MS;
}

async function requestControlPlane(api, input) {
  const baseUrl = resolveControlPlaneBaseUrl();
  const token = resolveGatewayToken();
  const timeoutMs = resolveTimeoutMs(api);

  if (!baseUrl) {
    return {
      ok: false,
      code: "control_plane_env_missing",
      error:
        "OTTO_CONTROL_PLANE_BASE_URL is not set in the runtime environment.",
    };
  }

  if (!token) {
    return {
      ok: false,
      code: "control_plane_env_missing",
      error: "OPENCLAW_GATEWAY_TOKEN is not set in the runtime environment.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${input.path}`, {
      method: input.method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(input.body ? { "Content-Type": "application/json" } : {}),
      },
      body: input.body ? JSON.stringify(input.body) : undefined,
      signal: controller.signal,
    });

    const data = await parseJsonResponse(response);

    if (response.ok) {
      return { ok: true, data, status: response.status };
    }

    const errorMessage =
      data && typeof data === "object"
        ? typeof data.message === "string"
          ? data.message
          : typeof data.error === "string"
            ? data.error
            : `${input.method} ${input.path} failed with ${response.status}`
        : `${input.method} ${input.path} failed with ${response.status}`;

    return {
      ok: false,
      code: "control_plane_http_error",
      error: errorMessage,
      status: response.status,
    };
  } catch (error) {
    const isTimeout =
      error instanceof Error && error.name === "AbortError";

    return {
      ok: false,
      code: isTimeout
        ? "control_plane_timeout"
        : "control_plane_request_failed",
      error: isTimeout
        ? `${input.method} ${input.path} timed out after ${timeoutMs}ms`
        : error instanceof Error
          ? error.message
          : "Request failed",
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

function logPluginInfo(message, details) {
  try {
    console.log(`[otto-session-reporter] ${message}`, details ?? "");
  } catch {
    // Ignore logging failures inside the plugin runtime.
  }
}

function logPluginError(message, details) {
  try {
    console.error(`[otto-session-reporter] ${message}`, details ?? "");
  } catch {
    // Ignore logging failures inside the plugin runtime.
  }
}
