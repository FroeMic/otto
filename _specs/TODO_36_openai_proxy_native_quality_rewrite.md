# TODO 36: OpenAI Proxy Native-Quality Rewrite

## Goal

Rewrite Otto's `openai-proxy` runtime provider and control-plane OpenAI proxy so
managed tenant runtimes get native-quality OpenAI Responses behavior without
receiving upstream OpenAI credentials and without spoofing OpenClaw's bundled
`openai` provider id.

The target provider remains:

```text
openai-proxy/gpt-5.4
```

The provider should mirror OpenClaw's bundled OpenAI provider as closely as
possible through explicit provider hooks, model metadata, replay behavior,
transport policy, WebSocket-capable proxying, and stream correctness checks.

## Scope

- Replace the current thin `runtime-plugins/otto-ai-provider` shim with a
  native-shaped `openai-proxy` provider implementation.
- Keep provider id `openai-proxy`; do not register or shadow `openai`.
- Remove deprecated `capabilities.providerFamily` usage.
- Adopt OpenClaw's OpenAI Responses stream family hooks where available.
- Mirror native OpenAI model metadata for the supported GPT-5.4 model family.
- Add provider-owned replay, reasoning, transport, runtime-auth, and
  correlation behavior.
- Rewrite the control-plane `/api/internal/runtime/ai/openai/v1/responses`
  proxy as an OpenAI Responses-aware proxy instead of a generic byte pipe.
- Add WebSocket proxy support because native OpenAI works over WebSocket and
  the proxy should preserve that path instead of forcing SSE.
- Add terminal-event validation so incomplete streams cannot become successful
  assistant output.
- Add tests before implementation changes and keep each implementation step
  buildable, testable, and commit-sized.

## Non-goals

- Do not rename the provider to `openai`.
- Do not preserve compatibility with the current thin provider internals.
- Do not expose upstream OpenAI keys to tenant runtimes.
- Do not implement a generic all-provider AI gateway abstraction in this slice.
- Do not reproduce unrelated native OpenAI capability providers unless they are
  already part of `otto-ai-provider` or needed by this proxy path.
- Do not change browser-facing copy or workspace UI.

## Dependencies

- `TODO_16_runtime_ai_provider_proxy.md` for the original AI proxy boundary.
- `TODO_27_openclaw_2026_4_12_runtime_upgrade.md` for the current runtime
  plugin compatibility baseline.
- OpenClaw native provider reference files:
  - `extensions/openai/openai-provider.ts`
  - `extensions/openai/openai-codex-provider.ts`
  - `extensions/openai/transport-policy.ts`
  - `extensions/openai/replay-policy.ts`
  - `src/plugin-sdk/provider-stream.ts`

## Architecture Decision

`openai-proxy` is a distinct managed OpenAI provider. It should not pretend to
be OpenClaw's direct `openai` provider, but it should explicitly implement the
same relevant provider contract:

- OpenAI Responses model metadata
- OpenAI Responses replay policy
- native reasoning mode
- native OpenAI stream wrapper family
- transport turn metadata
- WebSocket-first transport support when OpenClaw requests it
- strict terminal-event stream validation at the control-plane proxy boundary

The control-plane proxy becomes part of the provider correctness boundary. It
must know whether a Responses stream completed, failed, or ended incomplete.

## Provider Requirements

### Provider Identity

- Plugin id remains `otto-ai-provider`.
- Provider id remains `openai-proxy`.
- Default model becomes `openai-proxy/gpt-5.4`.
- Runtime auth uses `TENANT_TOKEN`.
- Runtime base URL resolves from `OTTO_OPENAI_PROXY_BASE_URL`, falling back to
  `OTTO_CONTROL_PLANE_BASE_URL`.

### Provider Hooks

The provider must implement or adopt:

- `resolveDynamicModel`
- `normalizeResolvedModel`
- `normalizeTransport`
- `buildReplayPolicy`
- `prepareExtraParams`
- `wrapStreamFn` via `buildProviderStreamFamilyHooks("openai-responses-defaults")`
- `resolveTransportTurnState`
- `resolveWebSocketSessionPolicy`
- `resolveReasoningOutputMode`
- `supportsXHighThinking`
- `isModernModelRef`
- `prepareRuntimeAuth`

The provider must remove:

```js
capabilities: {
  providerFamily: "openai",
}
```

That field is deprecated in OpenClaw and no longer represents runtime stream or
replay ownership.

### Model Catalog

Support explicit model ids first:

- `gpt-5.4`
- `gpt-5.4-pro`
- `gpt-5.4-mini`
- `gpt-5.4-nano`

Mirror native OpenAI metadata unless an Otto-owned limit is documented:

| Model | Context window | Max output | Reasoning | Inputs |
| --- | ---: | ---: | --- | --- |
| `gpt-5.4` | `1_050_000` | `128_000` | yes | text, image |
| `gpt-5.4-pro` | `1_050_000` | `128_000` | yes | text, image |
| `gpt-5.4-mini` | `400_000` | `128_000` | yes | text, image |
| `gpt-5.4-nano` | `400_000` | `128_000` | yes | text, image |

Cost metadata should mirror native OpenAI metadata unless billing explicitly
requires zero-cost internal display.

Unknown model ids should fail clearly unless a later step adds an explicit
forward-compatible model policy.

### Runtime Auth

`prepareRuntimeAuth` must:

- require `OTTO_OPENAI_PROXY_BASE_URL` or `OTTO_CONTROL_PLANE_BASE_URL`
- trim trailing slashes
- use `ctx.apiKey` as the tenant runtime bearer
- return a base URL ending in `/api/internal/runtime/ai/openai/v1`
- fail with precise operator-facing errors

### Transport Policy

Native OpenAI currently works over WebSocket. The proxy must therefore support
OpenClaw's WebSocket path instead of permanently forcing SSE.

`prepareExtraParams` should mirror native OpenAI defaults:

```js
transport: "auto"
openaiWsWarmup: true
```

Explicit supported values remain valid:

```text
auto
sse
websocket
```

The provider may override unsupported values, but it should not silently force
SSE once the control-plane WebSocket proxy is implemented.

### Replay Policy

Mirror native OpenAI replay policy:

```js
{
  sanitizeMode: "images-only",
  applyAssistantFirstOrderingFix: false,
  validateGeminiTurns: false,
  validateAnthropicTurns: false,
  sanitizeToolCallIds: false,
}
```

Only apply strict tool-call id sanitation for `openai-completions`
compatibility if that compatibility path remains supported.

### Reasoning Mode

Set:

```js
resolveReasoningOutputMode: () => "native"
```

### Turn Correlation

`resolveTransportTurnState` and `resolveWebSocketSessionPolicy` must attach
sanitized request identity:

Headers:

- `x-openclaw-session-id`
- `x-openclaw-turn-id`
- `x-openclaw-turn-attempt`

Metadata:

- `openclaw_session_id`
- `openclaw_turn_id`
- `openclaw_turn_attempt`
- `openclaw_transport`

Values must be trimmed, CR/LF-stripped, length-bounded, and omitted when empty.

## Control-Plane Proxy Requirements

### HTTP SSE Responses Proxy

The `/responses` HTTP stream path must parse SSE framing while forwarding bytes.
It must track:

- first event type
- last event type
- terminal event type
- response id
- output item count
- bytes
- chunks
- upstream request id
- OpenClaw session/turn/attempt

Terminal events:

- `response.completed`
- `response.failed`
- `error`

Success requires `response.completed`.

Failures:

- `response.failed`
- `error`
- EOF before terminal
- upstream read error before terminal
- downstream cancel before terminal

Incomplete streams must not close cleanly. They must produce a failed stream so
OpenClaw cannot treat partial output as a valid assistant completion.

### WebSocket Responses Proxy

Add a WebSocket proxy for OpenAI Responses so `openai-proxy` can support native
OpenAI's `transport: "auto"` and `transport: "websocket"` paths.

The proxy must:

- authenticate tenant runtime requests with the same runtime auth as HTTP proxy
  calls
- connect upstream to OpenAI's native WebSocket Responses endpoint
- inject the upstream OpenAI credential only on the control-plane side
- forward frames with minimal mutation
- preserve OpenClaw session/turn/attempt correlation
- observe terminal events when available
- classify abnormal close before terminal as incomplete/failure
- log close codes and reasons for both downstream and upstream sockets

The route shape should stay under the runtime AI proxy namespace. If OpenClaw's
client constructs WebSocket URLs by converting the configured base URL, the
control-plane route must match that expectation.

### Logging

Do not log prompts, tool arguments, or response text.

Log structured request/stream metadata:

- `requestId`
- `tenantId`
- `route`
- `transport`
- `bodyBytes` for HTTP
- `upstreamRequestId` when available
- `openclawSessionId`
- `openclawTurnId`
- `openclawTurnAttempt`
- `terminalEventType`
- `streamOutcome`
- `bytes`
- `chunks`
- `durationMs`
- close code/reason for WebSocket

Downgrade or suppress `Invalid state: Controller is already closed` when the
stream has already reached a known terminal or cancel state.

### Header Policy

Strip true hop-by-hop headers:

- `connection`
- `keep-alive`
- `proxy-authenticate`
- `proxy-authorization`
- `te`
- `trailer`
- `transfer-encoding`
- `upgrade`
- `host`
- `content-length`
- `authorization`

Review `content-encoding` carefully. If the fetch layer decompresses upstream
responses, do not forward stale content-encoding headers.

## Test Plan

### Provider Tests

- Provider id is `openai-proxy`.
- Default model is `openai-proxy/gpt-5.4`.
- Deprecated `capabilities.providerFamily` is absent.
- Auth uses `TENANT_TOKEN`.
- Runtime auth prefers `OTTO_OPENAI_PROXY_BASE_URL` and falls back to
  `OTTO_CONTROL_PLANE_BASE_URL`.
- Runtime auth trims trailing slash and returns the OpenAI proxy base URL.
- `prepareExtraParams` defaults to `transport: "auto"` and
  `openaiWsWarmup: true`.
- Explicit `transport: "sse"` is preserved.
- Explicit `transport: "websocket"` is preserved.
- Replay policy matches native OpenAI Responses expectations.
- Reasoning output mode is `native`.
- Stream family hook is installed.
- Transport turn state emits sanitized headers and metadata.
- WebSocket session policy emits sanitized headers and cooldown behavior.
- Model metadata matches supported GPT-5.4 family models.
- Unknown model ids fail clearly.

### Control-Plane HTTP Proxy Tests

- Complete SSE stream with `response.completed` closes cleanly.
- `response.failed` logs terminal failure.
- `error` logs terminal failure.
- EOF before terminal errors downstream.
- Chunk boundaries inside SSE frames are handled.
- Multiple SSE frames in one chunk are handled.
- Downstream cancel before terminal logs incomplete cancellation.
- Downstream cancel after terminal does not log false upstream failure.
- Correlation headers appear in logs.
- Non-2xx upstream responses forward correctly.
- Invalid response content encoding is not forwarded after decompression.

### Control-Plane WebSocket Proxy Tests

- Authenticated downstream WebSocket connects to upstream OpenAI WebSocket.
- Missing/invalid runtime auth rejects the connection.
- Downstream frames forward upstream.
- Upstream frames forward downstream.
- Terminal event marks stream complete.
- Upstream abnormal close before terminal marks stream incomplete.
- Downstream close before terminal cancels upstream and logs incomplete.
- Close codes and reasons are logged.
- Correlation headers are logged.

### End-to-End Smoke

- Tenant runtime resolves `openai-proxy/gpt-5.4`.
- `transport: "auto"` can use WebSocket through the control-plane proxy.
- `transport: "sse"` can use HTTP SSE through the control-plane proxy.
- Successful run logs `response.completed`.
- Fault-injected truncated HTTP stream fails cleanly.
- Fault-injected abnormal WebSocket close fails cleanly.
- Workspace chat and Slack delivery surfaces receive a failed turn rather than
  bogus partial output.

## Roadmap

### Step 1: Spec and Roadmap

- [x] Add this spec.
- [x] Update `_specs/README.md`.
- [x] Update `_specs/STATUS.md`.
- [x] Build/test docs-only baseline.
- [x] Commit.

### Step 2: Provider Contract Tests

- [x] Add failing tests for the native-shaped `openai-proxy` provider contract.
- [x] Verify tests fail against the current provider.
- [x] Commit failing tests only if local workflow allows, otherwise keep the
      red/green pair in one commit with command output noted.

### Step 3: Provider Rewrite

- [x] Implement explicit model catalog.
- [x] Implement native-style replay policy.
- [x] Implement native-style transport defaults.
- [x] Implement runtime auth helper.
- [x] Implement transport turn state and WebSocket session policy.
- [x] Adopt OpenAI Responses stream family hooks.
- [x] Remove deprecated capability field.
- [x] Run provider tests.
- [x] Run relevant build.
- [x] Commit.

### Step 4: HTTP SSE Proxy Tests

- [x] Add failing tests for SSE terminal detection and incomplete-stream
      behavior.
- [x] Verify tests fail against the current proxy.
- [x] Commit failing tests only if local workflow allows, otherwise keep the
      red/green pair in one commit with command output noted.

### Step 5: HTTP SSE Proxy Rewrite

- [x] Add SSE observer/parser.
- [x] Integrate parser into `/responses` proxy path.
- [x] Enforce terminal stream semantics.
- [x] Add correlation logging.
- [x] Clean up controller-close race logging.
- [x] Run API tests.
- [x] Run API build.
- [x] Commit.

### Step 6: WebSocket Proxy Tests

- [x] Add failing tests for authenticated WebSocket proxying and abnormal close
      classification.
- [x] Verify tests fail.
- [ ] Commit failing tests only if local workflow allows, otherwise keep the
      red/green pair in one commit with command output noted.

### Step 7: WebSocket Proxy Implementation

- [x] Add runtime-authenticated WebSocket route.
- [x] Connect upstream to OpenAI Responses WebSocket.
- [x] Forward downstream/upstream frames.
- [x] Inject upstream auth only in the control-plane.
- [x] Track terminal events and abnormal closes.
- [x] Run API tests.
- [x] Run API build.
- [x] Commit.

### Step 8: Integration Verification

- [x] Verify provider contract projects `openai-proxy/gpt-5.4` defaults.
- [x] Verify provider contract preserves both `transport: "auto"` defaults and
      explicit `transport: "sse"`.
- [x] Add follow-up SSE diagnostics for provider stream lifecycle, abort
      signals, safe Responses request shape, inbound request aborts, and recent
      terminal-event attribution.
- [x] Add follow-up tenant-side async stream consumption diagnostics so returned
      stream iteration start, completion, early close, and iterator failure are
      visible without logging prompt or response text.
- [x] Fix tenant-side async stream diagnostics to consume the captured source
      iterator directly instead of recursively re-entering a wrapped stream.
- [ ] Run representative long/tool-heavy turn.
- [ ] Run fault-injection for truncated SSE and abnormal WebSocket close.
- [x] Run local provider contract tests.
- [x] Run local OpenAI proxy tests.
- [x] Run local API build.
- [ ] Verify live tenant runtime config projects `openai-proxy/gpt-5.4`.
- [ ] Verify live `transport: "auto"` WebSocket path against real OpenAI
      credentials.
- [ ] Verify live `transport: "sse"` HTTP path against real OpenAI
      credentials.
- [x] Update status/spec checklist.
- [x] Commit final verification notes.

## Local Verification Notes

Passing:

```text
node --test runtime-plugins/otto-ai-provider/provider-contract.test.mjs
node --test runtime-plugins/otto-ai-provider/*.test.mjs
bun run --cwd apps/api test src/runtime/openai-proxy.test.ts
bun run build:api
git diff --check
```

Known broader API test baseline still failing outside this slice:

```text
bun run test:api
```

Current failures:

- `src/workspace/chat-realtime-routes.ts` imports `hono/bun` at module load
  time, which fails under non-Bun Vitest with `ReferenceError: Bun is not
  defined`.
- `src/skills/data.test.ts` expects only `name-and-domain-research` in
  `librarySkills`, but the current library includes `business-review` as well.

Live tenant verification is intentionally left for deployment because it needs
a tenant runtime, tenant bearer token, configured workspace OpenAI credential,
and real OpenAI WebSocket/SSE traffic.

## Acceptance Criteria

- `openai-proxy` is a native-shaped OpenAI Responses provider with explicit
  hooks instead of deprecated static capabilities.
- The tenant runtime still receives no upstream OpenAI key.
- Native OpenAI WebSocket behavior is supported through the control-plane proxy.
- HTTP SSE behavior is supported and terminal-event validated.
- Incomplete HTTP or WebSocket streams cannot become successful assistant
  completions.
- Logs correlate tenant, OpenClaw session, OpenClaw turn, control-plane request,
  transport, and upstream OpenAI request where available.
- Provider tests, API tests, and builds pass.
- The branch is deployable for tenant runtime testing.

## Open Questions

- Which exact WebSocket URL does OpenClaw's OpenAI transport derive from the
  configured `baseUrl`, and does the control-plane route need to mirror
  `/responses` exactly?
- Does OpenAI's WebSocket response stream expose upstream request ids in headers
  or only in event payloads?
- Should cost metadata mirror native OpenAI prices or stay zero because Otto
  billing uses provider usage ingestion?
- Should unknown GPT-5 family model ids fail, or should Otto expose an explicit
  forward-compatible dynamic model policy?
