# TODO 26: Managed Runtime Memory

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
- `TODO_20_unified_frontend_and_hono_migration.md`

## Decision Summary

- Default managed memory to OpenClaw builtin `memory-core`.
- Reuse Otto's AI proxy boundary for embeddings via an OpenAI-compatible
  `/v1/embeddings` proxy route rather than projecting upstream provider keys
  into tenant runtimes.
- Configure the first slice through
  `agents.defaults.memorySearch.provider = "openai"` plus
  `agents.defaults.memorySearch.remote.baseUrl` and
  `agents.defaults.memorySearch.remote.apiKey = ${TENANT_TOKEN}`.
- Keep QMD, Honcho, and GBrain out of the default managed path.
- Treat `Active Memory` as a later canary feature rather than the first stable
  managed-memory release.
- Keep dreaming opt-in until transcript sync and embedding proxying are stable.
