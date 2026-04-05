# TODO 15: Billing And Credit Metering

## Goal

Lock the first Otto billing architecture around a prepaid credit burndown model backed by Stripe for commerce, OpenAI for the first provider integration, and an Otto-owned credit ledger for limits, burn, reconciliation, and future provider expansion.

## Scope

- define the user-facing billing product model for the first paid Otto plans
- define the Stripe integration shape for subscriptions, checkout, top-ups, invoices, and the billing portal
- define the internal credit ledger and usage-to-credit conversion model
- define OpenAI tenant credential provisioning and usage/cost ingestion for the first provider
- define the workspace billing page and the minimum billing operations surface
- define the worker jobs, reconciliation flows, and rollout sequence needed to ship this safely

## Non-goals

- building true postpaid overage billing in the first slice
- making Stripe the source of truth for Otto credits
- exposing raw provider token or cost economics directly to users
- locking Otto permanently to OpenAI-specific data models or APIs
- designing tax, refund, dispute, and revenue-recognition accounting beyond the first operational decisions needed to ship

## Dependencies

- `DONE_02_auth_and_tenant_model.md` for organization membership, workspace settings, and org-scoped routes
- `TODO_00_architecture_and_job_runtime.md` for durable job execution and webhook-driven state changes
- `TODO_01_repo_foundation.md` for schema, env, and shared service patterns in `web/`
- `TODO_09_ui_app_shell_and_onboarding_rebuild.md` for the workspace settings surface where billing will live
- `TODO_14_session_history_visibility.md` as an optional later input for richer usage attribution and session-level reporting

## Product decisions

### Billing primitive

- Use prepaid monthly credits as the user-facing commercial model.
- Keep `billable units` and `credits` as separate concepts in schema and code even if the first live exchange rate is effectively `1 credit = 1 billable unit`.
- Use `billable units` for internal normalization and accounting.
- Use `credits` for the workspace wallet, plan packaging, promotions, and top-ups.

### Stripe role

- Stripe owns commerce:
  - checkout
  - recurring subscriptions
  - invoices
  - payment methods
  - billing portal
- Otto owns the usage and credit system:
  - credit grants
  - credit burn
  - credit expiry
  - fair-use windows
  - provider usage reconciliation
  - hard-stop and soft-stop enforcement

### Provider role

- Start with OpenAI as the first managed provider.
- Provision one OpenAI project and one project service-account key per tenant runtime.
- Build the Otto interfaces so future providers can plug in even if they do not support automatic project or key provisioning.

### Customer scope

- Billing is organization-scoped because the user-facing surface is the workspace.
- Usage should still be attributable to tenant, session, model, modality, and provider so future pooled billing remains possible.

## Initial commercial package

Assumption from the product discussion: the third plan is meant to be `$200 -> 100,000 credits`, not `$200 -> 100,000 dollars`.

Recommended v1 package to lock in now:

- Starter: `$50/month` for `25,000` credits
- Growth: `$90/month` for `60,000` credits
- Scale: `$200/month` for `100,000` credits

Locked plan catalog for v1:

- `starter_monthly`
  - price: `$50/month`
  - included credits: `25,000`
  - Stripe product family: `subscription`
- `growth_monthly`
  - price: `$90/month`
  - included credits: `60,000`
  - Stripe product family: `subscription`
- `scale_monthly`
  - price: `$200/month`
  - included credits: `100,000`
  - Stripe product family: `subscription`

Locked top-up catalog for v1:

- `top_up_10000`
  - price: `$25`
  - granted credits: `10,000`
  - expiry: `12 months after purchase`
- `top_up_25000`
  - price: `$55`
  - granted credits: `25,000`
  - expiry: `12 months after purchase`
- `top_up_50000`
  - price: `$100`
  - granted credits: `50,000`
  - expiry: `12 months after purchase`

Catalog rules:

- plan keys and top-up keys are stable internal ids and must not be renamed after Stripe products exist
- product copy can change later without changing the key
- plan prices are locked for the first implementation slice and should not be treated as runtime-configurable yet
- top-up packs are intentionally priced at a worse effective rate than the best subscription tier so subscriptions remain the default commercial path

Policy decisions:

- subscriptions renew monthly
- included credits expire at the end of the current billing period
- billing anchors to the first day of the calendar month in the workspace timezone when Stripe supports the desired anchor directly; otherwise anchor in UTC and keep Otto policy text calendar-month based
- signup mid-month uses Stripe proration to the next month boundary rather than an Otto-side custom invoice flow
- upgrades take effect immediately with Stripe-managed proration
- downgrades take effect at the next renewal boundary to avoid clawing back already-granted included credits
- no rollover for included monthly credits in v1

Top-up policy:

- support fixed manual top-up packs in v1
- implement top-ups as one-time Stripe Checkout purchases, not subscription quantity changes
- paid top-up credits should expire after `12 months` by default so the product does not feel punitive
- include metadata on each top-up price for `credits_granted`, `plan_family=top_up`, and `expiry_policy`
- top-up packs do not change the renewal date or subscription tier
- top-up credits are burned after included monthly credits are exhausted so included credits still expire cleanly at period end

Overage policy:

- do not allow unconstrained negative balances in v1
- when a workspace reaches zero credits, stop new paid usage and push the user to top up or upgrade
- allow a narrow in-flight settlement buffer so one already-started request can finish cleanly
- defer Stripe-invoiced usage overages until the Otto ledger and provider reconciliation are stable

Hidden fair-use policy:

- keep rolling windows separate from billing and treat them as risk controls
- start them in shadow mode before they can block usage
- suggested defaults:
  - rolling `5h` threshold: `40%` of included monthly credits
  - rolling `24h` threshold: `80%` of included monthly credits
  - rolling `7d` threshold: `150%` of included monthly credits
- allow plan-specific and tenant-specific overrides

## Architecture summary

### Commerce flow

1. A workspace selects a plan in Otto.
2. Otto creates or reuses a Stripe customer for the organization.
3. Otto creates a Stripe Checkout session in `subscription` mode for the selected recurring price.
4. Stripe hosts payment collection and creates the subscription.
5. Otto grants credits only after `invoice.paid`, not on Checkout completion alone.
6. Otto sends users to Stripe's billing portal for payment-method updates, cancellation, invoice history, and plan changes.

### Credit flow

1. Stripe payment success creates a credit grant in Otto.
2. Otto stores credit grants, burns, refunds, expiries, and manual adjustments in an immutable ledger.
3. Current workspace balance is derived from the ledger and optionally cached for fast reads.
4. Provider usage is converted into billable units and then debited as credits using versioned rules.
5. Otto, not Stripe, decides whether the workspace still has spendable balance.

### Provider flow

1. Tenant provisioning or tenant upgrade creates an OpenAI project and service account if the workspace uses Otto-managed credentials.
2. Otto encrypts and stores the provider credential needed by the tenant runtime.
3. The worker polls OpenAI usage at short intervals and OpenAI costs at a slower reconciliation cadence.
4. Raw provider data is stored immutably.
5. Otto computes normalized billable units and the final credit debits from raw provider data.

## Stripe model

### v1 objects

- one Stripe `Customer` per workspace organization
- one recurring Stripe `Price` per monthly plan
- one one-time Stripe `Price` per top-up pack
- one Stripe Checkout session for new subscriptions and top-ups
- one Stripe billing portal session for self-serve billing management

### v1 rules

- keep the base plans as fixed recurring prices, not metered subscription items
- keep plan metadata in both Otto config and Stripe metadata
- use this recurring-price metadata contract:
  - `otto_plan_key`
  - `otto_plan_family=subscription`
  - `included_credits`
  - `credit_expiry_policy=period_end`
  - `workspace_limit_policy=prepaid`
  - `billing_interval=monthly`
- use this top-up-price metadata contract:
  - `otto_top_up_key`
  - `otto_plan_family=top_up`
  - `credits_granted`
  - `credit_expiry_policy=12_months`
  - `workspace_limit_policy=prepaid`
- use this shared product metadata where helpful:
  - `otto_catalog_version=v1`
  - `otto_currency=usd`
- treat Otto as the source of truth for credit balances even if Stripe metadata mirrors plan values

### Why not make Stripe the credit ledger

- Stripe subscriptions and invoices map well to money, not to Otto's internal burn model.
- Otto needs immediate balance checks, request reservation, and provider reconciliation that are outside Stripe's billing lifecycle.
- Stripe's advanced usage-based credit burndown surfaces are still documented in private preview and should not be the base dependency for Otto v1.

### Stripe usage-based billing stance

- Include a future path for Stripe meters, but do not depend on them for v1 prepaid billing.
- If Otto later adds postpaid overage:
  - add a separate metered subscription item
  - emit Stripe meter events from Otto's already-computed billable usage
  - keep Otto's own ledger as the operational source of truth
- If helpful, Otto can emit Stripe meter events in shadow mode before overages are launched, but those events must not be used for balance enforcement.

## Provider provisioning and metering model

### Provider abstraction

Introduce small interfaces rather than scattering OpenAI-specific logic:

- `ProviderProvisioner`
  - `createTenantCredential`
  - `rotateTenantCredential`
  - `revokeTenantCredential`
- `ProviderUsageCollector`
  - `fetchUsageBuckets`
  - `fetchCostBuckets`
- `ProviderUsageNormalizer`
  - `normalizeUsageToBillableUnits`
  - `convertBillableUnitsToCredits`

OpenAI is the first implementation, not the permanent shape of the system.

### OpenAI provisioning

Recommended default for Otto-managed usage:

- one OpenAI project per tenant runtime
- one OpenAI service account per project
- one active runtime credential per tenant runtime, stored encrypted by Otto

Store both control-plane and provider identifiers:

- `provider=openai`
- `project_id`
- `service_account_id`
- `api_key_id` when available
- encrypted raw API key
- status, rotation, and revocation metadata

### OpenAI usage ingestion

Use OpenAI's organization usage endpoints for granular usage and the costs endpoint for slower financial reconciliation.

Recommended cadence:

- usage buckets: every `1 minute` by `project_id`, optionally grouped by `api_key_id` and `model`
- cost buckets: daily by `project_id`
- reconciliation backfill: rerun recent windows to handle late-arriving data or transient failures

Store raw provider data immutably:

- raw usage bucket payloads
- raw cost bucket payloads
- ingestion cursor and request metadata
- normalized conversion outputs linked back to the raw bucket source and rule version

## Credits, billable units, and conversion

### Concept split

- raw provider usage: tokens, requests, model, modality, provider-reported cost
- billable units: Otto's internal normalized metering unit
- credits: user-facing wallet currency burned from the workspace balance

### v1 conversion model

Use a versioned pricing rules table or config layer that can express:

- provider
- model
- modality
- input/output/cache/audio/image dimensions
- optional request floor
- plan-specific multiplier
- promotional or manual override
- effective date range

Recommended shape:

`raw provider usage -> normalized billable units -> credits burned`

Practical v1 guidance:

- keep the first live exchange simple enough to explain internally
- allow `1 credit = 1 billable unit` initially if that reduces complexity
- keep the rule layer separate so model-specific multipliers can change without a schema rewrite

### Settlement model

Separate burn accounting from raw provider polling:

- reserve estimated credits before or at request start when Otto has a runtime-side control point
- settle actual credit burn after completion
- refund unused reserved credits
- when runtime-side reservation is not yet available, debit from near-real-time provider polling and apply a small operational buffer before hard-stop enforcement

This split lets Otto move from soft enforcement to true hard enforcement without changing the ledger model.

## Workspace billing surface

Add a workspace billing area under settings instead of pushing users directly into Stripe-only views.

Recommended initial route:

- `web/src/app/[orgSlug]/settings/workspace/billing/page.tsx`

Recommended navigation change:

- add `Billing` under the `Workspace` section in the settings sidebar

The billing page should show:

- current plan
- renewal date
- included credits for the current period
- current remaining credits
- current fair-use state if enforcement is active
- recent usage by day
- recent credit burns grouped by model and modality
- recent grants, expiries, and adjustments
- payment method summary
- invoice history link
- upgrade and top-up actions
- a link into the Stripe billing portal

Stripe remains the hosted surface for:

- checkout
- payment method management
- invoice download
- subscription cancellation
- subscription plan switch flows that fit the configured portal catalog

## Data model additions

Billing should be organization-scoped first, with optional tenant and session attribution on usage records.

Recommended new tables:

- `billing_customers`
  - `organization_id`
  - `stripe_customer_id`
  - `default_currency`
  - `portal_configuration_id`
  - `created_at`
  - `updated_at`
- `billing_subscriptions`
  - `organization_id`
  - `stripe_subscription_id`
  - `stripe_price_id`
  - `plan_key`
  - `status`
  - `current_period_start`
  - `current_period_end`
  - `cancel_at_period_end`
  - `trial_end`
  - `created_at`
  - `updated_at`
- `billing_checkout_sessions`
  - `organization_id`
  - `stripe_checkout_session_id`
  - `mode`
  - `status`
  - `plan_key`
  - `top_up_pack_key`
  - `created_at`
  - `updated_at`
- `credit_grants`
  - `organization_id`
  - `source_type` such as `subscription_cycle`, `top_up`, `promo`, `manual_adjustment`, `refund_reversal`
  - `source_id`
  - `credits_total`
  - `credits_remaining`
  - `expires_at`
  - `granted_at`
  - `voided_at`
- `credit_ledger_entries`
  - `organization_id`
  - `tenant_id`
  - `session_id`
  - `entry_type` such as `grant`, `reserve`, `settle`, `refund`, `expire`, `manual_adjustment`
  - `credits_delta`
  - `billable_units_delta`
  - `provider_cost_usd`
  - `source_type`
  - `source_id`
  - `rule_version`
  - `metadata_json`
  - `created_at`
- `credit_balance_snapshots`
  - optional cache table or materialized derived state for fast workspace reads
- `provider_accounts`
  - `tenant_id`
  - `provider_key`
  - `external_project_id`
  - `status`
  - `provisioned_at`
  - `revoked_at`
- `provider_credentials`
  - `tenant_id`
  - `provider_key`
  - `credential_type`
  - `external_key_id`
  - `ciphertext`
  - `key_version`
  - `last_rotated_at`
  - `revoked_at`
- `provider_usage_buckets`
  - `provider_key`
  - `tenant_id`
  - `organization_id`
  - `bucket_start`
  - `bucket_end`
  - `granularity`
  - `grouping_json`
  - `raw_usage_json`
  - `ingested_at`
- `provider_cost_buckets`
  - `provider_key`
  - `tenant_id`
  - `organization_id`
  - `bucket_start`
  - `bucket_end`
  - `raw_cost_json`
  - `ingested_at`
- `usage_conversion_rule_sets`
  - `version`
  - `status`
  - `rules_json`
  - `effective_at`
  - `created_at`
- `usage_conversion_results`
  - `provider_usage_bucket_id`
  - `organization_id`
  - `tenant_id`
  - `billable_units`
  - `credits_burned`
  - `provider_cost_usd`
  - `rule_version`
  - `created_at`
- `billing_reconciliation_runs`
  - `provider_key`
  - `window_start`
  - `window_end`
  - `status`
  - `summary_json`
  - `created_at`
  - `finished_at`
- `billing_fair_use_windows`
  - `organization_id`
  - `window_key`
  - `threshold_credits`
  - `enforcement_mode`
  - `updated_at`

### Existing-table reuse

- keep `tenant_runtime_secrets` only for runtime secrets actually projected into the tenant runtime
- use new provider credential tables for provider lifecycle tracking instead of overloading unrelated secret rows
- link billing and usage data to `tenant_sessions` when session history becomes available enough to support precise attribution

## Jobs and webhook flows

### Stripe webhooks

At minimum, handle:

- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Rules:

- treat `checkout.session.completed` as a purchase signal, not the final grant signal
- grant recurring credits on `invoice.paid`
- grant top-up credits after successful one-time payment completion
- make all webhook handlers idempotent by event id and Stripe object id

### Otto jobs

Recommended job types:

- `billing_sync_subscription_state`
- `grant_subscription_cycle_credits`
- `grant_top_up_credits`
- `expire_credits`
- `provider_provision_tenant_credential`
- `provider_rotate_tenant_credential`
- `provider_usage_poll_openai`
- `provider_cost_reconcile_openai`
- `usage_convert_to_billable_units`
- `credit_settlement_reconcile`
- `fair_use_window_evaluate`
- `stripe_meter_emit_shadow`

## Implementation notes

### Recommended file areas

- `web/src/lib/billing/`
  - `plans.ts`
  - `stripe.ts`
  - `ledger.ts`
  - `credits.ts`
  - `reconciliation.ts`
- `web/src/lib/providers/`
  - `types.ts`
  - `openai/provisioning.ts`
  - `openai/usage.ts`
  - `openai/costs.ts`
- `web/src/app/api/stripe/webhook/route.ts`
- `web/src/app/api/workspace/[orgSlug]/billing/checkout/route.ts`
- `web/src/app/api/workspace/[orgSlug]/billing/top-ups/route.ts`
- `web/src/app/api/workspace/[orgSlug]/billing/portal/route.ts`
- `web/src/app/[orgSlug]/settings/workspace/billing/page.tsx`
- `web/src/worker/` job handlers for Stripe sync, provider usage, reconciliation, and credit expiry

### Stripe catalog guidance

- use one recurring product family for plans
- use one one-time product family for top-ups
- keep credit quantities in Otto config and mirror them in Stripe metadata
- avoid encoding balance state into Stripe subscription quantity

### Billing-cycle guidance

- if the product requirement remains "charged at the beginning of the month," use Stripe billing cycle anchors to align renewals to the first of each month
- let Stripe handle prorations on signup and plan changes rather than inventing an Otto-only proration engine
- if the anchor complexity becomes operationally noisy, fall back to "monthly from signup date" rather than blocking paid launch

## Ordered implementation roadmap

The roadmap below is intentionally ordered as vertical slices rather than one schema-heavy foundation phase. Each step should leave Otto with one new end-to-end capability that can be validated before the next layer is added.

### Step 1: Lock billing primitives and catalog shape

Goal:

- finalize the initial commercial package, expiry policy, Stripe object mapping, and workspace-scoped ownership model

Deliverables:

- `TODO_15` decisions accepted
- plan keys and top-up pack keys defined
- Stripe product and price metadata contract defined
- billing-cycle anchor and proration policy written down

Exit check:

- there is one stable definition of plans, credits, expiry, and Stripe mapping

### Step 2: Ingest raw OpenAI usage buckets

Goal:

- prove that Otto can collect real provider usage on a recurring cadence and persist it immutably without involving credits or Stripe yet

Pipeline decision for this step:

- do not convert usage into billable units or credits inline during ingestion
- do not emit Stripe meter events from the ingestion job
- treat ingestion as the raw-facts layer only

Reasoning:

- raw provider buckets need to remain reproducible and reprocessable when pricing rules change
- failed or delayed conversion must not force a re-fetch from OpenAI if the raw buckets are already stored
- Stripe should stay out of the operational loop until Otto has a stable prepaid ledger and a clear overage decision

Step-2 pipeline shape:

1. The worker chooses a short recent time window for a tenant's OpenAI project.
2. Otto calls the OpenAI usage endpoint with `bucket_width=1m`, filtered by `project_id`, grouped by at least `project_id`, `api_key_id`, and `model`.
3. Otto stores only the flattened, billing-relevant bucket fields in Postgres.
4. Otto stores one sync-state row per provider account plus usage type for cadence, cursor, and failure tracking.
5. Otto can re-run overlapping recent windows to capture late-arriving usage without storing bulky raw payloads.

Recommended v1 storage split:

- `provider_usage_sync_states`
  - one row per provider account plus usage type
  - includes cadence, last successful window end, and latest failure state
- `provider_usage_buckets`
  - one row per flattened minute bucket result
  - includes provider account, tenant, API key, model, bucket window, usage object type, and unpacked typed metrics only

Idempotency rule:

- uniqueness should be based on provider + tenant + usage object type + bucket start/end + grouping dimensions such as `project_id`, `api_key_id`, and `model`
- reruns should upsert or ignore exact duplicates rather than append unbounded duplicate rows

Out of scope for Step 2:

- credit grants
- credit debits
- billable-unit conversion
- user-facing balances
- Stripe meter events
- hard-stop enforcement

What happens later:

- Step 3 adds operator visibility for the raw usage and daily costs
- Step 6 consumes the stored raw usage buckets and produces billable units plus credit debits
- Step 11 is the first place where Stripe meter-event emission should even be reconsidered, and only for optional postpaid overage

Deliverables:

- minimal schema for raw usage sync state and typed usage buckets
- OpenAI usage collector that polls per-minute usage by `project_id`, ideally also grouped by `api_key_id` and `model`
- idempotent worker-side cursor strategy for recent-window backfill and retry
- operator-only diagnostics for ingestion success, lag, bucket counts, and latest failure state

Current implementation notes:

- the current ingestion slice covers the current OpenAI organization usage endpoints:
  - `completions`
  - `embeddings`
  - `audio_speeches`
  - `audio_transcriptions`
  - `images`
  - `moderations`
  - `vector_stores`
  - `code_interpreter_sessions`
- the worker now polls those usage types directly on a recurring cadence instead of creating one persisted job row per metering tick
- the database stores one compact sync-state row per modality plus one typed usage-bucket row per actual provider bucket
- OpenAI `audio_translations` does not currently have a matching organization usage endpoint in the official reference, so translation-specific raw ingestion remains out of scope until that surface exists or costs become the only available source
- credit conversion, Stripe reporting, and workspace-visible usage remain explicitly downstream work

Exit check:

- Otto can show recent raw OpenAI usage for a real tenant project from data stored in Postgres

### Step 3: Add operator visibility for provider usage and cost

Goal:

- make the raw provider data legible before any commercial burn logic is attached to it

Deliverables:

- platform-facing usage view or table showing recent usage by workspace, model, and API key
- daily OpenAI cost reconciliation by project
- drift and missing-bucket diagnostics between usage polling and cost polling
- links from provider rows back to workspace and tenant context

Exit check:

- an operator can inspect raw provider usage and reconciled daily cost without using the OpenAI dashboard

### Step 4: Ship Stripe subscription checkout and billing portal

Goal:

- let a workspace start, manage, and cancel a paid plan through Stripe-hosted surfaces before credits are burned

Deliverables:

- minimal billing schema for `billing_customers`, `billing_subscriptions`, and Stripe event idempotency
- plan selection action in the workspace
- subscription Checkout session creation
- Stripe billing portal session creation
- webhook-backed subscription state sync without credit grants yet

Exit check:

- a test workspace can subscribe, renew, fail payment, and cancel with subscription state visible in Otto

### Step 5: Grant credits from Stripe payments

Goal:

- make successful Stripe payments create spendable Otto credits with a clear period model

Deliverables:

- immutable credit ledger tables
- recurring credit grants on `invoice.paid`
- one-time top-up credit grants on successful payment
- derived workspace balance read path
- credit expiry job for included credits and top-up packs

Exit check:

- Otto can show a correct workspace balance and grant history using only Otto billing data

### Step 6: Convert provider usage into billable units and credit debits

Goal:

- turn already-ingested raw provider data into reproducible, explainable credit burn

Deliverables:

- rule-versioned usage conversion
- billable-unit calculation linked back to raw usage buckets
- credit debit entries linked to the conversion result
- reconciliation views between raw provider usage, conversion outputs, and workspace balance

Exit check:

- Otto can explain why a workspace lost credits for a specific provider usage bucket

### Step 7: Ship the workspace billing page

Goal:

- expose plan, balance, recent burn, and billing controls in the workspace instead of making Stripe the only user surface

Deliverables:

- settings sidebar entry
- billing summary page
- recent usage charts or tables
- invoice and portal links
- upgrade and top-up actions

Exit check:

- an org admin can understand plan, balance, recent burn, and next steps from within the workspace

### Step 8: Add top-ups and expiry policy enforcement

Goal:

- complete the prepaid wallet model with manual replenishment and deterministic expiry behavior

Deliverables:

- top-up pack Checkout flow
- one-time payment webhook handling
- included-credit expiry behavior
- paid top-up expiry behavior
- user-facing messaging around what expires when

Exit check:

- a workspace can run out of included credits, buy a top-up, and see the correct resulting balance and expiry windows

### Step 9: Add soft alerts and fair-use windows

Goal:

- surface depletion risk and abuse signals before Otto starts actively blocking usage

Deliverables:

- shadow-mode rolling window evaluator
- alert thresholds
- low-balance and projected-depletion alerts
- operator visibility into window hits and shadow blocking decisions

Exit check:

- Otto can predict and surface risky spend patterns without changing public billing behavior

### Step 10: Add hard-stop enforcement

Goal:

- prevent new paid usage once Otto has enough confidence in the ledger and provider reconciliation loop

Deliverables:

- runtime-side or request-side balance checks where Otto has a control point
- narrow in-flight settlement buffer
- explicit out-of-credits behavior and recovery path
- audit trail for blocked requests and post-stop adjustments

Exit check:

- Otto can stop new paid usage when the workspace is out of credits while still preserving auditable burn history

### Step 11: Decide whether to add Stripe metered overage

Goal:

- add postpaid overage only if prepaid credits plus top-ups are not sufficient

Deliverables:

- shadow meter-event emission if needed
- explicit overage product definition
- invoice-preview and customer-portal behavior review
- updated user-facing policy

Exit check:

- the team can choose between staying prepaid-only or adding a separate metered overage line item without rewriting Otto's ledger

## Acceptance criteria

- the repo has one written source of truth for Otto billing, credits, provider metering, and Stripe/OpenAI integration boundaries
- Stripe is clearly defined as the commerce system, not the operational credit ledger
- the design supports OpenAI first without forcing the rest of the codebase into OpenAI-only abstractions
- the workspace billing page, Stripe surfaces, and worker jobs are mapped to concrete file areas in `web/`
- the roadmap is decomposed into reviewable, low-risk steps instead of one large billing launch
- the missing operational concerns are explicit rather than left implicit

## Status checklist

- [x] lock the credit burndown model as the preferred billing direction
- [x] define Stripe as commerce and Otto as the credit-ledger authority
- [x] define the initial plan package, top-up policy, overage policy, and fair-use defaults
- [x] define the OpenAI-first but provider-extensible provisioning and usage-ingestion model
- [x] define the workspace billing page scope and self-serve Stripe surfaces
- [x] define the billing, provider, ledger, webhook, and reconciliation roadmap
- [x] implement the first OpenAI tenant-provisioning spike with encrypted provider credential storage and tenant-runtime key override support
- [x] add a platform operator action to provision or rotate tenant-specific OpenAI keys without losing historical key IDs
- [x] harden OpenAI key rotation so it reuses the project, applies the new key to runtime, verifies deployment, and then deletes the previous service account
- [x] validate the final live plan pricing and top-up pack values before implementation
- [x] validate whether calendar-month anchors or signup-date anchors are the better launch default
- [ ] decide whether the first live enforcement step should be soft-stop only or hard-stop with request reservation
- [x] decide whether paid top-up credits should expire after 12 months or never expire
- [ ] validate the OpenAI provisioning spike against a real admin key and confirm the exact service-account response shape

## Open questions

- Should billing be enabled only for one tenant per organization initially, or should the first schema support pooled usage across multiple tenant runtimes immediately?
- Does Otto need a bring-your-own-provider-key mode in the first paid release, or should v1 support only Otto-managed OpenAI credentials?
- What exact operational buffer is acceptable between zero visible credits and the final hard stop when usage polling is the only enforcement input?
- Should admins be able to grant manual promo credits from the workspace UI in v1, or only through an operator surface first?
- Should the workspace billing page show estimated provider cost internally for operators, or keep the UI strictly credit-native?
- Should Stripe Tax be enabled in the first paid launch, or should tax handling wait for the target market and legal posture to be confirmed?

## Missing items to keep explicit

- tax and VAT policy, including whether Stripe Tax is enabled
- dunning behavior after `invoice.payment_failed`
- plan change proration behavior and downgrade timing
- refunds, disputes, and credit clawback policy
- admin adjustments and support tooling
- customer-visible alert policy at `50%`, `80%`, and `95%` depletion
- audit logging for every grant, debit, expiry, reversal, and manual change
- data-retention rules for raw provider usage and cost payloads
- whether billing events should feed product analytics separately from the operational ledger

## References

Validated against official docs on `2026-04-05`.

Stripe:

- [Build a subscriptions integration with Checkout](https://docs.stripe.com/payments/checkout/build-subscriptions)
- [Create a Checkout Session](https://docs.stripe.com/api/checkout/sessions/create)
- [Customer portal session API](https://docs.stripe.com/api/customer_portal/sessions/create)
- [Integrate the customer portal](https://docs.stripe.com/customer-management/integrate-customer-portal)
- [Subscription billing cycle anchors](https://docs.stripe.com/billing/subscriptions/billing-cycle)
- [Usage-based billing overview](https://docs.stripe.com/billing/subscriptions/metered)
- [Advanced usage-based billing overview](https://docs.stripe.com/billing/subscriptions/usage-based/advanced/about)

OpenAI:

- [Create a project](https://platform.openai.com/docs/api-reference/projects/create)
- [Project service accounts](https://platform.openai.com/docs/api-reference/project-service-accounts/create)
- [Project API keys](https://platform.openai.com/docs/api-reference/project-api-keys/object)
- [Usage API](https://platform.openai.com/docs/api-reference/usage/completions_object)
- [Costs API](https://platform.openai.com/docs/api-reference/usage/costs)
