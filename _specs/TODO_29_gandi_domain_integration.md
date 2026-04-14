# TODO 28: Gandi Domain Integration

## Goal

Add a managed Gandi integration that lets Otto help with domain availability, domain inspection, and DNS administration without asking each workspace to provide its own Gandi API key.

The platform should authenticate to Gandi once at the Otto level, while each workspace can still choose whether the integration is enabled for:

- the workspace UI
- Otto's agent/runtime discovery surface
- execution of Gandi-backed commands

## Scope

- add a first-party managed integration for Gandi under the existing managed-integrations substrate
- support one platform-owned Gandi credential path for Otto
- allow each workspace to enable or disable the integration without supplying its own provider credentials
- expose agent-discoverable domain and DNS commands through the existing `otto-integrations` metatool workflow
- provide structured read responses for higher-level naming and domain skills
- provide safe write patterns for DNS changes
- keep enough provider metadata to support future ownership-aware and handoff workflows

## Explicit Non-Goals For This Slice

- domain registration or checkout through Otto
- domain transfer between registrars
- automatic domain purchase on behalf of a user
- building the higher-level naming/domain skill in the same increment
- broad multi-registrar abstraction beyond what the current managed-integration framework already requires

## Dependencies

- `TODO_17_managed_integrations_architecture.md`
- `TODO_18_managed_skills.md`
- `TODO_19_oauth_connected_accounts_substrate.md`
- `TODO_20_unified_frontend_and_hono_migration.md`
- existing extracted app surfaces in `apps/api`, `apps/gateway`, `apps/web`, and `packages/features/integrations-runtime`

## Why This Needs Its Own Plan

The current integration model cleanly covers two cases:

- workspace-managed integrations with per-workspace connection state such as `Linear`
- platform-managed integrations that are effectively always on for the workspace such as `Brave`

`Gandi` should take the simpler first-pass shape:

- the workspace controls whether the integration is installed and enabled
- the provider-specific Gandi implementation uses Otto-owned credentials at execution time
- Otto should be able to discover the integration when a domain or DNS workflow needs it
- Otto should not treat the integration as always installed in every workspace

That means the plan should not force Gandi into the current `Brave` shape. It should behave like a normal workspace-installed integration in product lifecycle, while keeping provider auth inside the Gandi-specific execution code.

## Decision Summary

- Treat `Gandi` as a first-party `workspace_managed` integration in lifecycle, with platform-owned credentials used inside the provider implementation.
- Do not require per-workspace OAuth or per-workspace API keys.
- Reuse `tenant_integrations` as the canonical workspace install and status record for Gandi.
- Use the existing runtime metatool flow:
  - `find_integration_commands`
  - `list_integrations`
  - `get_integration`
  - `get_integration_details`
  - `manage_integration`
  - `execute_integration_command`
- Keep destructive DNS changes behind an explicit plan/confirm flow rather than a single blind write call.
- Phase the work:
  - Phase 1: discovery and read APIs
  - Phase 2: safe DNS writes
  - Phase 3: workflow and skill dependencies

## Product Model

At the product level, Gandi should behave like this:

- Otto platform operators configure Gandi once
- each workspace may enable or disable Gandi
- Otto can see Gandi in the available integration catalog
- Otto should normally use Gandi only when the task is domain-related
- if Gandi is not enabled in the workspace, Otto can suggest enabling it and hand the user to the workspace page
- once enabled, Otto can inspect details and execute Gandi-backed commands

This keeps credentials centralized while preserving workspace-level product control.

Concretely, `workspace_managed` should be interpreted here as:

- workspace-installed and workspace-controlled
- not necessarily workspace-authenticated with workspace-owned credentials

## Architecture

### 1. Integration definition and lifecycle model

Add a new integration definition under `packages/features/integrations-runtime/src/integrations/library/gandi`.

For the first slice, use the existing framework shape instead of introducing a new install-behavior axis.

Recommended definition shape:

- `managementMode: "workspace_managed"`
- no `oauth` binding
- workspace install state resolved from `tenant_integrations`
- provider-specific auth handled only inside the Gandi execution code

Why this is the simplest coherent approach:

- `status.ts` currently treats `platform_managed` integrations as implicitly installed when no workspace row exists
- that matches `Brave` but is wrong for Gandi
- `workspace_managed` already gives the lifecycle behavior we want:
  - visible in the catalog
  - installed per workspace
  - enabled and disabled per workspace
  - absent from `scope=installed` until enabled

No generic framework-level credential-origin abstraction is required for the first slice.

### 2. Credential ownership

Phase 1 should use one Otto-owned Gandi credential configured in control-plane env and consumed only by control-plane services.

Recommended first slice:

- `GANDI_API_TOKEN`
- optional `GANDI_BASE_URL` override if needed for testability

Do not project the Gandi token into tenant runtimes.

The token should be used by provider-specific Gandi code only:

- read-oriented provider helpers where the workspace UI or API needs live provider reads
- `apps/gateway` command execution through the Gandi integration implementation

The framework does not need a new generic concept for "credential source" to support this. The Gandi integration code already knows it should use Otto's platform token.

If Otto later needs:

- multiple platform Gandi accounts
- token rotation history
- region-specific routing
- per-provider operator UI

then move that credential path into a dedicated operator-managed provider-account substrate. That does not need to block the first usable slice.

### 3. Workspace install state

Use `tenant_integrations` for workspace-level enablement. For Gandi:

- creating or enabling the integration inserts or updates a `tenant_integrations` row
- disabling the integration keeps the row but marks it disabled or disconnected
- execution and discovery should treat disabled workspaces as unavailable

This should be exposed through:

- workspace UI controls in `apps/web`
- workspace routes in `apps/api`
- runtime `manage_integration` responses for agent handoff

No OAuth session or per-workspace credential row is required for the first Gandi slice.

### 4. Runtime discovery behavior

Gandi should integrate with the existing static `otto-integrations` plugin instead of introducing a new runtime plugin.

The intended behavior is:

- `list_integrations(scope=installed)` should show Gandi only when the workspace has enabled it
- `list_integrations(scope=available)` should include Gandi in the workspace catalog
- `find_integration_commands` should be able to surface Gandi when user intent is strongly about:
  - domain availability
  - domain selection
  - DNS records
  - verification records
  - launch cutovers
- if Gandi is not installed, discovery results should point the agent toward `manage_integration`
- once enabled, command details and execution should work through the normal flow

This matches the requirement that Otto can discover it, install it, and use it, but only when needed.

### 5. API and service boundaries

Keep the code domain-first:

- `packages/features/integrations-runtime/src/integrations/library/gandi`
  - provider client
  - input validation
  - response normalization
  - runtime command definitions
  - status resolution helpers
  - DNS safety rules and diff logic
- `apps/gateway`
  - execute Gandi runtime commands via the existing gateway execute route
- `apps/api/src/integrations`
  - workspace catalog/detail/install-status routes
  - workspace enable or disable actions
  - any safe settings/detail routes needed by the workspace UI
- `apps/web/src/features/.../integrations/gandi`
  - workspace integration page
  - enable or disable controls
  - domain and DNS status UI as needed for the first shipping slice

Do not add Gandi-specific product logic to generic repo-wide `lib` folders.

## Phase Plan

### Phase 1: discovery and read capabilities

Goal:

- make Gandi available as a workspace-opt-in integration with useful read-only domain and DNS capabilities

Deliverables:

- Gandi integration definition and catalog entry
- platform-level Gandi client
- workspace enable or disable lifecycle
- runtime discovery support for domain and DNS tasks
- read commands for:
  - `domain.check_availability`
  - `domain.get_details`
  - `dns.zone.get`
  - `dns.record.list`
  - pricing or registration metadata when Gandi exposes it in a stable way
- normalized response contracts that higher-level skills can consume

Implementation notes:

- prefer batching support for domain availability checks because naming workflows commonly evaluate many candidates
- normalize provider-specific record shapes into a stable Otto response contract
- preserve raw provider identifiers where future mutation calls will need them
- return ownership and registrar metadata when available, even if the first UI does not display every field

Exit check:

- Otto can discover Gandi for domain-related tasks, prompt the user to enable it if needed, and perform read-only checks once enabled

### Phase 2: operational DNS capabilities

Goal:

- support safe DNS record changes through the managed-integration execution path

Deliverables:

- write commands for:
  - `dns.record.create`
  - `dns.record.update`
  - `dns.record.delete`
- support for at least:
  - `A`
  - `AAAA`
  - `CNAME`
  - `MX`
  - `TXT`
  - `NS`
  - `SRV`
- structured dry-run or plan output
- explicit confirmation token or equivalent guardrail for destructive changes
- execution audit records that clearly describe proposed and applied DNS diffs

Recommended command pattern:

- `dns.record.plan_changes`
  - input: desired record mutations
  - output: normalized diff, warnings, and a short-lived `changeToken`
- `dns.record.apply_changes`
  - input: `changeToken` plus explicit confirmation
  - output: applied records and post-change zone state summary

Why this pattern is preferred:

- it keeps destructive DNS changes inspectable
- it gives skills a stable artifact to present and confirm
- it avoids encoding destructive confirmation into ad hoc free-text prompts

Exit check:

- Otto can safely stage and apply common DNS record changes with structured confirmation

### Phase 3: workflow and skill support

Goal:

- make Gandi usable as a dependency for higher-level naming and domain workflows

Deliverables:

- integration metadata rich enough for skills to understand:
  - current state
  - recommended next actions
  - verification targets
  - pending DNS risks
- one or more curated skill dependencies documented against Gandi, for example:
  - business naming and domain research
  - DNS verification setup
  - launch readiness
  - email/domain onboarding
  - service cutover
- explicit provider metadata for eventual ownership-aware flows, including future handoff to a user-owned Gandi account

Exit check:

- a higher-level domain or naming skill can depend on Gandi without treating it as just a thin DNS CRUD wrapper

## Data And State Plan

### Reuse existing generic tables first

Use the current generic substrate before adding new provider-specific tables:

- `tenant_integrations`
- `tenant_integration_capability_states`
- `integration_execution_audits`

Only add a provider-specific Gandi table if real query pressure or durable provider state justifies it.

Likely first-slice need:

- no Gandi-specific installation table
- no per-workspace secret row
- optional generic settings/state JSON only if the UI needs durable preferences such as default domain suggestion rules or record-display filters

### Status semantics

For Gandi, status should distinguish at least:

- `connected`
  - workspace enabled and platform credential healthy
- `disabled`
  - workspace has turned the integration off
- `needs_attention`
  - workspace enabled but Otto's platform credential or provider access is unhealthy
- `error`
  - last execution or provider check failed in a way that should be surfaced

The status resolver should combine:

- workspace install state
- platform credential health
- any provider reachability checks used by the first slice

## Command Design

The Gandi command set should be small, domain-shaped, and structured for skills.

Recommended first command set:

- `domain.check_availability`
- `domain.get_details`
- `domain.get_registration_metadata`
- `dns.zone.get`
- `dns.record.list`
- `dns.record.plan_changes`
- `dns.record.apply_changes`

Design rules:

- prefer explicit domain and zone nouns over provider jargon
- return structured records and diffs, not provider text blobs
- include provider ids and revision metadata where later writes need optimistic targeting
- keep command arguments stable even if the underlying Gandi API shape changes

## Workspace UI Plan

Add a Gandi integration page in the workspace integration area with:

- status
- enable or disable action
- current capabilities summary
- explanation that Otto manages the provider connection centrally
- warnings for destructive DNS changes and future ownership handoff expectations

For the first slice, the workspace should not expose raw platform secrets or operator-only configuration.

The page should explain the product model clearly:

- Otto has the provider connection
- this workspace chooses whether Otto may use it here

## Agent Install Flow

Because Gandi does not use per-workspace OAuth, `manage_integration` for Gandi should not behave like Slack or Linear.

The expected lifecycle is:

1. user asks Otto for a domain or DNS task
2. Otto discovers Gandi is relevant
3. if not enabled, Otto calls `manage_integration`
4. the control plane returns a workspace URL and next action like `enable`
5. user enables Gandi in the workspace
6. Otto retries discovery or execution

This is an enablement flow, not an OAuth consent flow.

## Testing Plan

### Package-level tests

- Gandi client response normalization
- availability parsing
- DNS record normalization
- command argument validation
- DNS diff planning and confirmation-token validation
- status resolution for:
  - enabled
  - disabled
  - needs attention

### API and gateway tests

- workspace catalog and detail routes include Gandi correctly
- enable or disable actions update workspace-visible state correctly
- runtime detail and execute routes expose the expected command contracts
- gateway blocks disabled or unhealthy execution

### UI tests

- integration catalog shows Gandi
- detail page renders the workspace-controlled enable or disable state
- settings copy does not imply the user must bring their own API key

## Acceptance Criteria

- Otto operators can configure Gandi once at the platform level
- a workspace can enable or disable Gandi without supplying its own provider credential
- Otto can discover Gandi through the existing managed-integrations metatool flow
- Otto only surfaces and uses Gandi when the task actually calls for domain or DNS help
- read flows support domain availability, managed domain inspection, and DNS reads
- write flows support safe DNS changes with explicit plan and confirm behavior
- responses are structured enough for higher-level naming and domain skills to consume directly
- the implementation stays within the current extracted app and shared-package architecture

## Status Checklist

- [ ] add Gandi integration definition and catalog metadata
- [ ] add platform-level Gandi client and env wiring
- [ ] add workspace enable or disable lifecycle for Gandi
- [ ] add Phase 1 read commands and runtime discovery metadata
- [ ] add Phase 2 DNS plan/apply commands with confirmation guardrails
- [ ] add workspace UI for Gandi integration status and enablement
- [ ] add tests across package, API, gateway, and UI layers
- [ ] document the higher-level skill dependency contract for domain workflows

## Open Questions

- Does Gandi expose the exact pricing and availability metadata we want on the API surface, or should Phase 1 treat pricing as best-effort metadata?
- Should the first workspace action be labeled `Enable`, `Install`, or `Turn on` for platform-managed integrations that do not use OAuth?
- Do we want the initial domain detail read to include registrar ownership transfer metadata now, or only preserve the raw provider fields for later?
- Should the framework docs explicitly clarify that `workspace_managed` means workspace-installed and workspace-controlled, not necessarily workspace-authenticated?
- Is any background sync job needed in Phase 1, or can the first slice remain fully request-driven until we add registration and transfer workflows?
