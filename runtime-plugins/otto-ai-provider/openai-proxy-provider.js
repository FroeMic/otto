import {
  buildOpenAiProxyModel,
  isOpenAiProxyModernModel,
  isOpenAiProxyXHighModel,
  OPENAI_PROXY_PROVIDER_ID,
} from "./model-catalog.js";
import {
  createOpenAiProxyDiagnostics,
  summarizeExtraParams,
  summarizeReplayPolicy,
  summarizeResolvedModel,
  summarizeRuntimeAuth,
  summarizeTransportNormalization,
  summarizeTransportTurnState,
  summarizeWebSocketSessionPolicy,
} from "./diagnostics.js";
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
  const diagnostics = createOpenAiProxyDiagnostics(dependencies.logger);
  const streamHooks =
    dependencies.openAiResponsesStreamHooks ??
    buildLocalOpenAiResponsesStreamHooks();
  const instrumentedStreamHooks = instrumentOpenAiResponsesStreamHooks(
    streamHooks,
    diagnostics,
  );

  diagnostics.info("provider initialized", {
    providerId: OPENAI_PROXY_PROVIDER_ID,
    defaultModel: `${OPENAI_PROXY_PROVIDER_ID}/gpt-5.4`,
    hasInjectedStreamHooks: Boolean(dependencies.openAiResponsesStreamHooks),
  });

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
    normalizeResolvedModel: (ctx) => {
      const resolved = normalizeOpenAiProxyResolvedModel(ctx);
      diagnostics.info(
        "resolved model normalized",
        summarizeResolvedModel(ctx, resolved),
      );
      return resolved;
    },
    normalizeTransport: (ctx) => {
      const resolved = normalizeOpenAiProxyTransport(ctx);
      diagnostics.info(
        "transport normalized",
        summarizeTransportNormalization(ctx, resolved),
      );
      return resolved;
    },
    buildReplayPolicy: (ctx) => {
      const resolved = buildOpenAiProxyReplayPolicy(ctx);
      diagnostics.info("replay policy resolved", summarizeReplayPolicy(ctx, resolved));
      return resolved;
    },
    prepareExtraParams: (ctx) => {
      const resolved = prepareOpenAiProxyExtraParams(ctx);
      diagnostics.info("extra params prepared", summarizeExtraParams(ctx, resolved));
      return resolved;
    },
    ...instrumentedStreamHooks,
    resolveTransportTurnState: (ctx) => {
      const resolved = resolveOpenAiProxyTransportTurnState(ctx);
      diagnostics.info(
        "transport turn state resolved",
        summarizeTransportTurnState(ctx, resolved),
      );
      return resolved;
    },
    resolveWebSocketSessionPolicy: (ctx) => {
      const resolved = resolveOpenAiProxyWebSocketSessionPolicy(ctx);
      diagnostics.info(
        "websocket session policy resolved",
        summarizeWebSocketSessionPolicy(ctx, resolved),
      );
      return resolved;
    },
    resolveReasoningOutputMode: () => "native",
    prepareRuntimeAuth: async (ctx) => {
      const resolved = resolveOpenAiProxyRuntimeAuth(ctx);
      diagnostics.info("runtime auth resolved", summarizeRuntimeAuth(ctx, resolved));
      return resolved;
    },
    supportsXHighThinking: ({ modelId }) => isOpenAiProxyXHighModel(modelId),
    isModernModelRef: ({ modelId }) => isOpenAiProxyModernModel(modelId),
  };
}

function instrumentOpenAiResponsesStreamHooks(streamHooks, diagnostics) {
  if (typeof streamHooks?.wrapStreamFn !== "function") {
    return streamHooks;
  }

  return {
    ...streamHooks,
    wrapStreamFn: (ctx) => {
      diagnostics.info("stream hook invoked", {
        provider: ctx?.provider,
        modelId: ctx?.modelId,
        transport: ctx?.transport,
        sessionId: ctx?.sessionId,
        turnId: ctx?.turnId,
        attempt: ctx?.attempt,
        hasStreamFn: typeof ctx?.streamFn === "function",
      });
      return streamHooks.wrapStreamFn(ctx);
    },
  };
}

function buildLocalOpenAiResponsesStreamHooks() {
  return {
    wrapStreamFn: (ctx) => ctx?.streamFn,
  };
}
