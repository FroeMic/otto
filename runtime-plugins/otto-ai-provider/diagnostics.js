const LOG_PREFIX = "[otto-ai-provider]";
const MAX_FIELD_LENGTH = 240;

export function createOpenAiProxyDiagnostics(logger = console) {
  return {
    info(event, fields = {}) {
      writeLog(logger, "info", `${LOG_PREFIX} ${event}`, sanitizeFields(fields));
    },
    warn(event, fields = {}) {
      writeLog(logger, "warn", `${LOG_PREFIX} ${event}`, sanitizeFields(fields));
    },
  };
}

export function summarizeRuntimeAuth(input, resolved) {
  return {
    baseUrl: resolved?.baseUrl,
    baseHost: safeHost(resolved?.baseUrl),
    hasApiKey: typeof input?.apiKey === "string" && input.apiKey.length > 0,
    apiKeyLength: typeof input?.apiKey === "string" ? input.apiKey.length : 0,
    hasControlPlaneBaseUrl:
      typeof input?.env?.OTTO_CONTROL_PLANE_BASE_URL === "string" &&
      input.env.OTTO_CONTROL_PLANE_BASE_URL.length > 0,
  };
}

export function summarizeExtraParams(input, resolved) {
  const extraParams = input?.extraParams ?? {};
  return {
    modelId: normalizeLogValue(input?.modelId),
    requestedTransport: normalizeLogValue(extraParams.transport),
    resolvedTransport: normalizeLogValue(resolved?.transport),
    requestedOpenAiWsWarmup:
      typeof extraParams.openaiWsWarmup === "boolean"
        ? extraParams.openaiWsWarmup
        : undefined,
    resolvedOpenAiWsWarmup: resolved?.openaiWsWarmup,
    extraParamKeys: Object.keys(extraParams).sort(),
  };
}

export function summarizeReplayPolicy(input, resolved) {
  return {
    modelApi: normalizeLogValue(input?.modelApi),
    sanitizeMode: normalizeLogValue(resolved?.sanitizeMode),
    sanitizeToolCallIds: resolved?.sanitizeToolCallIds,
    toolCallIdMode: normalizeLogValue(resolved?.toolCallIdMode),
    applyAssistantFirstOrderingFix: resolved?.applyAssistantFirstOrderingFix,
  };
}

export function summarizeTransportTurnState(input, resolved) {
  return {
    provider: normalizeLogValue(input?.provider),
    transport: normalizeLogValue(input?.transport),
    sessionId: normalizeLogValue(input?.sessionId),
    turnId: normalizeLogValue(input?.turnId),
    attempt: normalizeLogValue(input?.attempt),
    headerKeys: Object.keys(resolved?.headers ?? {}).sort(),
    metadataKeys: Object.keys(resolved?.metadata ?? {}).sort(),
  };
}

export function summarizeWebSocketSessionPolicy(input, resolved) {
  return {
    provider: normalizeLogValue(input?.provider),
    sessionId: normalizeLogValue(input?.sessionId),
    hasSessionHeader: Boolean(resolved?.headers?.["x-openclaw-session-id"]),
    degradeCooldownMs: resolved?.degradeCooldownMs,
  };
}

export function summarizeResolvedModel(input, resolved) {
  return {
    provider: normalizeLogValue(input?.provider),
    modelApi: normalizeLogValue(input?.model?.api),
    resolvedApi: normalizeLogValue(resolved?.api),
  };
}

export function summarizeTransportNormalization(input, resolved) {
  return {
    requestedApi: normalizeLogValue(input?.api),
    resolvedApi: normalizeLogValue(resolved?.api),
    baseHost: safeHost(input?.baseUrl),
  };
}

function writeLog(logger, level, message, fields) {
  const logFn = typeof logger?.[level] === "function" ? logger[level] : logger?.info;
  if (typeof logFn !== "function") {
    return;
  }

  try {
    logFn.call(logger, message, fields);
  } catch {
    // Runtime diagnostics should never affect provider behavior.
  }
}

function sanitizeFields(fields) {
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, sanitizeValue(value)]),
  );
}

function sanitizeValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }
  if (value && typeof value === "object") {
    return sanitizeFields(value);
  }
  return normalizeLogValue(value);
}

function normalizeLogValue(value) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "string") {
    const normalized = value.trim().replace(/[\r\n]+/g, " ");
    return normalized.length > MAX_FIELD_LENGTH
      ? `${normalized.slice(0, MAX_FIELD_LENGTH)}...`
      : normalized;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return String(value);
}

function safeHost(value) {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }
  try {
    return new URL(value).host;
  } catch {
    return undefined;
  }
}
