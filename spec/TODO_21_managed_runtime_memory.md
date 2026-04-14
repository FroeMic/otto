# TODO 21: Managed Runtime Memory

## Goal

Give managed Otto runtimes a first-class memory system that is useful out of the
box, keeps upstream provider secrets out of tenant runtimes, and fits Otto's
existing control-plane ownership of transcripts, runtime config, and provider
billing.

## Scope

- choose the default memory backend for managed Otto runtimes
- define the first shipping memory configuration Otto should project into tenant
  `openclaw.json`
- define how memory embeddings should use Otto's proxy boundary instead of
  upstream embedding keys on tenant runtimes
- define how tenant session history should become a searchable memory source
- define which OpenClaw memory features Otto should ship now, defer, or treat as
  optional follow-ons
- define the minimal workspace and operator surfaces needed to support managed
  memory

## Non-goals

- implementing the full feature in this spec
- shipping a new standalone Otto memory engine outside OpenClaw in v1
- making QMD, Honcho, or GBrain the default managed path in the first slice
- enabling every experimental OpenClaw memory feature on day one
- designing a generic external knowledge-base platform for arbitrary third-party
  "second brain" tools

## Dependencies

- `TODO_04_runtime_packaging.md`
- `TODO_05_config_apply_and_reconciliation.md`
- `TODO_11_runtime_release_rollout.md`
- `TODO_14_session_history_visibility.md`
- `TODO_15_billing_and_credit_metering.md`
- `TODO_16_runtime_ai_provider_proxy.md`
- `TODO_20_unified_frontend_and_hono_migration.md` for the longer-term workspace
  settings and status UI migration

## Review findings

### OpenClaw release and docs status as of April 13, 2026

- The latest stable tag visible in the local OpenClaw checkout is `v2026.4.9`
  dated April 9, 2026.
- `v2026.4.7` introduced two memory-adjacent capabilities that matter here:
  - `memory-wiki` was restored as a bundled companion layer
  - dreaming started ingesting redacted session transcripts into its corpus
- `v2026.4.9` added grounded dreaming backfill and stronger Dream Diary flows.
- The published docs currently describe `Active Memory`, but that plugin is not
  present in the `v2026.4.9` tag. It exists on current top-of-tree docs/main,
  not the latest stable release.

### What OpenClaw already gives Otto

- `memory-core` is the default bundled memory plugin:
  - file-backed memory in `MEMORY.md` and `memory/YYYY-MM-DD.md`
  - `memory_search` and `memory_get`
  - builtin SQLite-based hybrid search
  - optional dreaming promotion
- builtin memory search can already use remote OpenAI-compatible embeddings with
  custom `baseUrl`, `apiKey`, headers, batching, and output dimensionality.
- QMD is an alternate backend with:
  - reranking and query expansion
  - optional session indexing
  - indexing of extra directories beyond the workspace
  - automatic fallback to builtin memory when QMD is unavailable
- Honcho is a separate service-backed memory model focused on cross-session
  persistence, user modeling, and multi-agent awareness.
- Dreaming is now a real background subsystem inside `memory-core`, not just a
  vague future idea.

### What Otto already gives OpenClaw

- Otto already owns the tenant runtime image and config projection.
- Otto already bundles runtime plugins into the custom runtime image.
- Otto already has an OpenAI-family `openai-proxy` provider for model inference
  and audio transcription.
- Otto does not yet proxy OpenAI-compatible embeddings.
- Otto currently disables bundled memory plugins by default in rendered tenant
  config, so managed memory will require explicit config projection rather than
  working automatically.
- Otto already has a spec for control-plane session transcript storage in
  `TODO_14_session_history_visibility.md`.

## Option review

### Option A: Ship builtin `memory-core` as the default managed path

Pros:

- ships in stable OpenClaw today
- no extra sidecar or local model downloads required
- aligns with OpenClaw's native memory files and tools
- supports hybrid search once embeddings are configured
- can reuse Otto's provider proxy boundary with a small embeddings addition
- keeps failure modes simple for managed multitenant runtimes

Cons:

- less retrieval sophistication than QMD
- cross-session recall depends on local transcripts or future session indexing
- no opinionated knowledge graph or compiled-knowledge layer by default

### Option B: Make QMD the default managed path

Pros:

- better retrieval quality through reranking and query expansion
- can index transcripts and extra paths
- fully local after installation

Cons:

- adds a sidecar runtime plus its own storage/update lifecycle
- first-query latency and model downloads are materially heavier
- more moving parts to debug on low-resource tenant hosts
- QMD is better as an advanced mode than as the first required managed default

### Option C: Make Honcho the default managed path

Pros:

- automatic cross-session memory and user modeling
- natural fit for multi-agent recall

Cons:

- introduces a second service-owned memory substrate outside Otto
- duplicates Otto's own desire to own transcript, billing, and policy boundaries
- creates harder product and trust-boundary questions than builtin memory does

### Option D: Treat GBrain as the default memory architecture

Pros:

- much richer knowledge model than raw memory files
- pluggable PGLite/Postgres engine story
- hybrid search, citations, graph traversal, MCP tool surface, and structured
  "compiled truth" workflows

Cons:

- it is a separate "brain" product, not a drop-in OpenClaw memory backend
- its storage model is page/link/timeline oriented, not OpenClaw-native runtime
  memory
- defaulting every managed Otto runtime to an external second-brain system would
  dramatically expand scope, ops burden, and UI surface area

## Decision summary

- Default managed memory to OpenClaw builtin `memory-core`.
- Use Otto's existing OpenAI proxy boundary for memory embeddings by adding an
  OpenAI-compatible `/v1/embeddings` proxy route.
- For the first shipping slice, configure memory embeddings through
  `agents.defaults.memorySearch.provider = "openai"` plus
  `agents.defaults.memorySearch.remote.baseUrl` and
  `agents.defaults.memorySearch.remote.apiKey = ${TENANT_TOKEN}` rather than
  introducing a new first-class `openai-proxy` memory embedding adapter.
- Do not make QMD the default managed backend. Treat it as a follow-on advanced
  mode once builtin memory is stable.
- Do not make Honcho or GBrain a default managed dependency.
- Do not make `Active Memory` part of the first shipping spec because it is not
  yet in the latest stable OpenClaw release.
- Keep dreaming opt-in for the first slice. It should follow stable transcript
  sync and embedding proxying, not precede them.

## Why this is the right default

This path gives Otto a real managed memory feature without inventing a parallel
memory platform too early.

It uses:

- stable OpenClaw release features that already exist in `v2026.4.9`
- Otto's existing runtime config projection model
- Otto's existing runtime image/plugin ownership
- Otto's existing provider proxy direction

It avoids:

- shipping an extra retrieval sidecar by default
- projecting upstream provider keys onto tenant runtimes
- binding Otto's core managed product to an external service-backed memory
  product before the basic memory experience is solid

## Proposed product shape

### First shipping slice

Each managed runtime should get:

- `memory-core` enabled explicitly
- builtin memory search enabled
- OpenAI-compatible embeddings routed through Otto
- managed workspace memory files:
  - `MEMORY.md`
  - `memory/YYYY-MM-DD.md`
- `memory_search` and `memory_get` available to the assistant
- workspace-visible memory settings and status

Default behavior:

- memory search on
- builtin backend
- dreaming off
- QMD off
- Honcho unsupported
- Active Memory unsupported in the stable runtime channel

### Second slice

After transcript sync is stable:

- enable session-aware indexing for builtin memory
- let dreaming optionally use the now-synced transcript corpus
- surface memory health and sync state in the workspace

### Later optional slices

- advanced QMD mode for workspaces that want better recall or extra indexed paths
- managed `memory-wiki` companion support if the product needs a richer durable
  knowledge surface
- Active Memory canary once it lands in a stable OpenClaw release and Otto has
  validated the latency/cost impact
- external knowledge-base integrations such as GBrain as optional integrations,
  not as the default runtime memory substrate

## Architecture

### 1. Runtime config projection

Otto should start rendering memory config into tenant `openclaw.json`.

Required config families:

- `plugins.entries["memory-core"] = { enabled: true, config: ... }`
- `plugins.allow` must include `memory-core` whenever Otto renders a strict
  allowlist
- `agents.defaults.memorySearch`

Recommended first config shape:

```json5
{
  plugins: {
    allow: ["memory-core", "otto-integrations", "otto-ai-provider"],
    entries: {
      "memory-core": {
        enabled: true,
        config: {
          dreaming: {
            enabled: false,
          },
        },
      },
    },
  },
  agents: {
    defaults: {
      memorySearch: {
        enabled: true,
        provider: "openai",
        remote: {
          apiKey: "${TENANT_TOKEN}",
          baseUrl: "${OTTO_CONTROL_PLANE_BASE_URL}/api/internal/runtime/ai/openai/v1",
        },
        experimental: {
          sessionMemory: false,
        },
      },
    },
  },
}
```

Important:

- this uses the builtin OpenClaw `openai` memory embedding provider id, not
  `models.providers.openai-proxy`
- the memory embedding client should talk to Otto's OpenAI-compatible embeddings
  endpoint through `memorySearch.remote`
- tenant runtimes still do not receive `OPENAI_API_KEY`

### 2. Embeddings proxy

Add a runtime-authenticated control-plane route:

- `POST /api/internal/runtime/ai/openai/v1/embeddings`

It should:

- authenticate the tenant runtime with `TENANT_TOKEN`
- resolve the workspace's active OpenAI provider credential server-side
- enforce the same credit/balance gate as other proxied OpenAI traffic
- forward the request to OpenAI's embeddings endpoint
- preserve the response shape expected by OpenClaw's builtin remote OpenAI
  embedding client
- record usage attribution so embeddings later settle cleanly under
  `TODO_15_billing_and_credit_metering.md`

This is the missing Otto piece required to make managed memory secure by
default.

### 3. Session transcripts as a memory source

Otto should not invent a second transcript export path just for memory.

Instead:

- keep `TODO_14_session_history_visibility.md` as the primary transcript-sync
  spec
- once runtime transcript sync exists, enable OpenClaw session-memory indexing
  using its native memory-search session support
- keep the runtime-local transcript/indexing flow and the control-plane session
  archive aligned, but do not require the runtime to query the control plane for
  every memory lookup

First recommendation:

- ship file memory first
- then enable `memorySearch.experimental.sessionMemory = true` only after the
  transcript sync/plugin work has proven reliable

### 4. Dreaming

Dreaming should be a managed opt-in, not a default-on background behavior.

Rationale:

- it consumes more tokens and background runtime time
- it benefits from transcript availability and stable embeddings
- it has product implications because it mutates durable memory over time

Recommended first managed stance:

- project `memory-core` with `dreaming.enabled = false`
- add workspace settings and operator diagnostics first
- enable dreaming only after memory search, embedding proxying, and transcript
  sync are working end to end

### 5. QMD

QMD should not be the first default, but it should stay on the roadmap as an
advanced backend.

If Otto adds it later, treat it as:

- an explicitly selected backend
- a different operational mode with its own health checks, storage, update
  cadence, and timeout policies
- a mode that can index extra managed paths and sessions, but only after Otto
  defines clear product semantics for those extra sources

### 6. Honcho and GBrain

Both should be treated as optional future integrations, not default runtime
memory.

Honcho:

- plausible later as a managed external memory integration
- not aligned with Otto's first-party ownership of transcripts and provider
  policy in the first slice

GBrain:

- compelling as a higher-order knowledge base
- better framed as a workspace integration or MCP-backed knowledge source than
  as the base memory system for every runtime

## Code organization notes

When implementation starts, keep ownership split like this:

- `apps/api`
  - runtime-authenticated embeddings proxy route
  - memory settings and status routes used by the workspace
- `apps/worker`
  - runtime config rendering and desired-state projection
  - any later reconciliation or health-check jobs for memory status
- `packages/features/workspace-*`
  - workspace-facing memory settings, DTOs, and status logic once shared across
    API and web
- `runtime-plugins/`
  - only if Otto later adds a first-class memory embedding adapter or other
    Otto-owned memory companion plugin

Do not create a repo-wide generic `memory` utility package unless the behavior
is truly shared across multiple execution surfaces.

## Rollout plan

### Step 1. Config-only enablement for stable builtin memory

- enable `memory-core` in managed runtime config
- project builtin memory-search config with dreaming off
- keep embeddings on the current direct-key path only in non-managed/dev cases

### Step 2. Add Otto embeddings proxy support

- implement `/api/internal/runtime/ai/openai/v1/embeddings`
- meter and attribute embedding requests
- switch managed runtime memory config to Otto-proxied remote embeddings

### Step 3. Add workspace and operator visibility

- show whether memory is enabled for the workspace
- show backend type, provider id, last index health, and embedding/proxy errors
- show whether session memory is enabled

### Step 4. Add session-backed recall

- complete `TODO_14`
- turn on builtin session-memory indexing for managed runtimes
- validate that runtime-local recall and control-plane transcript history stay
  consistent enough for product expectations

### Step 5. Add optional dreaming

- expose a workspace setting for dreaming
- keep dreaming opt-in
- surface state, cadence, and recent promotion diagnostics

### Step 6. Evaluate advanced modes

- QMD as an advanced backend
- Active Memory after stable upstream release
- `memory-wiki`, Honcho, or GBrain-backed integrations only after the baseline
  path is solid

## Acceptance criteria

- managed runtimes can use `memory_search` and `memory_get` without upstream
  provider keys in tenant env
- tenant `openclaw.json` explicitly enables `memory-core` when managed memory is
  on
- memory embeddings flow through Otto's runtime-authenticated OpenAI-compatible
  embeddings proxy
- the first shipping path works on the stable OpenClaw release line Otto is
  currently using
- Otto has a clear documented stance on builtin memory, QMD, Honcho, Active
  Memory, dreaming, and GBrain
- the workspace and operator surfaces can explain whether managed memory is
  enabled and healthy

## Status checklist

- [x] review latest stable OpenClaw memory-related releases
- [x] review current OpenClaw memory docs and source seams
- [x] review Otto's current runtime proxy and config state
- [x] choose the default managed memory backend
- [x] decide how embeddings should fit the Otto proxy boundary
- [x] decide the first-slice stance on QMD, Honcho, dreaming, Active Memory,
      and GBrain
- [ ] implement memory config projection in managed runtimes
- [ ] implement the OpenAI-compatible embeddings proxy route
- [ ] add workspace and operator memory status surfaces
- [ ] enable session-backed recall after transcript sync lands
- [ ] add optional dreaming controls

## Open questions

- Should the first Otto-managed embedding path reuse OpenClaw's builtin
  `provider: "openai"` + `memorySearch.remote.baseUrl`, or should Otto add an
  explicit `openai-proxy` memory embedding adapter for clearer operator mental
  models?
- Should QMD remain operator-only in its first Otto appearance, or should
  workspaces be allowed to self-select it?
- When dreaming becomes workspace-visible, should Otto mirror OpenClaw's Dream
  Diary UI concepts directly or keep only a simpler status/toggle surface?
- Does Otto want to support `memory-wiki` as a first-party companion layer, or
  leave richer knowledge compilation to later optional integrations such as
  GBrain?
