# TODO 40: Provider Accounting Ledger

## Goal

Define one provider accounting ledger that can support multiple upstream accounting methods without making billing logic provider-specific.

The ledger must support:

- providers like OpenAI, where provider-native tenant reconciliation is available through projects, API keys, usage buckets, and cost buckets
- providers like xAI, where tenant isolation may be API-key-based inside one team, but per-response usage can include an exact provider-reported cost
- future providers that only return token counts and require Otto-side price conversion
- future providers that expose only delayed aggregate usage exports

The target outcome is a durable accounting substrate that can feed credit burn, operator reconciliation, and future provider expansion while preserving enough raw evidence to audit each billed amount.

## Scope

- define provider accounting source types
- define a canonical per-request ledger model for proxied provider calls
- define aggregate usage/cost bucket ingestion as reconciliation evidence, not the only source of truth
- define settlement from raw provider evidence into normalized billable units and credits
- define provider capability metadata needed to decide which accounting method is authoritative per provider and surface
- define workspace-scoped model/provider configuration and how it projects into tenant runtime desired state
- define OpenAI and xAI as the first concrete provider examples
- define rollout sequencing from the existing OpenAI usage-ingestion foundation to the unified ledger

## Non-goals

- replacing Stripe commerce or subscription handling
- changing the user-facing credit model from `TODO_15`
- exposing raw provider token economics directly to workspace users
- implementing xAI provider proxying in this spec
- implementing provider pricing catalogs for every future provider
- making provider invoices the only source of truth for tenant billing where provider-native tenant isolation is unavailable

## Dependencies

- `TODO_15_billing_and_credit_metering.md` for the credit model, Stripe role, raw OpenAI usage ingestion, and provider bucket tables
- `TODO_16_runtime_ai_provider_proxy.md` for the runtime AI proxy trust boundary and provider credential attribution requirements
- `TODO_36_openai_proxy_native_quality_rewrite.md` for the current OpenAI proxy transport behavior and stream completion constraints
- `TODO_05_config_apply_and_reconciliation.md` for desired-state versioning and runtime apply behavior
- `TODO_09_ui_app_shell_and_onboarding_rebuild.md` for workspace settings surfaces
- future xAI provider work for a provider-specific proxy and management-key provisioning path

## Problem Statement

Otto needs one tenant billing ledger even though providers expose materially different accounting primitives.

OpenAI supports a strong provider-native tenant isolation model:

- one project can be provisioned per tenant
- one or more service-account API keys can be provisioned under that project
- usage can be grouped by `project_id`, `api_key_id`, `model`, and other dimensions
- cost buckets can be grouped by `project_id`

xAI currently appears to support a different model:

- API keys can be created programmatically under an existing team
- API keys can carry ACLs and rate limits
- teams are the provider-native billing and invoice boundary
- public docs do not currently show a team-creation API
- public docs do not currently show usage grouping by API key
- individual inference responses can include token usage and `usage.cost_in_usd_ticks`

Future providers may have still other models:

- per-call token usage but no per-call cost
- per-call cost but no aggregate cost export
- aggregate usage export but no per-call usage
- no API-key-level grouping
- delayed invoices only

If each provider writes directly to the credit ledger in its own shape, billing will become brittle and hard to audit. Instead, provider accounting must flow through one normalized evidence and settlement model.

## Decision Summary

- Create a canonical provider request ledger for every proxied paid provider call.
- Store provider evidence separately from credit ledger entries.
- Treat credit burns as settlements derived from provider evidence, not as raw provider evidence themselves.
- Allow each provider surface to declare its authoritative accounting method.
- Keep aggregate provider usage/cost buckets for reconciliation even when per-call cost is available.
- Prefer provider-reported exact cost when a completed response includes it.
- Prefer provider-native aggregate costs for financial reconciliation when they can be grouped by tenant boundary.
- Fall back to Otto-side price conversion only when provider-reported cost is unavailable.
- Mark unmetered or partially metered calls explicitly; never silently bill from guessed values.
- Make workspace model/provider selection explicit data instead of relying only on process env.
- Only allow workspace-selectable model configs when the provider/surface has a defined accounting method.

## Workspace Model Configuration

The same provider accounting layer should also own the guardrails for which managed model provider a workspace can use.

Current state:

- tenant runtime rendering resolves the primary model from `RUNTIME_MODEL_PRIMARY`
- that keeps rollout simple, but it makes provider/model choice a global deployment concern
- the current default should remain unchanged for now

Target state:

- each workspace has an explicit model configuration record
- if no workspace-specific record exists, the workspace uses the same global default used today
- workspace settings can later update this model configuration
- saving the setting creates a new tenant desired-state version
- ready runtimes can queue an apply job so the selected model takes effect without manual server editing
- provider accounting must be validated before the model can be selected

### Model Profile Shape

Recommended table: `workspace_model_profiles`

Fields:

- `id`
- `organization_id`
- `tenant_id`
- `profile_key`
  - start with `default`
- `status`
  - `active`
  - `disabled`
- `provider_key`
  - examples: `openai`, `xai`
- `provider_entry_key`
  - examples: `openai-proxy`, `xai-proxy`
- `model_id`
  - examples: `gpt-5.4`, `grok-4.20-0309-reasoning`
- `model_ref`
  - rendered runtime ref, for example `openai-proxy/gpt-5.4`
- `accounting_surface`
  - examples: `responses`, `chat_completions`
- `accounting_capability_version`
- `pricing_rule_version`
  - nullable when the provider reports exact per-call cost and no rule is needed for cost basis
- `runtime_apply_policy`
  - `apply_when_ready`
  - `save_only`
- `created_by_user_id`
- `updated_by_user_id`
- `created_at`
- `updated_at`

Rules:

- `profile_key=default` is the first and only required profile for v1.
- Future profiles can support separate chat, background task, audio, embedding, or high-reasoning defaults.
- `model_ref` should be derived from provider entry and model id, not accepted as arbitrary user input.
- Provider entry keys should refer to managed proxy providers, not raw upstream providers, for managed billing.
- The runtime should keep receiving only workspace-scoped runtime credentials, not upstream provider keys.

### Defaults

Default resolution should be layered:

1. active workspace model profile
2. platform-level model profile config when added later
3. current process default, initially `RUNTIME_MODEL_PRIMARY`

This preserves today's behavior while creating a durable place for per-workspace overrides.

For the current managed runtime path, the effective default should continue matching the deployed runtime default until an explicit migration changes it. Do not silently switch existing workspaces to xAI or another provider only because the accounting ledger supports it.

### Settings Flow

Workspace settings should eventually expose model selection as an operator or admin-controlled setting.

Save flow:

1. user selects a supported provider entry and model
2. API validates that the workspace has access to the provider
3. API validates that the provider credential/proxy path is ready or can be provisioned
4. API validates that the provider/surface has an accounting capability
5. API validates that either provider-reported exact cost or a pricing rule exists
6. API writes the workspace model profile
7. API creates a new tenant desired-state version with the selected model projected into runtime config
8. API queues `apply_tenant_config` when the tenant runtime is ready and `runtime_apply_policy=apply_when_ready`

The settings UI should show pending apply state separately from saved configuration state. A model selection can be saved but not yet active on the runtime until the apply run succeeds.

### Desired-State Projection

Model config should project into desired state as a small explicit block rather than remaining an env-only concern.

Recommended desired-state shape:

```json
{
  "model": {
    "primary": {
      "providerKey": "openai",
      "providerEntryKey": "openai-proxy",
      "modelId": "gpt-5.4",
      "modelRef": "openai-proxy/gpt-5.4",
      "accountingSurface": "responses"
    }
  }
}
```

Runtime rendering should convert this into the OpenClaw `agents.defaults.model.primary` value and include the required managed provider plugin/config for the provider entry.

Rules:

- desired state should keep enough metadata to explain why a provider plugin was projected
- runtime rendering should reject a desired-state model block whose provider entry is unknown
- model profile changes must not mutate older desired-state versions
- apply/retry should always use the requested desired-state version, not whatever model profile is latest at execution time

### Accounting Gate

Credit accounting must work across all selectable providers.

A model/provider option is selectable only when:

- provider credential resolution is defined
- runtime proxy support is defined
- request ledger instrumentation is defined for the target surface
- settlement behavior is defined
- reconciliation behavior is documented, even if only team-level or account-level
- either exact provider-reported cost is available or a versioned pricing rule exists

If any of those are missing, the model can be shown as unavailable or hidden, but it must not be available for billable workspace use.

This rule prevents adding a new model provider that can answer requests but cannot produce auditable credit burns.

### Provider Catalog

Introduce a managed model catalog rather than hardcoding choices in UI components.

Recommended catalog fields:

- `provider_key`
- `provider_entry_key`
- `label`
- `models`
  - `model_id`
  - `label`
  - `accounting_surface`
  - `capability_tags`
  - `default_for_new_workspaces`
  - `requires_provider_credential`
  - `requires_runtime_plugin`
  - `pricing_rule_version`
  - `accounting_status`
    - `available`
    - `blocked_missing_pricing`
    - `blocked_missing_proxy`
    - `blocked_missing_credentials`
    - `blocked_unverified_metering`

The catalog should be shared by workspace settings, platform operator views, runtime rendering validation, and accounting settlement validation.

## Accounting Source Types

Each provider/surface should declare one primary accounting source and optional reconciliation sources.

### `proxy_reported_exact_cost`

The proxy observes a completed provider response containing a provider-reported monetary cost.

Example:

- xAI Responses returns `usage.cost_in_usd_ticks`

Rules:

- store the provider-reported cost exactly as an integer in the provider's native precision
- also normalize into Otto's canonical cost precision
- settle credits from this cost when the response is complete
- reconcile the provider-wide total against delayed team or invoice data where available

### `proxy_reported_usage_priced_by_otto`

The proxy observes token, request, image, audio, or tool usage, but no provider-reported cost.

Example:

- OpenAI Responses returns token usage, but not a per-call dollar cost
- future OpenAI-compatible providers may return token usage only

Rules:

- store raw usage exactly as returned
- price with versioned provider pricing rules
- settle credits from Otto-computed cost or billable units
- reconcile later against provider aggregate cost exports where available

### `provider_aggregate_usage`

The provider exposes delayed usage buckets but not direct cost buckets.

Example:

- token buckets grouped by provider project, API key, model, or user

Rules:

- ingest raw buckets immutably
- map provider grouping keys to Otto tenant/provider credential records
- price with versioned provider pricing rules
- settle or adjust credits from normalized bucket results

### `provider_aggregate_cost`

The provider exposes delayed cost buckets.

Example:

- OpenAI Costs API grouped by `project_id`

Rules:

- ingest raw cost buckets immutably
- use them as the financial reconciliation source when groupable by tenant
- create reconciliation adjustments only through explicit settlement jobs
- preserve drift between proxy-observed usage and provider cost buckets for operator review

### `manual_or_external_statement`

The provider has no usable API for detailed usage or cost.

Rules:

- require manual import or operator-entered statement rows
- do not auto-bill tenants unless there is another trusted per-call source
- clearly mark provider support as limited in operator surfaces

## Provider Capability Metadata

Each managed provider should declare accounting capabilities in code, not in scattered conditionals.

Recommended capability shape:

```ts
type ProviderAccountingCapabilities = {
  providerKey: string
  surfaces: Array<{
    surface: "responses" | "chat_completions" | "embeddings" | "audio" | "images" | "tools" | string
    primaryAccountingSource:
      | "proxy_reported_exact_cost"
      | "proxy_reported_usage_priced_by_otto"
      | "provider_aggregate_usage"
      | "provider_aggregate_cost"
      | "manual_or_external_statement"
    reconciliationSources: Array<
      | "provider_aggregate_usage"
      | "provider_aggregate_cost"
      | "manual_or_external_statement"
    >
    supportsProviderRequestId: boolean
    supportsProviderResponseId: boolean
    supportsProviderCostPerResponse: boolean
    supportsProviderUsagePerResponse: boolean
    supportsProviderCostByTenantBoundary: boolean
    supportsProviderUsageByApiKey: boolean
    supportsProviderUsageByProject: boolean
    supportsProgrammaticTenantBoundary: boolean
    tenantBoundaryKind:
      | "project"
      | "team"
      | "api_key"
      | "account"
      | "none"
      | (string & {})
  }>
}
```

OpenAI initial declaration:

- tenant boundary: `project`
- programmatic tenant boundary: yes
- Responses primary accounting source: `proxy_reported_usage_priced_by_otto`
- reconciliation sources: `provider_aggregate_usage`, `provider_aggregate_cost`
- provider-native cost by tenant boundary: yes, via project costs
- provider-native usage by API key: yes for supported usage endpoints

xAI initial declaration:

- tenant boundary: `api_key` for operational isolation, `team` for provider invoice boundary
- programmatic tenant boundary: partial; API keys yes, teams not documented publicly
- Responses primary accounting source: `proxy_reported_exact_cost` if `usage.cost_in_usd_ticks` is present
- reconciliation sources: `provider_aggregate_cost` or `provider_aggregate_usage` only at team level
- provider-native cost by tenant boundary: no, unless one team exists per tenant
- provider-native usage by API key: not documented; treat as unsupported until verified

## Canonical Provider Request Ledger

Add a provider request ledger that records one row per attempted proxied provider operation.

Recommended table: `provider_request_events`

Fields:

- `id`
- `organization_id`
- `tenant_id`
- `session_id`
- `conversation_id`
- `provider_key`
- `provider_surface`
- `operation_kind`
  - examples: `responses`, `chat_completions`, `embeddings`, `audio_transcriptions`, `images`, `web_search`
- `model`
- `provider_account_id`
- `provider_credential_id`
- `provider_tenant_boundary_kind`
  - examples: `project`, `team`, `api_key`
- `provider_tenant_boundary_id`
  - examples: OpenAI `project_id`, xAI `team_id`
- `provider_api_key_id`
- `provider_request_id`
  - request header id when available
- `provider_response_id`
  - response body id when available
- `idempotency_key`
- `status`
  - `started`
  - `completed`
  - `failed_before_provider`
  - `provider_error`
  - `client_aborted`
  - `stream_incomplete`
  - `metering_incomplete`
- `http_status`
- `streaming`
- `started_at`
- `first_byte_at`
- `completed_at`
- `failed_at`
- `duration_ms`
- `raw_request_summary_json`
  - safe metadata only; no prompt text, response text, tenant tokens, or provider secrets
- `raw_response_summary_json`
  - safe metadata only
- `raw_usage_json`
  - the exact provider `usage` object or usage-equivalent payload
- `raw_cost_json`
  - the exact provider cost object or cost-equivalent payload
- `provider_cost_amount`
  - decimal string if the provider reports a currency amount directly
- `provider_cost_currency`
- `provider_cost_native_unit`
  - examples: `usd`, `usd_tick_1e10`
- `provider_cost_native_units`
  - integer string; for xAI, `cost_in_usd_ticks`
- `provider_cost_usd_1e10`
  - canonical integer string where `1 USD = 10,000,000,000`
- `usage_quality`
  - `complete`
  - `partial`
  - `missing`
  - `estimated`
- `cost_quality`
  - `provider_reported`
  - `otto_priced`
  - `aggregate_allocated`
  - `missing`
- `metadata_json`
- `created_at`
- `updated_at`

Notes:

- Use the `1e10` USD precision because xAI already reports cost in that unit and it is precise enough for micro-request accounting.
- Store provider native units separately so future providers with different minor-unit precision can still be audited.
- Never store full prompt text, response text, files, audio, images, API keys, or tenant runtime tokens in accounting rows.

## Usage Measurements

Provider usage objects vary by endpoint. Normalize them into typed measurements linked to the request event.

Recommended table: `provider_request_usage_measurements`

Fields:

- `id`
- `provider_request_event_id`
- `provider_key`
- `measurement_kind`
  - examples:
    - `input_tokens`
    - `cached_input_tokens`
    - `output_tokens`
    - `reasoning_tokens`
    - `input_audio_tokens`
    - `output_audio_tokens`
    - `input_image_tokens`
    - `images`
    - `audio_seconds`
    - `server_side_tool_call`
    - `web_search_call`
- `quantity`
- `unit`
  - examples: `token`, `request`, `image`, `second`
- `model`
- `provider_tool_kind`
- `source_path`
  - example: `usage.output_tokens_details.reasoning_tokens`
- `raw_json`
- `created_at`

Rules:

- Store measurements even when the final settlement uses provider-reported cost.
- Measurements are useful for analytics, fraud controls, and explaining usage internally.
- Measurements must not be treated as billable by themselves until a settlement references them.

## Settlement Model

Credit ledger entries should be created from settlement results, not directly from provider responses.

Recommended table: `provider_request_settlements`

Fields:

- `id`
- `provider_request_event_id`
- `organization_id`
- `tenant_id`
- `provider_key`
- `settlement_status`
  - `pending`
  - `settled`
  - `adjusted`
  - `blocked_unmetered`
  - `voided`
- `accounting_source`
- `provider_cost_usd_1e10`
- `billable_units`
- `credits_burned`
- `pricing_rule_version`
- `credit_ledger_entry_id`
- `reconciliation_batch_id`
- `settled_at`
- `metadata_json`
- `created_at`
- `updated_at`

Rules:

- A completed provider request may have at most one active settlement.
- Adjustments should create new settlement rows or explicit adjustment rows rather than mutating historical settlement amounts silently.
- If a provider response is complete but lacks required accounting data, create `blocked_unmetered` and alert operators.
- If a request fails before reaching the provider, settle to zero.
- If a provider error includes usage/cost, settle from the returned provider evidence when the provider documents that such usage is billable.
- If a stream is interrupted before terminal usage/cost is observed, mark it `stream_incomplete` and do not auto-settle from estimates unless the provider supports retrieving the completed response later.

## Reconciliation Model

Aggregate provider usage and cost ingestion should continue, but it should reconcile against request settlements.

Recommended table: `provider_reconciliation_batches`

Fields:

- `id`
- `provider_key`
- `organization_id`
- `tenant_id`
- `provider_tenant_boundary_kind`
- `provider_tenant_boundary_id`
- `window_start`
- `window_end`
- `source_kind`
  - `provider_aggregate_usage`
  - `provider_aggregate_cost`
  - `manual_or_external_statement`
- `raw_source_id`
- `provider_reported_cost_usd_1e10`
- `settled_cost_usd_1e10`
- `delta_cost_usd_1e10`
- `status`
  - `matched`
  - `within_tolerance`
  - `drift_detected`
  - `unreconciled`
- `tolerance_usd_1e10`
- `metadata_json`
- `created_at`
- `updated_at`

Rules:

- OpenAI project cost buckets should reconcile against summed request settlements and/or usage bucket conversions for the same project/time window.
- xAI team billing should reconcile against the sum of all xAI request settlements for the shared team/time window.
- When xAI has multiple tenants in one team, reconciliation can validate the total xAI spend but cannot independently prove the tenant split.
- Reconciliation deltas should not automatically rewrite tenant billing unless an explicit adjustment policy exists.

## Provider Examples

### OpenAI

OpenAI should use two layers:

1. Proxy request ledger for near-real-time observability and provisional settlement.
2. OpenAI usage and costs APIs for provider-native reconciliation.

Accounting behavior:

- per-call OpenAI Responses usage is stored in `provider_request_events.raw_usage_json`
- per-call cost is usually absent, so `cost_quality=otto_priced` for provisional request settlement
- usage buckets grouped by `project_id`, `api_key_id`, and `model` provide detailed reconciliation
- cost buckets grouped by `project_id` provide financial reconciliation
- project remains the tenant boundary

Recommended initial policy:

- use OpenAI aggregate costs grouped by project as the strongest financial reconciliation source
- use proxy-observed token usage for fast UI, soft limits, request-level attribution, and early credit reservation
- allow reconciliation jobs to produce adjustments when aggregate costs differ materially from proxy-priced request totals

### xAI

xAI should use the proxy request ledger as the tenant billing source when provider responses include `usage.cost_in_usd_ticks`.

Accounting behavior:

- create one xAI API key per tenant under the configured team when xAI is enabled
- store xAI `apiKeyId` as provider credential metadata
- keep xAI keys out of tenant runtime env
- route all xAI requests through the control-plane proxy
- persist `usage.cost_in_usd_ticks` as `provider_cost_native_units` and `provider_cost_usd_1e10`
- settle completed calls from provider-reported cost
- reconcile the sum of all xAI request settlements against xAI team-level billing/usage data when available

Important limitation:

- unless xAI exposes programmatic team creation or usage/cost grouping by API key, xAI does not provide OpenAI-equivalent provider-native tenant reconciliation
- the Otto proxy ledger becomes the tenant split source of truth
- operator surfaces must show that xAI tenant billing is proxy-attributed and team-reconciled, not provider-isolated, when multiple tenants share one xAI team

## Streaming Requirements

Streaming providers must be handled explicitly.

Rules:

- capture the provider response id as soon as it appears
- update in-memory accounting state as usage/cost chunks arrive
- persist a provisional request event before streaming bytes downstream
- persist the final usage/cost only after a terminal provider event or after retrieving the completed response from the provider
- do not sum cumulative usage chunks unless the provider documents each chunk as incremental
- for xAI, treat `usage` on chunks as cumulative until verified otherwise
- if the downstream client aborts before terminal usage/cost is observed:
  - mark the request `client_aborted` or `stream_incomplete`
  - persist the latest observed usage/cost as partial evidence
  - do not create a final settled credit burn unless provider semantics confirm the partial cost is final

## Background And Deferred Requests

Some providers support background, deferred, or async responses.

Rules:

- create the request event when the job is submitted
- store the provider async request id
- mark settlement `pending`
- poll or receive callback until terminal provider status
- settle only after terminal usage/cost is available
- expire and mark `metering_incomplete` if terminal state cannot be retrieved within the provider retention window

## Pricing Rule Layer

For sources without provider-reported exact cost, use versioned pricing rules.

Rules must support:

- provider
- surface
- model
- token category
- tool category
- audio/image/request categories
- cached-token pricing
- reasoning-token pricing
- long-context pricing
- effective date windows
- plan or tenant overrides
- source documentation URL or operator note

The settlement row must store the pricing rule version used so historical burns remain reproducible.

## Request Reservation

The accounting ledger should support future hard-stop enforcement.

Initial policy:

- continue using balance checks and soft enforcement where request-level reservation is not wired
- create request events at provider call start
- settle after completion

Future policy:

- estimate request max exposure before forwarding to the provider
- create a credit reservation entry
- forward only if the workspace has enough available balance or allowed buffer
- settle actual usage/cost after completion
- refund unused reservation

This reservation flow belongs in the credit ledger, but it should reference provider request events once they exist.

## Data Retention And Privacy

Accounting rows must be safe to keep for long audit windows.

Allowed:

- provider ids
- model ids
- timestamps
- status codes
- token counts
- provider-reported cost units
- safe request/response metadata
- provider request ids
- provider response ids

Forbidden:

- prompt text
- response text
- uploaded file contents
- audio transcripts
- image contents
- upstream provider API keys
- tenant runtime tokens
- OAuth access or refresh tokens
- raw headers that may contain secrets

## Implementation Notes

- Put shared accounting contracts and provider capability metadata in a billing or provider-accounting domain package only if they are consumed by more than one execution surface.
- Keep proxy HTTP adapters in `apps/api/src/runtime`.
- Keep worker reconciliation jobs in `apps/worker`.
- Keep provider-specific management clients behind small provider service interfaces.
- Do not expand generic `lib` or `utils` folders for accounting logic.
- Keep Hono RPC for workspace/admin browser APIs, but runtime proxy routes remain plain runtime-authenticated HTTP.
- Workspace model settings routes should use Hono RPC because they are browser-facing workspace settings APIs.
- Runtime model projection should remain desired-state based so a saved workspace setting and the actual runtime-applied model can be audited separately.
- Add focused tests for:
  - xAI cost tick normalization
  - OpenAI token usage normalization
  - missing-cost blocked settlement behavior
  - stream-incomplete behavior
  - aggregate reconciliation drift detection
  - model catalog accounting gate behavior
  - desired-state projection from workspace model profiles

## Rollout Sequence

### Phase 1: Accounting Contracts

- define provider accounting source enums
- define normalized usage measurement kinds
- define cost precision and conversion helpers
- define provider capability metadata for OpenAI and xAI
- define the managed model catalog shape and accounting gate

Exit check:

- code can answer which accounting method is authoritative for a provider/surface and whether a model is selectable for billable workspace use

### Phase 1.5: Workspace Model Profiles

- add workspace model profile persistence
- preserve current global default behavior when no profile exists
- add workspace settings API contracts for reading and updating the default model profile
- project model profiles into tenant desired state
- queue runtime apply when a ready tenant saves a model change with apply enabled

Exit check:

- a workspace can keep the current default model without a row, and can save an explicit model profile that creates a new desired-state version without breaking accounting gates

### Phase 2: Provider Request Ledger

- add provider request event tables
- add usage measurement tables
- add settlement tables
- add request-ledger write helpers
- do not yet change credit burn behavior

Exit check:

- OpenAI proxy can write request events and usage evidence without affecting billing

### Phase 3: OpenAI Request Evidence

- record OpenAI Responses proxy request events
- capture provider credential revision, project id, API key id, model, request id, response id, and usage
- keep existing OpenAI aggregate usage ingestion running

Exit check:

- operator view can compare OpenAI proxy-observed request usage with aggregate usage buckets for a tenant project

### Phase 4: xAI Proxy Accounting Slice

- add xAI provider credential provisioning under an existing team
- add xAI proxy route for the first supported inference surface
- record xAI request events
- normalize `usage.cost_in_usd_ticks`
- settle xAI completed requests from provider-reported cost

Exit check:

- one xAI request through the proxy creates a settled provider request event with exact provider-reported cost and no xAI key in tenant runtime env

### Phase 5: Settlement To Credit Ledger

- convert settled provider request events into credit ledger entries
- keep rule-versioned pricing for providers without exact per-call cost
- block unmetered completed requests from silent billing

Exit check:

- credits can burn from provider request settlements with auditable source links

### Phase 6: Aggregate Reconciliation

- reconcile OpenAI project costs against OpenAI request settlements
- reconcile xAI team-level costs against xAI request settlements
- surface drift in platform usage/operator views

Exit check:

- operators can distinguish matched, tolerated, and drifted provider accounting windows

## Acceptance Criteria

- a single provider request ledger model exists for all proxied paid provider calls
- workspace model/provider selection is represented as explicit workspace data with the current global default as fallback
- workspace model settings can project into tenant desired state and queue apply without deploying upstream provider keys to tenant runtimes
- model/provider options are selectable only when accounting coverage is available
- provider evidence is stored separately from credit ledger entries
- settlements link raw provider evidence to billable units and credit burns
- OpenAI remains supported through project/API-key aggregate reconciliation
- xAI can be supported through proxy-observed exact per-call cost when present
- xAI limitations around team-level reconciliation are explicit
- completed requests missing required metering data are blocked from silent billing
- streaming and deferred requests have explicit incomplete/pending accounting states
- provider capability metadata determines authoritative accounting source per provider/surface
- aggregate reconciliation can compare provider totals against request settlements

## Status Checklist

- [x] define the need for one cross-provider accounting ledger
- [x] document accounting source types
- [x] document OpenAI and xAI accounting differences
- [x] define provider capability metadata
- [x] define workspace-scoped model profile requirements
- [x] define model settings desired-state projection and apply flow
- [x] define the accounting gate for selectable providers/models
- [x] define request event, measurement, settlement, and reconciliation models
- [x] define streaming and deferred request accounting rules
- [x] define rollout phases
- [ ] implement accounting contracts
- [ ] implement managed model catalog and accounting gate
- [ ] add workspace model profile persistence and settings APIs
- [ ] project workspace model profiles into tenant desired state
- [ ] add provider request ledger migrations
- [ ] instrument OpenAI proxy request evidence writes
- [ ] add xAI provider credential/proxy accounting slice
- [ ] wire settlements into the credit ledger
- [ ] add aggregate reconciliation jobs and operator visibility

## Open Questions

- Should xAI be offered before team-per-tenant provider isolation exists, with proxy-attributed tenant billing and team-level reconciliation?
- Should provider request settlements use exact provider-reported cost as the billable basis, or should Otto still apply a provider-specific markup/multiplier before credit burn?
- Should incomplete streaming requests ever be settled from partial provider-reported cost, or should they always require provider-side response retrieval?
- What tolerance should reconciliation use before flagging provider drift?
- Should provider pricing rules live in DB from day one, or start as versioned code/config with a later operator-managed surface?
- Do we need a separate high-volume event store for request events before broad xAI/OpenAI proxy rollout?
- Should the first workspace model settings surface be admin-only, platform-operator-only, or visible to all workspace owners?
- Should model changes apply immediately by default, or should the first UI save them and require a separate `Apply` action?
- Should future model profiles distinguish interactive chat, scheduled tasks, background workflows, embeddings, and audio, or keep one default until there is a concrete need?
