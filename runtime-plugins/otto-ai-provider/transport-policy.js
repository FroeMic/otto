const DEFAULT_OPENAI_PROXY_WS_DEGRADE_COOLDOWN_MS = 60_000;
const MAX_IDENTITY_LENGTH = 160;

export function prepareOpenAiProxyExtraParams(ctx, env = process.env) {
  const extraParams = ctx?.extraParams ?? {};
  const { transport } = resolveOpenAiProxyTransport(env);
  const hasExplicitWarmup = typeof extraParams.openaiWsWarmup === "boolean";
  const shouldDefaultTextVerbosity =
    isGpt5ModelRef(resolveOpenAiProxyModelId(ctx)) &&
    !Object.hasOwn(extraParams, "text_verbosity") &&
    !Object.hasOwn(extraParams, "textVerbosity");

  return {
    ...extraParams,
    transport,
    ...(hasExplicitWarmup ? {} : { openaiWsWarmup: true }),
    ...(shouldDefaultTextVerbosity ? { text_verbosity: "low" } : {}),
  };
}

export function normalizeOpenAiProxyResolvedModel(ctx) {
  if (ctx?.provider !== "openai-proxy") {
    return undefined;
  }
  const model = ctx.model;
  if (!model || typeof model !== "object") {
    return undefined;
  }
  if (model.api === "openai-completions") {
    return { ...model, api: "openai-responses" };
  }
  return model.api === "openai-responses" ? model : { ...model, api: "openai-responses" };
}

export function normalizeOpenAiProxyTransport(ctx) {
  if (ctx?.api === "openai-completions") {
    return { api: "openai-responses", baseUrl: ctx.baseUrl };
  }
  return undefined;
}

export function resolveOpenAiProxyTransportTurnState(ctx) {
  const sessionId = normalizeIdentityValue(ctx?.sessionId);
  const turnId = normalizeIdentityValue(ctx?.turnId);
  const attempt =
    ctx?.attempt === undefined ? "" : normalizeIdentityValue(String(Math.max(1, ctx.attempt)));
  const transport = normalizeIdentityValue(ctx?.transport);
  const headers = {};
  const metadata = {};

  if (sessionId) {
    headers["x-openclaw-session-id"] = sessionId;
    metadata.openclaw_session_id = sessionId;
  }
  if (turnId) {
    headers["x-openclaw-turn-id"] = turnId;
    metadata.openclaw_turn_id = turnId;
  }
  if (attempt) {
    headers["x-openclaw-turn-attempt"] = attempt;
    metadata.openclaw_turn_attempt = attempt;
  }
  if (transport) {
    metadata.openclaw_transport = transport;
  }

  if (Object.keys(headers).length === 0 && Object.keys(metadata).length === 0) {
    return undefined;
  }

  return { headers, metadata };
}

export function resolveOpenAiProxyWebSocketSessionPolicy(ctx) {
  const sessionId = normalizeIdentityValue(ctx?.sessionId);
  return {
    ...(sessionId
      ? {
          headers: {
            "x-openclaw-session-id": sessionId,
          },
        }
      : {}),
    degradeCooldownMs: DEFAULT_OPENAI_PROXY_WS_DEGRADE_COOLDOWN_MS,
  };
}

export function normalizeIdentityValue(value) {
  if (typeof value !== "string") {
    return "";
  }
  const normalized = value.trim().replace(/[\r\n]+/g, " ");
  return normalized.length > MAX_IDENTITY_LENGTH
    ? normalized.slice(0, MAX_IDENTITY_LENGTH)
    : normalized;
}

function resolveOpenAiProxyModelId(ctx) {
  if (typeof ctx?.modelId === "string") {
    return ctx.modelId;
  }
  if (typeof ctx?.model?.id === "string") {
    return ctx.model.id;
  }
  return "";
}

function isGpt5ModelRef(modelId) {
  return /^gpt-5(?:[.-]|$)/i.test(modelId.trim());
}
import { resolveOpenAiProxyTransport } from "./transport.js";
