const DEFAULT_BASE_URL_PATH = "/api/internal/runtime/ai/openai/v1";

export function resolveOpenAiProxyRuntimeAuth(ctx) {
  const controlPlaneBaseUrl = normalizeControlPlaneBaseUrl(
    ctx?.env?.OTTO_CONTROL_PLANE_BASE_URL,
  );

  if (!controlPlaneBaseUrl) {
    throw new Error(
      "OTTO_CONTROL_PLANE_BASE_URL is required to use openai-proxy.",
    );
  }

  if (!ctx?.apiKey) {
    throw new Error("TENANT_TOKEN is required to use openai-proxy.");
  }

  return {
    apiKey: ctx.apiKey,
    baseUrl: `${controlPlaneBaseUrl}${DEFAULT_BASE_URL_PATH}`,
  };
}

export function normalizeControlPlaneBaseUrl(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : null;
}
