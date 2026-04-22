export const DEFAULT_BASE_URL_PATH = "/api/internal/runtime/ai/openai/v1";

const OPENAI_AUDIO_TRANSCRIPTION_MODELS = new Set([
  "gpt-4o-mini-transcribe",
  "gpt-4o-transcribe",
  "whisper-1",
]);

export function resolveOpenAiProxyAudioTranscriptionModel(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const normalized = trimmed.toLowerCase();
  return OPENAI_AUDIO_TRANSCRIPTION_MODELS.has(normalized)
    ? normalized
    : undefined;
}

export function resolveOpenAiProxyRuntimeAuth(ctx) {
  const proxyBaseUrl =
    normalizeControlPlaneBaseUrl(ctx?.env?.OTTO_OPENAI_PROXY_BASE_URL) ??
    normalizeControlPlaneBaseUrl(ctx?.env?.OTTO_CONTROL_PLANE_BASE_URL);

  if (!proxyBaseUrl) {
    throw new Error(
      "OTTO_OPENAI_PROXY_BASE_URL or OTTO_CONTROL_PLANE_BASE_URL is required to use openai-proxy.",
    );
  }

  if (!ctx?.apiKey) {
    throw new Error("TENANT_TOKEN is required to use openai-proxy.");
  }

  return {
    apiKey: ctx.apiKey,
    baseUrl: resolveOpenAiProxyApiBaseUrl(proxyBaseUrl),
  };
}

export function resolveOpenAiProxyApiBaseUrl(value) {
  const baseUrl = normalizeControlPlaneBaseUrl(value);
  if (!baseUrl) {
    return null;
  }
  return baseUrl.endsWith(DEFAULT_BASE_URL_PATH)
    ? baseUrl
    : `${baseUrl}${DEFAULT_BASE_URL_PATH}`;
}

export function normalizeControlPlaneBaseUrl(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : null;
}
