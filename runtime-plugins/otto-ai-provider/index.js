import { defineSingleProviderPluginEntry } from "openclaw/plugin-sdk/provider-entry";
import { transcribeOpenAiCompatibleAudio } from "openclaw/plugin-sdk/media-understanding";
import { buildProviderStreamFamilyHooks } from "openclaw/plugin-sdk/provider-stream-family";
import { buildOpenAiProxyProvider } from "./openai-proxy-provider.js";
import {
  normalizeControlPlaneBaseUrl,
  resolveOpenAiProxyRuntimeAuth,
} from "./runtime-auth.js";

const PROVIDER_ID = "openai-proxy";
const DEFAULT_BASE_URL_PATH = "/api/internal/runtime/ai/openai/v1";
const DEFAULT_AUDIO_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
const OPENAI_RESPONSES_STREAM_HOOKS = buildProviderStreamFamilyHooks(
  "openai-responses-defaults",
);

export default defineSingleProviderPluginEntry({
  id: "otto-ai-provider",
  name: "Otto AI Provider",
  description: "Otto-managed OpenAI proxy provider",
  provider: buildOpenAiProxyProvider({
    openAiResponsesStreamHooks: OPENAI_RESPONSES_STREAM_HOOKS,
  }),
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

  return resolveOpenAiProxyRuntimeAuth({
    apiKey: "audio-transcription",
    env: {
      OTTO_CONTROL_PLANE_BASE_URL: controlPlaneBaseUrl,
    },
  }).baseUrl;
}
