export const OPENAI_PROXY_PROVIDER_ID = "openai-proxy";

export const OPENAI_PROXY_MODEL_SPECS = {
  "gpt-5.4": {
    contextWindow: 1_050_000,
    maxTokens: 128_000,
    cost: { input: 2.5, output: 15, cacheRead: 0.25, cacheWrite: 0 },
  },
  "gpt-5.4-pro": {
    contextWindow: 1_050_000,
    maxTokens: 128_000,
    cost: { input: 30, output: 180, cacheRead: 0, cacheWrite: 0 },
  },
  "gpt-5.4-mini": {
    contextWindow: 400_000,
    maxTokens: 128_000,
    cost: { input: 0.75, output: 4.5, cacheRead: 0.075, cacheWrite: 0 },
  },
  "gpt-5.4-nano": {
    contextWindow: 400_000,
    maxTokens: 128_000,
    cost: { input: 0.2, output: 1.25, cacheRead: 0.02, cacheWrite: 0 },
  },
};

export const OPENAI_PROXY_XHIGH_MODEL_IDS = [
  "gpt-5.4",
  "gpt-5.4-pro",
  "gpt-5.4-mini",
  "gpt-5.4-nano",
];

export const OPENAI_PROXY_MODERN_MODEL_IDS = [...OPENAI_PROXY_XHIGH_MODEL_IDS];

export function buildOpenAiProxyModel(modelId) {
  const id = normalizeModelId(modelId);
  const spec = OPENAI_PROXY_MODEL_SPECS[id];
  if (!spec) {
    return undefined;
  }

  return {
    id,
    name: id,
    provider: OPENAI_PROXY_PROVIDER_ID,
    api: "openai-responses",
    reasoning: true,
    input: ["text", "image"],
    cost: spec.cost,
    contextWindow: spec.contextWindow,
    maxTokens: spec.maxTokens,
  };
}

export function isOpenAiProxyXHighModel(modelId) {
  return matchesExactOrPrefix(modelId, OPENAI_PROXY_XHIGH_MODEL_IDS);
}

export function isOpenAiProxyModernModel(modelId) {
  return matchesExactOrPrefix(modelId, OPENAI_PROXY_MODERN_MODEL_IDS);
}

export function normalizeModelId(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function matchesExactOrPrefix(value, modelIds) {
  const normalized = normalizeModelId(value);
  return modelIds.some(
    (modelId) =>
      normalized === modelId || normalized.startsWith(`${modelId}-`),
  );
}
