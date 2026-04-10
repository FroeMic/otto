import { defineSingleProviderPluginEntry } from "openclaw/plugin-sdk/provider-entry";
import { transcribeOpenAiCompatibleAudio } from "openclaw/plugin-sdk/media-understanding";

const PROVIDER_ID = "openai-proxy";
const PROVIDER_LABEL = "OpenAI Proxy";
const DEFAULT_CONTEXT_TOKENS = 272_000;
const DEFAULT_MAX_TOKENS = 128_000;
const DEFAULT_BASE_URL_PATH = "/api/internal/runtime/ai/openai/v1";
const DEFAULT_AUDIO_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";

export default defineSingleProviderPluginEntry({
  id: "otto-ai-provider",
  name: "Otto AI Provider",
  description: "Otto-managed OpenAI proxy provider",
  provider: {
    id: PROVIDER_ID,
    label: PROVIDER_LABEL,
    docsPath: "/providers/models",
    auth: [
      {
        methodId: "api-key",
        label: "Otto tenant token",
        hint: "Tenant-scoped Otto runtime token for Otto-managed provider proxying",
        optionKey: "tenantToken",
        flagName: "--tenant-token",
        envVar: "TENANT_TOKEN",
        promptMessage: "Enter TENANT_TOKEN",
        defaultModel: `${PROVIDER_ID}/gpt-5.4`,
        wizard: false,
      },
    ],
    catalog: {
      buildProvider: () => ({
        api: "openai-responses",
        models: [],
      }),
    },
    resolveDynamicModel: (ctx) => buildDynamicModel(ctx.modelId),
    capabilities: {
      providerFamily: "openai",
    },
    prepareExtraParams: ({ extraParams }) => ({
      ...extraParams,
      transport: "sse",
    }),
    prepareRuntimeAuth: async (ctx) => {
      const controlPlaneBaseUrl = normalizeControlPlaneBaseUrl(
        ctx.env.OTTO_CONTROL_PLANE_BASE_URL,
      );

      if (!controlPlaneBaseUrl) {
        throw new Error(
          "OTTO_CONTROL_PLANE_BASE_URL is required to use openai-proxy.",
        );
      }

      return {
        apiKey: ctx.apiKey,
        baseUrl: `${controlPlaneBaseUrl}${DEFAULT_BASE_URL_PATH}`,
      };
    },
    supportsXHighThinking: ({ modelId }) =>
      normalizeModelId(modelId).startsWith("gpt-5"),
    isModernModelRef: ({ modelId }) =>
      normalizeModelId(modelId).startsWith("gpt-5"),
  },
  register(api) {
    api.registerMediaUnderstandingProvider({
      id: PROVIDER_ID,
      capabilities: ["audio"],
      transcribeAudio: async (params) => {
        const baseUrl = resolveProxyBaseUrl(params.baseUrl);

        return transcribeOpenAiCompatibleAudio({
          ...params,
          baseUrl,
          defaultBaseUrl: baseUrl,
          defaultModel: DEFAULT_AUDIO_TRANSCRIPTION_MODEL,
          provider: PROVIDER_ID,
        });
      },
    });
  },
});

function buildDynamicModel(modelId) {
  const trimmedModelId = typeof modelId === "string" ? modelId.trim() : "";

  if (!trimmedModelId) {
    return undefined;
  }

  return {
    id: trimmedModelId,
    name: trimmedModelId,
    provider: PROVIDER_ID,
    api: "openai-responses",
    reasoning: normalizeModelId(trimmedModelId).startsWith("gpt-5"),
    input: ["text", "image"],
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    },
    contextWindow: DEFAULT_CONTEXT_TOKENS,
    maxTokens: DEFAULT_MAX_TOKENS,
  };
}

function normalizeControlPlaneBaseUrl(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : null;
}

function normalizeModelId(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function resolveProxyBaseUrl(value) {
  const explicit = normalizeControlPlaneBaseUrl(value);
  if (explicit) {
    return explicit;
  }

  const controlPlaneBaseUrl = normalizeControlPlaneBaseUrl(
    process.env.OTTO_CONTROL_PLANE_BASE_URL,
  );

  if (!controlPlaneBaseUrl) {
    throw new Error(
      "openai-proxy audio transcription requires a configured baseUrl or OTTO_CONTROL_PLANE_BASE_URL.",
    );
  }

  return `${controlPlaneBaseUrl}${DEFAULT_BASE_URL_PATH}`;
}
