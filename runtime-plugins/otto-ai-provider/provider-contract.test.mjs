import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOpenAiProxyProvider,
  OPENAI_PROXY_PROVIDER_ID,
} from "./openai-proxy-provider.js";
import {
  buildOpenAiProxyModel,
  OPENAI_PROXY_MODEL_SPECS,
} from "./model-catalog.js";
import { buildOpenAiProxyReplayPolicy } from "./replay-policy.js";
import {
  normalizeControlPlaneBaseUrl,
  resolveOpenAiProxyRuntimeAuth,
} from "./runtime-auth.js";

const silentLogger = {
  info() {},
  warn() {},
};

function buildProviderForTest(dependencies = {}) {
  return buildOpenAiProxyProvider({ logger: silentLogger, ...dependencies });
}

test("openai-proxy provider exposes the native-shaped OpenAI Responses contract", () => {
  const provider = buildProviderForTest();

  assert.equal(provider.id, "openai-proxy");
  assert.equal(OPENAI_PROXY_PROVIDER_ID, "openai-proxy");
  assert.equal(provider.catalog.buildProvider().api, "openai-responses");
  assert.equal(provider.capabilities, undefined);
  assert.equal(provider.resolveReasoningOutputMode(), "native");
  assert.equal(typeof provider.wrapStreamFn, "function");
  assert.equal(typeof provider.buildReplayPolicy, "function");
  assert.equal(typeof provider.normalizeResolvedModel, "function");
  assert.equal(typeof provider.normalizeTransport, "function");
  assert.equal(typeof provider.resolveTransportTurnState, "function");
  assert.equal(typeof provider.resolveWebSocketSessionPolicy, "function");
});

test("openai-proxy auth uses tenant token and defaults to gpt-5.4", () => {
  const provider = buildProviderForTest();
  const auth = provider.auth[0];

  assert.equal(auth.envVar, "TENANT_TOKEN");
  assert.equal(auth.defaultModel, "openai-proxy/gpt-5.4");
});

test("openai-proxy extra params mirror native OpenAI websocket defaults", () => {
  const provider = buildProviderForTest();

  assert.deepEqual(provider.prepareExtraParams({ extraParams: {} }), {
    transport: "auto",
    openaiWsWarmup: true,
  });

  assert.deepEqual(
    provider.prepareExtraParams({
      extraParams: { transport: "sse", openaiWsWarmup: false },
    }),
    {
      transport: "sse",
      openaiWsWarmup: false,
    },
  );

  assert.deepEqual(
    provider.prepareExtraParams({
      extraParams: { transport: "websocket", serviceTier: "priority" },
    }),
    {
      transport: "websocket",
      openaiWsWarmup: true,
      serviceTier: "priority",
    },
  );
});

test("openai-proxy runtime auth resolves the control-plane OpenAI base URL", () => {
  assert.equal(normalizeControlPlaneBaseUrl("https://otto.example///"), "https://otto.example");

  assert.deepEqual(
    resolveOpenAiProxyRuntimeAuth({
      apiKey: "tenant-token",
      env: { OTTO_CONTROL_PLANE_BASE_URL: "https://otto.example/" },
    }),
    {
      apiKey: "tenant-token",
      baseUrl: "https://otto.example/api/internal/runtime/ai/openai/v1",
    },
  );

  assert.throws(
    () => resolveOpenAiProxyRuntimeAuth({ apiKey: "tenant-token", env: {} }),
    /OTTO_CONTROL_PLANE_BASE_URL is required/,
  );
});

test("openai-proxy model metadata mirrors native OpenAI gpt-5.4 family", () => {
  assert.deepEqual(Object.keys(OPENAI_PROXY_MODEL_SPECS).sort(), [
    "gpt-5.4",
    "gpt-5.4-mini",
    "gpt-5.4-nano",
    "gpt-5.4-pro",
  ]);

  assert.deepEqual(buildOpenAiProxyModel("gpt-5.4"), {
    id: "gpt-5.4",
    name: "gpt-5.4",
    provider: "openai-proxy",
    api: "openai-responses",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 2.5, output: 15, cacheRead: 0.25, cacheWrite: 0 },
    contextWindow: 1_050_000,
    maxTokens: 128_000,
  });

  assert.equal(buildOpenAiProxyModel("unknown-model"), undefined);
});

test("openai-proxy replay policy mirrors native OpenAI Responses replay", () => {
  assert.deepEqual(buildOpenAiProxyReplayPolicy({ modelApi: "openai-responses" }), {
    sanitizeMode: "images-only",
    applyAssistantFirstOrderingFix: false,
    validateGeminiTurns: false,
    validateAnthropicTurns: false,
    sanitizeToolCallIds: false,
  });

  assert.deepEqual(buildOpenAiProxyReplayPolicy({ modelApi: "openai-completions" }), {
    sanitizeMode: "images-only",
    applyAssistantFirstOrderingFix: false,
    validateGeminiTurns: false,
    validateAnthropicTurns: false,
    sanitizeToolCallIds: true,
    toolCallIdMode: "strict",
  });
});

test("openai-proxy transport state sanitizes correlation headers and metadata", () => {
  const provider = buildProviderForTest();
  const state = provider.resolveTransportTurnState({
    provider: "openai-proxy",
    transport: "websocket",
    sessionId: " session\n1 ",
    turnId: " turn\r2 ",
    attempt: 3,
  });

  assert.deepEqual(state, {
    headers: {
      "x-openclaw-session-id": "session 1",
      "x-openclaw-turn-id": "turn 2",
      "x-openclaw-turn-attempt": "3",
    },
    metadata: {
      openclaw_session_id: "session 1",
      openclaw_turn_id: "turn 2",
      openclaw_turn_attempt: "3",
      openclaw_transport: "websocket",
    },
  });

  assert.deepEqual(
    provider.resolveWebSocketSessionPolicy({
      provider: "openai-proxy",
      sessionId: "session-1",
    }),
    {
      headers: {
        "x-openclaw-session-id": "session-1",
      },
      degradeCooldownMs: 60_000,
    },
  );
});

test("openai-proxy provider emits safe tenant-side diagnostics", async () => {
  const events = [];
  const logger = {
    info(message, fields) {
      events.push({ level: "info", message, fields });
    },
  };
  const provider = buildProviderForTest({ logger });

  provider.prepareExtraParams({
    modelId: "gpt-5.4",
    extraParams: { transport: "sse", openaiWsWarmup: false },
  });
  provider.buildReplayPolicy({ modelApi: "openai-responses" });
  provider.resolveTransportTurnState({
    provider: "openai-proxy",
    transport: "sse",
    sessionId: "session-1",
    turnId: "turn-1",
    attempt: 2,
  });
  provider.resolveWebSocketSessionPolicy({
    provider: "openai-proxy",
    sessionId: "session-1",
  });
  await provider.prepareRuntimeAuth({
    apiKey: "tenant-token-secret",
    env: { OTTO_CONTROL_PLANE_BASE_URL: "https://otto.example/" },
  });

  assert.deepEqual(
    events.map((event) => event.message),
    [
      "[otto-ai-provider] provider initialized",
      "[otto-ai-provider] extra params prepared",
      "[otto-ai-provider] replay policy resolved",
      "[otto-ai-provider] transport turn state resolved",
      "[otto-ai-provider] websocket session policy resolved",
      "[otto-ai-provider] runtime auth resolved",
    ],
  );
  assert.equal(events.at(-1).fields.hasApiKey, true);
  assert.equal(events.at(-1).fields.apiKeyLength, 19);
  assert.equal(events.at(-1).fields.apiKey, undefined);
  assert.equal(events.at(-1).fields.baseUrl, "https://otto.example/api/internal/runtime/ai/openai/v1");
});
