import {
  buildOpenAiProxyModel,
  isOpenAiProxyModernModel,
  isOpenAiProxyXHighModel,
  OPENAI_PROXY_PROVIDER_ID,
} from "./model-catalog.js";
import { buildOpenAiProxyReplayPolicy } from "./replay-policy.js";
import { resolveOpenAiProxyRuntimeAuth } from "./runtime-auth.js";
import {
  normalizeOpenAiProxyResolvedModel,
  normalizeOpenAiProxyTransport,
  prepareOpenAiProxyExtraParams,
  resolveOpenAiProxyTransportTurnState,
  resolveOpenAiProxyWebSocketSessionPolicy,
} from "./transport-policy.js";

export { OPENAI_PROXY_PROVIDER_ID };

export function buildOpenAiProxyProvider(dependencies = {}) {
  const streamHooks =
    dependencies.openAiResponsesStreamHooks ??
    buildLocalOpenAiResponsesStreamHooks();

  return {
    id: OPENAI_PROXY_PROVIDER_ID,
    label: "OpenAI Proxy",
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
        defaultModel: `${OPENAI_PROXY_PROVIDER_ID}/gpt-5.4`,
        wizard: false,
      },
    ],
    catalog: {
      buildProvider: () => ({
        api: "openai-responses",
        models: [],
      }),
    },
    resolveDynamicModel: (ctx) => buildOpenAiProxyModel(ctx.modelId),
    normalizeResolvedModel: normalizeOpenAiProxyResolvedModel,
    normalizeTransport: normalizeOpenAiProxyTransport,
    buildReplayPolicy: buildOpenAiProxyReplayPolicy,
    prepareExtraParams: prepareOpenAiProxyExtraParams,
    ...streamHooks,
    resolveTransportTurnState: resolveOpenAiProxyTransportTurnState,
    resolveWebSocketSessionPolicy: resolveOpenAiProxyWebSocketSessionPolicy,
    resolveReasoningOutputMode: () => "native",
    prepareRuntimeAuth: async (ctx) => resolveOpenAiProxyRuntimeAuth(ctx),
    supportsXHighThinking: ({ modelId }) => isOpenAiProxyXHighModel(modelId),
    isModernModelRef: ({ modelId }) => isOpenAiProxyModernModel(modelId),
  };
}

function buildLocalOpenAiResponsesStreamHooks() {
  return {
    wrapStreamFn: (ctx) => ctx?.streamFn,
  };
}
