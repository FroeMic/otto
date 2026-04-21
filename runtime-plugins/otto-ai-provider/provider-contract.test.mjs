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
import {
  resolveOpenAiProxyTransport,
  toOpenAiProxyWebSocketUrl,
} from "./transport.js";
import { resolveOpenAiProxyWebSocketTenantToken } from "./responses-websocket.js";

const silentLogger = {
  info() {},
  warn() {},
};

function buildProviderForTest(dependencies = {}) {
  return buildOpenAiProxyProvider({ logger: silentLogger, ...dependencies });
}

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
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

test("openai-proxy transport env defaults to forced SSE and validates overrides", () => {
  assert.deepEqual(resolveOpenAiProxyTransport({}), {
    transport: "sse",
    source: "default",
  });
  assert.deepEqual(resolveOpenAiProxyTransport({ OTTO_OPENAI_PROXY_TRANSPORT: "websocket" }), {
    transport: "websocket",
    source: "env",
  });
  assert.deepEqual(resolveOpenAiProxyTransport({ OTTO_OPENAI_PROXY_TRANSPORT: " sse " }), {
    transport: "sse",
    source: "env",
  });
  assert.throws(
    () => resolveOpenAiProxyTransport({ OTTO_OPENAI_PROXY_TRANSPORT: "auto" }),
    /Invalid OTTO_OPENAI_PROXY_TRANSPORT "auto"/,
  );
});

test("openai-proxy websocket URL mirrors native Responses path", () => {
  assert.equal(
    toOpenAiProxyWebSocketUrl("https://otto.example/api/internal/runtime/ai/openai/v1"),
    "wss://otto.example/api/internal/runtime/ai/openai/v1/responses",
  );
  assert.equal(
    toOpenAiProxyWebSocketUrl("http://127.0.0.1:3002/api/internal/runtime/ai/openai/v1/"),
    "ws://127.0.0.1:3002/api/internal/runtime/ai/openai/v1/responses",
  );
});

test("openai-proxy websocket auth falls back to tenant env token", () => {
  assert.equal(
    resolveOpenAiProxyWebSocketTenantToken(
      { apiKey: " runtime-token " },
      { TENANT_TOKEN: "tenant-token" },
    ),
    "runtime-token",
  );

  assert.equal(
    resolveOpenAiProxyWebSocketTenantToken({}, { TENANT_TOKEN: " tenant-token " }),
    "tenant-token",
  );

  assert.throws(
    () => resolveOpenAiProxyWebSocketTenantToken({}, {}),
    /OpenAI proxy WebSocket transport requires a tenant token/,
  );
});

test("openai-proxy extra params use forced transport defaults", () => {
  const provider = buildProviderForTest();

  assert.deepEqual(provider.prepareExtraParams({ extraParams: {} }), {
    transport: "sse",
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
      transport: "sse",
      openaiWsWarmup: true,
      serviceTier: "priority",
    },
  );

  const previous = process.env.OTTO_OPENAI_PROXY_TRANSPORT;
  process.env.OTTO_OPENAI_PROXY_TRANSPORT = "websocket";
  try {
    assert.deepEqual(provider.prepareExtraParams({ extraParams: {} }), {
      transport: "websocket",
      openaiWsWarmup: true,
    });
  } finally {
    restoreEnv("OTTO_OPENAI_PROXY_TRANSPORT", previous);
  }
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

  assert.deepEqual(
    resolveOpenAiProxyRuntimeAuth({
      apiKey: "tenant-token",
      env: {
        OTTO_CONTROL_PLANE_BASE_URL: "https://otto.example/",
        OTTO_OPENAI_PROXY_BASE_URL: "http://116.203.190.123:3002/",
      },
    }),
    {
      apiKey: "tenant-token",
      baseUrl: "http://116.203.190.123:3002/api/internal/runtime/ai/openai/v1",
    },
  );

  assert.throws(
    () => resolveOpenAiProxyRuntimeAuth({ apiKey: "tenant-token", env: {} }),
    /OTTO_OPENAI_PROXY_BASE_URL or OTTO_CONTROL_PLANE_BASE_URL is required/,
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

test("openai-proxy provider wraps stream function lifecycle with safe diagnostics", async () => {
  const events = [];
  const logger = {
    info(message, fields) {
      events.push({ level: "info", message, fields });
    },
    error(message, fields) {
      events.push({ level: "error", message, fields });
    },
  };
  const abortController = new AbortController();
  const innerStreamFn = async () => ({ ok: true });
  const provider = buildProviderForTest({
    logger,
    openAiResponsesStreamHooks: {
      wrapStreamFn: () => innerStreamFn,
    },
  });

  const wrapped = provider.wrapStreamFn({
    provider: "openai-proxy",
    modelId: "gpt-5.4",
    transport: "sse",
    sessionId: "session-1",
    turnId: "turn-1",
    attempt: 2,
    streamFn: async () => ({ unreachable: true }),
  });

  assert.equal(typeof wrapped, "function");
  const result = await wrapped(
    { provider: "openai-proxy", id: "gpt-5.4", api: "openai-responses" },
    { messages: [] },
    { signal: abortController.signal, transport: "sse" },
  );

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(
    events.map((event) => event.message),
    [
      "[otto-ai-provider] provider initialized",
      "[otto-ai-provider] stream hook invoked",
      "[otto-ai-provider] stream function starting",
      "[otto-ai-provider] transport resolved",
      "[otto-ai-provider] stream function completed",
    ],
  );
  const startingLog = events.find(
    (event) => event.message === "[otto-ai-provider] stream function starting",
  );
  assert.equal(startingLog?.fields.hasAbortSignal, true);
  assert.equal(startingLog?.fields.signalAborted, false);
  assert.equal(events.at(-1).fields.error, undefined);
});

test("openai-proxy provider uses SSE branch when transport resolves to sse", async () => {
  const previous = process.env.OTTO_OPENAI_PROXY_TRANSPORT;
  delete process.env.OTTO_OPENAI_PROXY_TRANSPORT;
  const calls = [];
  const provider = buildProviderForTest({
    openAiResponsesStreamHooks: {
      wrapStreamFn: () => async (_model, _context, options) => {
        calls.push(options.transport);
        return { ok: true };
      },
    },
  });

  try {
    const wrapped = provider.wrapStreamFn({
      provider: "openai-proxy",
      modelId: "gpt-5.4",
      streamFn: async () => ({ unreachable: true }),
    });
    const result = await wrapped(
      { provider: "openai-proxy", id: "gpt-5.4", api: "openai-responses" },
      { messages: [] },
      {},
    );

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(calls, ["sse"]);
  } finally {
    restoreEnv("OTTO_OPENAI_PROXY_TRANSPORT", previous);
  }
});

test("openai-proxy provider uses WebSocket branch when transport resolves to websocket", async () => {
  const previous = process.env.OTTO_OPENAI_PROXY_TRANSPORT;
  process.env.OTTO_OPENAI_PROXY_TRANSPORT = "websocket";
  const calls = [];
  const provider = buildProviderForTest({
    openAiResponsesStreamHooks: {
      wrapStreamFn: () => async () => {
        calls.push("sse");
        return { ok: false };
      },
    },
    createWebSocketStreamFn: () => async (_model, _context, options) => {
      calls.push(options.transport);
      return { ok: true };
    },
  });

  try {
    const wrapped = provider.wrapStreamFn({
      provider: "openai-proxy",
      modelId: "gpt-5.4",
      streamFn: async () => ({ unreachable: true }),
    });
    const result = await wrapped(
      { provider: "openai-proxy", id: "gpt-5.4", api: "openai-responses" },
      { messages: [] },
      {},
    );

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(calls, ["websocket"]);
  } finally {
    restoreEnv("OTTO_OPENAI_PROXY_TRANSPORT", previous);
  }
});

test("openai-proxy provider logs stream abort signal and failure", async () => {
  const events = [];
  const logger = {
    info(message, fields) {
      events.push({ level: "info", message, fields });
    },
    warn(message, fields) {
      events.push({ level: "warn", message, fields });
    },
    error(message, fields) {
      events.push({ level: "error", message, fields });
    },
  };
  const abortController = new AbortController();
  const provider = buildProviderForTest({
    logger,
    openAiResponsesStreamHooks: {
      wrapStreamFn: () => async () => {
        abortController.abort("runner cancelled");
        throw new Error("terminated");
      },
    },
  });

  const wrapped = provider.wrapStreamFn({
    provider: "openai-proxy",
    modelId: "gpt-5.4",
    transport: "sse",
    sessionId: "session-1",
    turnId: "turn-1",
    attempt: 2,
    streamFn: async () => ({ unreachable: true }),
  });

  await assert.rejects(
    () =>
      wrapped(
        { provider: "openai-proxy", id: "gpt-5.4", api: "openai-responses" },
        { messages: [] },
        { signal: abortController.signal, transport: "sse" },
      ),
    /terminated/,
  );

  const abortLog = events.find(
    (event) => event.message === "[otto-ai-provider] stream function abort signal received",
  );
  assert.equal(abortLog?.level, "warn");
  assert.equal(abortLog?.fields.abortReason, "runner cancelled");

  const failedLog = events.find(
    (event) => event.message === "[otto-ai-provider] stream function failed",
  );
  assert.equal(failedLog?.level, "error");
  assert.equal(failedLog?.fields.error, "terminated");
  assert.equal(failedLog?.fields.signalAborted, true);
});

test("openai-proxy provider logs returned stream consumption lifecycle", async () => {
  const events = [];
  const logger = {
    info(message, fields) {
      events.push({ level: "info", message, fields });
    },
    warn(message, fields) {
      events.push({ level: "warn", message, fields });
    },
    error(message, fields) {
      events.push({ level: "error", message, fields });
    },
  };
  const provider = buildProviderForTest({
    logger,
    openAiResponsesStreamHooks: {
      wrapStreamFn: () => async function* () {
        yield { type: "response.created" };
        yield { type: "response.in_progress" };
        yield { type: "response.completed" };
      },
    },
  });

  const wrapped = provider.wrapStreamFn({
    provider: "openai-proxy",
    modelId: "gpt-5.4",
    transport: "sse",
    sessionId: "session-1",
    turnId: "turn-1",
    attempt: 2,
    streamFn: async () => ({ unreachable: true }),
  });

  const stream = await wrapped(
    { provider: "openai-proxy", id: "gpt-5.4", api: "openai-responses" },
    { messages: [] },
    { transport: "sse" },
  );
  const seen = [];
  for await (const event of stream) {
    seen.push(event.type);
  }

  assert.deepEqual(seen, [
    "response.created",
    "response.in_progress",
    "response.completed",
  ]);
  assert.ok(
    events.some(
      (event) =>
        event.message === "[otto-ai-provider] stream iteration started" &&
        event.fields.provider === "openai-proxy",
    ),
  );
  const completedLog = events.find(
    (event) => event.message === "[otto-ai-provider] stream iteration completed",
  );
  assert.equal(completedLog?.level, "info");
  assert.equal(completedLog?.fields.events, 3);
  assert.equal(completedLog?.fields.firstEventType, "response.created");
  assert.equal(completedLog?.fields.lastEventType, "response.completed");
});

test("openai-proxy provider logs returned stream early close", async () => {
  const events = [];
  const logger = {
    info(message, fields) {
      events.push({ level: "info", message, fields });
    },
    warn(message, fields) {
      events.push({ level: "warn", message, fields });
    },
    error(message, fields) {
      events.push({ level: "error", message, fields });
    },
  };
  const provider = buildProviderForTest({
    logger,
    openAiResponsesStreamHooks: {
      wrapStreamFn: () => async function* () {
        yield { type: "response.created" };
        yield { type: "response.in_progress" };
      },
    },
  });

  const wrapped = provider.wrapStreamFn({
    provider: "openai-proxy",
    modelId: "gpt-5.4",
    transport: "sse",
    sessionId: "session-1",
    turnId: "turn-1",
    attempt: 2,
    streamFn: async () => ({ unreachable: true }),
  });

  const stream = await wrapped(
    { provider: "openai-proxy", id: "gpt-5.4", api: "openai-responses" },
    { messages: [] },
    { transport: "sse" },
  );

  for await (const event of stream) {
    assert.equal(event.type, "response.created");
    break;
  }

  const closedLog = events.find(
    (event) => event.message === "[otto-ai-provider] stream iteration closed early",
  );
  assert.equal(closedLog?.level, "warn");
  assert.equal(closedLog?.fields.events, 1);
  assert.equal(closedLog?.fields.lastEventType, "response.created");
  assert.equal(closedLog?.fields.terminalEventType, undefined);
});

test("openai-proxy provider logs returned stream iteration failure", async () => {
  const events = [];
  const logger = {
    info(message, fields) {
      events.push({ level: "info", message, fields });
    },
    warn(message, fields) {
      events.push({ level: "warn", message, fields });
    },
    error(message, fields) {
      events.push({ level: "error", message, fields });
    },
  };
  const provider = buildProviderForTest({
    logger,
    openAiResponsesStreamHooks: {
      wrapStreamFn: () => async function* () {
        yield { type: "response.created" };
        throw new Error("iterator terminated");
      },
    },
  });

  const wrapped = provider.wrapStreamFn({
    provider: "openai-proxy",
    modelId: "gpt-5.4",
    transport: "sse",
    sessionId: "session-1",
    turnId: "turn-1",
    attempt: 2,
    streamFn: async () => ({ unreachable: true }),
  });

  const stream = await wrapped(
    { provider: "openai-proxy", id: "gpt-5.4", api: "openai-responses" },
    { messages: [] },
    { transport: "sse" },
  );

  await assert.rejects(async () => {
    for await (const _event of stream) {
      // drain
    }
  }, /iterator terminated/);

  const failedLog = events.find(
    (event) => event.message === "[otto-ai-provider] stream iteration failed",
  );
  assert.equal(failedLog?.level, "error");
  assert.equal(failedLog?.fields.events, 1);
  assert.equal(failedLog?.fields.error, "iterator terminated");
});

test("openai-proxy provider logs yielded error event payload", async () => {
  const events = [];
  const logger = {
    info(message, fields) {
      events.push({ level: "info", message, fields });
    },
    warn(message, fields) {
      events.push({ level: "warn", message, fields });
    },
    error(message, fields) {
      events.push({ level: "error", message, fields });
    },
  };
  const provider = buildProviderForTest({
    logger,
    openAiResponsesStreamHooks: {
      wrapStreamFn: () => async function* () {
        yield {
          type: "response.created",
          response: {
            id: "resp_123",
            output: [],
            status: "in_progress",
          },
        };
        yield {
          type: "error",
          reason: "error",
          error: {
            name: "TypeError",
            message: "terminated",
            code: "UND_ERR_SOCKET",
            content: [
              {
                type: "text",
                text: "terminated\nwhile streaming",
                metadata: {
                  token: "secret-content-token",
                  source: "adapter",
                },
              },
            ],
            stack: "should not be logged",
            headers: { authorization: "Bearer secret-token" },
            cause: {
              name: "SocketError",
              message: "other side closed",
              code: "UND_ERR_SOCKET",
            },
          },
        };
      },
    },
  });

  const wrapped = provider.wrapStreamFn({
    provider: "openai-proxy",
    modelId: "gpt-5.4",
    transport: "sse",
    sessionId: "session-1",
    turnId: "turn-1",
    attempt: 2,
    streamFn: async () => ({ unreachable: true }),
  });

  const stream = await wrapped(
    { provider: "openai-proxy", id: "gpt-5.4", api: "openai-responses" },
    { messages: [] },
    { transport: "sse" },
  );

  const seen = [];
  for await (const event of stream) {
    seen.push(event.type);
  }

  assert.deepEqual(seen, ["response.created", "error"]);
  const errorEventLog = events.find(
    (event) => event.message === "[otto-ai-provider] stream yielded error event",
  );
  assert.equal(errorEventLog?.level, "error");
  assert.deepEqual(errorEventLog?.fields.eventTypeCounts, {
    error: 1,
    "response.created": 1,
  });
  assert.equal(errorEventLog?.fields.eventType, "error");
  assert.equal(errorEventLog?.fields.eventReason, "error");
  assert.equal(errorEventLog?.fields.eventError?.message, "terminated");
  assert.equal(errorEventLog?.fields.eventError?.code, "UND_ERR_SOCKET");
  assert.equal(errorEventLog?.fields.eventError?.stack, "should not be logged");
  assert.equal(
    errorEventLog?.fields.eventError?.headers?.authorization,
    "Bearer secret-token",
  );
  assert.equal(errorEventLog?.fields.eventErrorName, "TypeError");
  assert.equal(errorEventLog?.fields.eventErrorMessage, "terminated");
  assert.equal(errorEventLog?.fields.eventErrorCode, "UND_ERR_SOCKET");
  assert.equal(errorEventLog?.fields.eventErrorCauseName, "SocketError");
  assert.equal(errorEventLog?.fields.eventErrorCauseMessage, "other side closed");
  assert.equal(errorEventLog?.fields.eventErrorCauseCode, "UND_ERR_SOCKET");
  assert.equal(errorEventLog?.fields.eventErrorContentKind, "array");
  assert.equal(errorEventLog?.fields.eventErrorContentLength, 1);
  assert.deepEqual(errorEventLog?.fields.eventErrorContentPreview, [
    {
      metadata: {
        source: "adapter",
        token: "[redacted]",
      },
      text: "terminated while streaming",
      type: "text",
    },
  ]);
  assert.deepEqual(errorEventLog?.fields.recentEventShapes, [
    {
      contentKind: "array",
      contentLength: 0,
      contentItemShapes: [],
      errorKind: "undefined",
      eventType: "response.created",
      fieldKinds: {
        response: "object",
        type: "string",
      },
      keys: ["response", "type"],
      outputFieldKinds: {
        id: "string",
        output: "array",
        status: "string",
      },
      outputKeys: ["id", "output", "status"],
      responseIdPresent: true,
      sequence: 1,
      valueKind: "object",
    },
    {
      errorContentItemShapes: [
        {
          fieldKinds: {
            metadata: "object",
            text: "string",
            type: "string",
          },
          keys: ["metadata", "text", "type"],
          textKind: "string",
          textLength: 26,
          type: "text",
        },
      ],
      errorContentKind: "array",
      errorContentLength: 1,
      errorFieldKinds: {
        cause: "object",
        code: "string",
        content: "array",
        headers: "object",
        message: "string",
        name: "string",
        stack: "string",
      },
      errorKeys: [
        "cause",
        "code",
        "content",
        "headers",
        "message",
        "name",
        "stack",
      ],
      errorKind: "object",
      eventType: "error",
      fieldKinds: {
        error: "object",
        reason: "string",
        type: "string",
      },
      keys: ["error", "reason", "type"],
      responseIdPresent: false,
      sequence: 2,
      valueKind: "object",
    },
  ]);
  assert.deepEqual(errorEventLog?.fields.eventKeys, ["error", "reason", "type"]);
});

test("openai-proxy provider can wrap an already instrumented stream without recursion", async () => {
  const events = [];
  const logger = {
    info(message, fields) {
      events.push({ level: "info", message, fields });
    },
    warn(message, fields) {
      events.push({ level: "warn", message, fields });
    },
    error(message, fields) {
      events.push({ level: "error", message, fields });
    },
  };
  const sourceStream = {
    async *[Symbol.asyncIterator]() {
      yield { type: "response.created" };
      yield { type: "response.completed" };
    },
  };
  const provider = buildProviderForTest({
    logger,
    openAiResponsesStreamHooks: {
      wrapStreamFn: () => async () => sourceStream,
    },
  });

  const firstWrapped = provider.wrapStreamFn({
    provider: "openai-proxy",
    modelId: "gpt-5.4",
    transport: "sse",
    streamFn: async () => ({ unreachable: true }),
  });
  const firstStream = await firstWrapped(
    { provider: "openai-proxy", id: "gpt-5.4", api: "openai-responses" },
    { messages: [] },
    { transport: "sse" },
  );

  const secondProvider = buildProviderForTest({
    logger,
    openAiResponsesStreamHooks: {
      wrapStreamFn: () => async () => firstStream,
    },
  });
  const secondWrapped = secondProvider.wrapStreamFn({
    provider: "openai-proxy",
    modelId: "gpt-5.4",
    transport: "sse",
    streamFn: async () => ({ unreachable: true }),
  });
  const secondStream = await secondWrapped(
    { provider: "openai-proxy", id: "gpt-5.4", api: "openai-responses" },
    { messages: [] },
    { transport: "sse" },
  );

  const seen = [];
  for await (const event of secondStream) {
    seen.push(event.type);
  }

  assert.deepEqual(seen, ["response.created", "response.completed"]);
  assert.equal(
    events.some(
      (event) =>
        event.message === "[otto-ai-provider] stream iteration failed" &&
        event.fields.error === "Maximum call stack size exceeded",
    ),
    false,
  );
});
