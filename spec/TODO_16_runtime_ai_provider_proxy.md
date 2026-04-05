# TODO 16: Runtime AI Provider Proxy

## Goal

Remove upstream AI provider credentials from the tenant runtime and replace direct provider access with an Otto-owned AI gateway plus an Otto-owned OpenClaw plugin package.

The first shipping target is OpenAI-backed inference through an Otto provider entry named `openai-proxy`, packaged inside a plugin bundle named `otto-ai-provider`.

This should let Otto:

- keep upstream provider secrets only in the control plane
- authenticate tenant runtimes to Otto with tenant-scoped Otto credentials instead of upstream API keys
- preserve tenant-specific provider attribution and usage reconstruction across key rotations
- extend the same security boundary later to embeddings, speech output, and additional upstream providers

## Scope

- define the control-plane-side AI gateway service architecture
- define the runtime credential model that replaces `OPENAI_API_KEY` on tenant runtimes
- define the OpenClaw plugin/package shape for `otto-ai-provider`
- define the first `openai-proxy` provider entry for LLM inference
- define how OpenAI-compatible embeddings should flow through the same Otto gateway boundary
- define how speech / TTS provider proxying should work through Otto-owned speech provider entries
- define usage attribution, credential rotation, and audit requirements needed for billing and reconciliation
- define the rollout sequence from the current direct-key runtime model to the proxied model

## Non-goals

- implementing the gateway or plugin in this spec
- building a fully generic cross-provider inference protocol in v1
- proxying every upstream provider feature from day one
- replacing OpenClaw's local or CLI-based audio transcription path in this first slice
- redesigning all billing logic here beyond the proxy-side usage hooks required for future metering
- deciding the final user-facing product packaging for provider choice

## Dependencies

- `TODO_04_runtime_packaging.md` for shipping custom runtime images and Otto-owned plugins
- `TODO_05_config_apply_and_reconciliation.md` for runtime-projected credentials and desired-state rollout
- `TODO_06_integrations_and_oauth.md` for shared ingress and control-plane-owned external webhook patterns
- `TODO_11_runtime_release_rollout.md` for safely activating a runtime image that removes direct provider env vars
- `TODO_15_billing_and_credit_metering.md` for provider credential ownership, metering, and credit burn requirements
- the local OpenClaw repository analysis captured during this planning session:
  - provider runtime auth hooks in `src/plugins/types.ts`
  - runtime auth storage in `src/agents/pi-embedded-runner/run/auth-controller.ts`
  - memory embedding provider adapters in `src/plugins/memory-embedding-providers.ts`
  - speech provider capability interfaces in `src/plugins/types.ts`

## Problem statement

Today the tenant runtime still receives an upstream provider secret directly through projected env.

Current Otto behavior:

- the control plane historically wrote `OPENAI_API_KEY` into tenant runtime `.env`
- OpenClaw resolves provider auth from env / config / auth profiles
- the runner stores the resolved runtime credential in auth storage for inference

This is better than sharing one global runtime key, but it is still the wrong trust boundary:

- the tenant runtime can access an upstream provider credential directly
- runtime compromise would expose a real provider secret, not just Otto-scoped access
- future providers would require repeating the same secret-projection pattern
- it becomes harder to centralize billing, metering, provider policy, and abuse controls

The target state is:

- tenant runtime knows only Otto-issued credentials
- control plane knows upstream provider credentials
- Otto gateway exchanges runtime credentials for short-lived request credentials and forwards traffic upstream

## Decision summary

- Build one Otto-owned plugin package named `otto-ai-provider`.
- The first provider entry inside that package is `openai-proxy`.
- Do not ship a single provider id like `otto` that erases provider-family behavior.
- Keep provider-family behavior explicit so OpenClaw's OpenAI-specific transport and compat logic remain intact.
- Build a dedicated Otto AI gateway service on the control-plane side.
- Do not place this logic in thin Next.js route handlers.
- Remove direct upstream AI credentials from tenant runtime env once the proxy path is ready.
- Replace them with an Otto tenant runtime credential plus short-lived Otto access tokens.
- Keep the OpenAI project stable per workspace and rotate only service-account keys, not projects.
- Preserve historical credential rows and provider key IDs so usage can still be reconstructed across key rotation.

## Plugin shape

### Package

Use one plugin package named `otto-ai-provider`.

Reason:

- one codebase for Otto-owned auth exchange and gateway behavior
- one trust boundary for all Otto-managed AI provider traffic
- room to add more provider families later without redoing the package structure

### First provider entry

Inside `otto-ai-provider`, the first model-provider entry should be `openai-proxy`.

Reason:

- OpenClaw already has OpenAI-specific runtime behavior, compat flags, and transport assumptions
- keeping the first Otto entry explicitly OpenAI-family reduces forward-compat risk
- this avoids inventing a lowest-common-denominator proxy abstraction too early

### Later entries

Likely future additions inside the same package:

- `anthropic-proxy`
- `gemini-proxy`
- provider-family-specific speech or embeddings helpers where OpenClaw uses different extension seams

## Gateway architecture

Build a dedicated Otto-side service, for example `services/ai-gateway`, deployed alongside the control plane.

### Responsibilities

- exchange tenant runtime bootstrap credentials for short-lived Otto access tokens
- authenticate and authorize proxied AI requests from tenant runtimes
- resolve the correct upstream provider account and active provider credential for the workspace
- inject upstream credentials server-side only
- forward requests to upstream providers with minimal wire-shape changes
- record request metadata for attribution, billing, and reconciliation
- expose future provider-specific usage and quota surfaces if needed

### Internal modules

Recommended split:

- `auth-exchange`
  - validates tenant runtime bootstrap credentials
  - returns short-lived Otto gateway access tokens
- `provider-session`
  - maps workspace + provider entry to the active upstream provider account and credential
- `inference proxy`
  - first target: OpenAI Responses over HTTP / SSE
- `embeddings proxy`
  - OpenAI-compatible `/v1/embeddings`
- `speech proxy`
  - Otto-owned speech synthesis endpoints used by OpenClaw speech providers
- `usage ledger hook`
  - records request metadata and links requests to provider credential revisions

## Runtime credential model

The tenant runtime should still have a tenant-specific Otto credential, but not an upstream provider key.

### Bootstrap credential

Each tenant runtime should receive a long-lived-enough Otto bootstrap credential that is:

- unique per workspace runtime
- registered in the control-plane database
- scoped only to AI-gateway auth exchange and related runtime-to-control-plane proxy calls
- revocable and rotatable independently of upstream provider keys

This is the tenant-specific key that must be registered on the control plane.

It is not an OpenAI key.

### Access token

The runtime exchanges the bootstrap credential for a short-lived Otto access token.

Recommended properties:

- TTL measured in minutes, not hours
- scoped to one workspace runtime
- scoped to one Otto provider entry such as `openai-proxy`
- includes `aud`, `exp`, `jti`, `workspace_id`, and runtime identity claims

### Why two layers

This keeps restarts simple while limiting the blast radius of runtime compromise:

- bootstrap credential survives restart and configuration apply
- short-lived access token is the actual bearer used on proxied inference calls

## OpenAI inference path

### v1 target

Support OpenAI-family inference first through the `openai-proxy` provider entry.

Recommended initial transport scope:

- OpenAI Responses API
- HTTP / SSE streaming only
- normal tool calling
- normal reasoning controls supported by the OpenAI-family path

Do not make WebSocket transport a day-one requirement.

Reason:

- OpenClaw has explicit WebSocket transport behavior for OpenAI-family models
- this materially increases the first proxy surface area
- HTTP / SSE is enough to remove upstream secrets from the runtime and preserve core agent behavior

### Request flow

1. Tenant runtime selects `openai-proxy` provider.
2. `otto-ai-provider` resolves Otto gateway base URL and obtains short-lived Otto access token.
3. OpenClaw sends model traffic to Otto gateway, not to `api.openai.com`.
4. Otto gateway authenticates the runtime token.
5. Otto gateway resolves workspace -> provider account -> active provider credential.
6. Otto gateway injects the real OpenAI key server-side and forwards the request.
7. Otto gateway streams the upstream response back with as little transformation as possible.
8. Otto records request attribution for later usage and billing reconciliation.

## Embeddings path

Embeddings in OpenClaw already follow a different extension seam from the main model-provider runtime.

Relevant OpenClaw behavior:

- the gateway exposes an OpenAI-compatible `/v1/embeddings` path
- memory embeddings use adapter registration via `registerMemoryEmbeddingProvider(...)`
- the remote OpenAI embedding adapter already accepts custom `baseUrl`, headers, and output dimensionality

### Recommendation

For OpenAI-family embeddings, prefer the smallest path:

- keep using the existing OpenAI-compatible remote embedding adapter shape
- point its `baseUrl` at Otto
- give it Otto-issued auth instead of an upstream provider key
- have Otto expose an OpenAI-compatible `/v1/embeddings`

This likely preserves the most functionality with the least OpenClaw-specific customization.

### Why this is attractive

- existing OpenClaw embedding flow already expects an OpenAI-compatible endpoint
- dimensions / `outputDimensionality` support already exists in the adapter and HTTP surface
- Otto can meter embedding requests centrally without teaching the tenant runtime new embedding semantics

### Constraint

Do not couple embedding proxying to the first LLM provider entry too tightly. The OpenClaw extension seam is different, even if Otto reuses the same upstream provider and gateway auth model.

## Speech / TTS path

Speech output in OpenClaw does not run through the main model-provider plugin seam.

Relevant OpenClaw behavior:

- speech providers are capability providers implementing `SpeechProviderPlugin`
- TTS and Talk mode call speech-provider `synthesize(...)` / `synthesizeTelephony(...)`
- gateway methods like `tts.convert` and `talk.speak` go through that speech provider runtime

### Recommendation

Treat Otto-proxied speech as a separate capability inside `otto-ai-provider`:

- add Otto-owned speech provider entries
- their `synthesize(...)` implementation should call Otto
- Otto injects upstream TTS credentials server-side
- Otto returns audio bytes and output metadata back to OpenClaw

This should use the same runtime bootstrap credential and short-lived Otto access-token model as the LLM proxy.

### Important limit

This speech-provider path covers speech synthesis / TTS.

It does not automatically cover audio transcription / speech-to-text.

## Audio transcription / STT stance

Current OpenClaw transcription support in this repo still centers on command-driven or media-understanding flows such as `whisper-cli`-style configuration.

So STT should be treated as a follow-on slice, not bundled into the first `openai-proxy` rollout.

### v1 stance

- do not block the LLM proxy or embedding proxy on STT proxying
- do not claim TTS proxying automatically solves STT
- if Otto later wants provider-backed STT, plan either:
  - a new OpenClaw capability seam for transcription providers, or
  - a dedicated Otto media-understanding bridge for transcription workloads

## Usage attribution and rotation requirements

The proxy must preserve correct attribution across provider key rotation.

### Requirements

- one stable OpenAI project per workspace
- service-account / key rotation must reuse that stable project
- historical provider credential rows must be preserved in Otto DB
- each proxied request must record which provider credential revision served it
- later reconciliation should still be possible against provider usage grouped by `project_id` and `api_key_id`

### Rotation flow

1. create a new upstream service-account key inside the existing tenant project
2. persist the new key as the active Otto provider credential
3. all new Otto-gateway requests begin using the new credential
4. preserve the old credential row for historical attribution
5. revoke the old upstream key only after successful cutover

## Runtime configuration changes

### Current state

Before the proxy rollout, tenant runtime `.env` received `OPENAI_API_KEY` directly.

The first implementation slice now also exists in code:

- `runtime-plugins/otto-ai-provider` registers `openai-proxy`
- tenant runtimes can opt into `openai-proxy/...` as the primary model
- `openai-proxy` currently authenticates proxied calls with `TENANT_TOKEN`
- the control plane now proxies OpenAI Responses at `/api/internal/runtime/ai/openai/v1/responses`

This keeps the first inference path testable without yet removing every
remaining direct OpenAI runtime dependency.

### Target state

Tenant runtime should instead receive only Otto-scoped configuration, for example:

- Otto AI gateway base URL
- Otto bootstrap credential for runtime auth exchange
- plugin/runtime metadata needed to use `otto-ai-provider`

Once the proxy path is fully rolled out:

- stop projecting `OPENAI_API_KEY` to the runtime for Otto-managed runtime config
- keep direct provider-key projection only where a legacy fallback is explicitly required during migration

## Rollout sequence

### Step 1. Lock the plugin and gateway contract

Deliverables:

- plugin package shape documented
- `openai-proxy` provider entry documented
- Otto bootstrap credential and access-token model documented
- initial Otto gateway endpoint contract documented

Exit check:

- the runtime/plugin/gateway contract is concrete enough to implement without re-arguing ownership boundaries

### Step 2. Add control-plane persistence for Otto runtime AI credentials

Deliverables:

- tenant runtime bootstrap credential model defined
- lifecycle rules for issue, revoke, rotate documented
- relationship to existing provider credential tables documented

Exit check:

- Otto can represent runtime auth separately from upstream provider auth

### Step 3. Build OpenAI inference proxy path

Deliverables:

- first Otto gateway endpoint proxies OpenAI Responses requests
- request logging records workspace and provider credential attribution
- runtime can authenticate without receiving an upstream key

Exit check:

- one tenant runtime can complete normal OpenAI-family inference through Otto with no `OPENAI_API_KEY` in runtime env

### Step 4. Migrate the first runtime image and plugin wiring

Deliverables:

- `otto-ai-provider` is bundled into the runtime image
- desired state projects Otto proxy config instead of upstream provider env
- runtime release plan documents migration and rollback

Exit check:

- a new runtime release can be activated for selected tenants without direct upstream key projection

### Step 5. Add embedding proxy support

Deliverables:

- OpenAI-compatible embedding requests flow through Otto
- dimensions / output dimensionality remain supported
- embedding calls are attributable to workspace and provider credential revision

Exit check:

- memory embeddings work through Otto without upstream embedding keys in runtime config

### Step 6. Add speech-provider proxy support

Deliverables:

- Otto-owned speech provider entries call Otto for TTS
- `tts.convert` and `talk.speak` still function through the proxy path

Exit check:

- speech synthesis works through Otto with no upstream TTS key on the tenant runtime

### Step 7. Remove direct-key fallback for Otto-managed OpenAI tenants

Deliverables:

- runtime env projection no longer writes `OPENAI_API_KEY` for the managed runtime path
- rollback plan documented in runtime release spec

Exit check:

- the managed OpenAI tenant path is proxy-only

## Acceptance criteria

- there is a documented Otto-owned plugin package named `otto-ai-provider`
- the first provider entry is `openai-proxy`
- the runtime credential model is tenant-specific and Otto-scoped rather than upstream-provider-scoped
- the target runtime design no longer requires `OPENAI_API_KEY` for Otto-managed inference
- the control-plane-side AI gateway is defined as the sole holder of upstream provider secrets
- the spec preserves stable per-workspace OpenAI projects across provider key rotations
- the proxy design includes explicit request attribution needed for later billing and reconciliation
- embeddings are covered with an explicit OpenAI-compatible proxy path
- speech synthesis is covered through a dedicated speech-provider path
- audio transcription is explicitly identified as a separate follow-on capability, not silently folded into the first proxy slice

## Status checklist

- [x] document why direct provider keys in tenant runtime are the wrong boundary
- [x] define the Otto AI gateway service shape
- [x] define the `otto-ai-provider` package and `openai-proxy` entry
- [x] define the runtime bootstrap credential and short-lived access-token model
- [x] define how OpenAI-family inference should be proxied first
- [x] define how embeddings fit the proxy boundary
- [x] define how speech / TTS fits the proxy boundary
- [x] identify STT / transcription as a separate follow-on path
- [x] define attribution and rotation requirements needed for billing
- [x] implement the first `openai-proxy` gateway and plugin slice
- [x] remove direct `OPENAI_API_KEY` projection from tenant runtimes

## Open questions

- Should the Otto AI gateway live as a dedicated service process immediately, or can the first streaming implementation safely live in `web/` behind a stronger internal boundary before being extracted?
- Should the runtime bootstrap credential be stored as an Otto-managed runtime secret only, or should it be derivable from the existing tenant gateway token with stricter audience and capability scoping?
- The first implementation currently reuses `TENANT_TOKEN` for proxied inference auth. Do we keep that as the production boundary for v1, or still introduce a dedicated Otto AI bootstrap credential before broad rollout?
- For embeddings, is reusing OpenClaw's existing OpenAI-compatible remote adapter sufficient, or do we want a first-class Otto embedding adapter for stronger explicitness?
- For speech providers, should the first Otto speech provider wrap OpenAI TTS only, or should the interface be designed for immediate multi-provider fallback?
- Do we want to proxy OpenAI WebSocket transport later, or explicitly standardize on HTTP / SSE for Otto-managed OpenAI inference?
- What is the cleanest OpenClaw extension seam for future provider-backed transcription so STT can live behind the same Otto trust boundary without forking too much media-understanding logic?
