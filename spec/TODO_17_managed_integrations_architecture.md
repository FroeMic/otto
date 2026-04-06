# TODO 17: Managed Integrations Architecture

## Executive Summary

This spec defines how managed Otto should support integrations in a way that is secure, auditable, and compatible with OpenClaw's runtime and prompt-caching model.

The key decisions are:

- `Integrations`, `Capabilities`, and `Skills` are separate concepts.
- The `control plane` is the authority for integration state, credentials, policy, audit, and capability metadata.
- The `workspace` is where users connect and manage integrations.
- The tenant OpenClaw runtime consumes integrations through an Otto-owned runtime plugin surface.
- Managed outbound integrations should default to an Otto-owned OAuth connected-accounts substrate for first-party integrations, with hosted auth brokers remaining optional fallback infrastructure.
- Execution and proxying will run in its own `integration-gateway` container, separate from `web` and `worker`.
- Runtime injection will use `one tool per integration`, not one tool per operation and not one generic integration dispatcher.
- Tool registration must be deterministic per tenant so prompt caching stays stable while the tenant's integration set is unchanged.
- `Slack` remains control-plane-native for transport and ingress, but over time its runtime-facing surface should move into the same integration plugin family.

At a product level:

- `Integrations` are workspace-managed connections to third-party systems.
- `Capabilities` are the agent-callable operations those integrations expose.
- `Skills` are optional instructional overlays that tell Otto how to use those capabilities for the business.

## Goal And Purpose

The purpose of this system is to let users connect and use third-party applications through Otto without pushing secrets or sensitive policy into the tenant runtime.

This breaks into two separate requirements:

1. Users must be able to connect and manage integrations from the workspace UI.
2. Otto must be able to detect a missing integration, initiate the same connect flow, and resume work after the user completes it.

The system must also satisfy these goals:

- The control plane stores canonical connection state and secrets or broker references.
- The runtime receives a clean capability surface, not raw credentials.
- The agent can configure safe integration settings, but not sensitive or privileged settings.
- Webhook-driven integrations must fit into the same integration model over time.
- Long-tail custom integrations must be possible without exposing OpenClaw primitives like plugins or ClawHub to end users.

## Architecture

The architecture has four deployment components and three product layers.

Deployment components:

- `web`: workspace UI, OAuth start and callback, settings, and management APIs.
- `worker`: sync jobs, retries, apply jobs, and webhook follow-up work.
- `integration-gateway`: runtime execution proxy, provider mediation, live policy checks, audit emission, and eventually webhook ingress.
- `postgres`: system of record for integration state and policy.

Product layers:

- `Integrations`: workspace-visible connected apps.
- `Capabilities`: runtime-callable operations exposed by those integrations.
- `Skills`: optional business guidance for using them correctly.

The high-level topology should be:

```text
+------------------------+         +------------------------+
| Workspace UI           |         | Tenant OpenClaw        |
| connect/manage         |         | runtime + Otto agent   |
+-----------+------------+         +-----------+------------+
            |                                  |
            v                                  v
+-----------------------------------------------------------+
| web (control-plane UI/API)                                |
| - integration metadata                                    |
| - connect/disconnect lifecycle                            |
| - settings authority                                      |
| - capability registry                                     |
+----------------------+------------------------+-----------+
                       |                        |
                       v                        v
              +----------------+      +----------------------+
              | postgres       |      | integration-gateway  |
              | source of truth|      | runtime execute path |
              +-------+--------+      | live policy + audit  |
                      ^               +----------+-----------+
                      |                          |
                      |                          v
              +-------+--------+        +--------------------+
              | worker         |        | Otto OAuth         |
              | retries/syncs  |        | sessions + refresh |
              +----------------+        +---------+----------+
                                                  |
                                                  v
                                           +-------------+
                                           | Linear etc. |
                                           +-------------+
```

The important principle is that the `control plane` remains the authority. Hosted auth brokers may be used selectively, but they are implementation dependencies rather than the system of record.

## Detailed Model

Use the following language consistently:

- `Integration`: a workspace-scoped connection to an external third-party system.
- `Capability`: a runtime-callable operation exposed by that integration.
- `Skill`: text-based business guidance that may depend on one or more integrations.

Examples:

- Linear is an `integration`.
- `search_issues` and `create_issue` are `capabilities`.
- "Use team ENG, label customer bugs as `cust-bug`, create issues in project Core" is a `skill`.

Internally, integrations fall into four classes.

### Class A: Global managed integrations

Example: Brave web search. These are centrally configured and visible in the workspace, but do not require per-workspace OAuth.

### Class B: Workspace-managed outbound integrations

Example: Linear, GitHub, and Notion. These are connected per workspace and primarily expose outbound API capabilities.

### Class C: Workspace-managed hybrid integrations

Example: Slack today, GitHub later if webhooks are enabled. These support outbound capabilities and inbound, webhook, or event-driven traffic. Webhooks are not a separate subsystem. They are part of the integration model.

### Class D: Custom integrations

These are workspace-visible connections to third-party applications that Otto does not provide as first-party managed integrations yet. They may be implemented internally using a CLI, MCP server, generated connector, or local bridge, but those are implementation details only. End users should not be exposed to raw OpenClaw plugins, ClawHub, or generic local scripts as product concepts.

## Framework Recommendation

Managed outbound integrations should default to an Otto-owned OAuth connected-accounts substrate for first-party integrations.

Why this is now the recommendation:

- Otto already needs its own integration authority, runtime manifest generation, policy enforcement, and provider-specific capability layer.
- High-value integrations such as Linear need provider-specific auth behavior like `actor=app` that may not fit hosted broker defaults cleanly.
- Postgres plus the in-repo worker is enough to own session state, token refresh, reconnect semantics, and audit history for the first-party integration set.
- This keeps the integration product model and the auth lifecycle under one control-plane authority.

Use this position in the spec:

- first-party managed outbound integrations should use the OAuth connected-accounts substrate described in `TODO_19_oauth_connected_accounts_substrate.md`
- the control plane remains the authority for integration state, settings, capability metadata, and policy
- hosted services remain acceptable fallback infrastructure for long-tail connectors if breadth later becomes more important than control

Alternatives:

- `Pipedream Connect` is acceptable if speed to broad catalog coverage becomes more important than architectural control.
- `Composio` is useful for chat-first connect experiences, but it is not the preferred substrate for managed Otto's workspace-owned lifecycle.
- `hosted Nango` remains an acceptable fallback for connectors whose auth shape fits it cleanly, but it is no longer the default recommendation.

## Data Model

Extend the current integration schema with provider-specific installations, capability definitions, settings, and custom integration manifests.

Core records should include:

- `tenant_integrations`
  This remains the canonical tenant and workspace connection state.
- provider-specific installation tables
  Example: `linear_installations`.
- `integration_oauth_connections`, `integration_oauth_credentials`, `integration_oauth_sessions`, and `integration_oauth_events`
  The shared OAuth connected-accounts substrate for first-party managed integrations.
- `integration_capability_definitions`
  Canonical capability metadata per provider.
- `tenant_integration_capability_states`
  Tenant-level enable, disable, or restrictions on capabilities.
- `tenant_integration_settings`
  Tenant-scoped safe and validated configuration.
- `custom_integrations`
  Registered manifests for runtime-local third-party integrations.

A conceptual schema shape:

```text
tenant_integrations
- tenant_id
- provider_key
- status
- install_state
- enabled
- connected_at
- last_error

linear_installations
- tenant_integration_id
- nango_connection_id
- linear_workspace_id
- linear_workspace_name
- scope_csv
- connected_by_user_id

integration_capability_definitions
- provider_key
- capability_key
- label
- description
- input_schema_json
- output_schema_json
- safety_class
- agent_manageable

tenant_integration_settings
- tenant_integration_id
- settings_json
- settings_version
- updated_by_type
- last_validation_error

custom_integrations
- tenant_integration_id
- manifest_json
- execution_mode
- health_status
```

## UI-Initiated Connect Flow

The workspace UI remains the baseline connection authority.

Each integration may and should have custom UI, closely co-located with its integration code, because each provider needs different explanations, warnings, and post-connect configuration.

The generic lifecycle is shared, but the product UI is provider-specific.

```text
1. User opens Workspace > Integrations > Linear
2. UI loads integration status from the control plane
3. User clicks Connect Linear
4. web creates a signed connect session
5. Browser is redirected to the provider consent flow
6. OAuth completes
7. web or worker records the connected installation
8. Control plane marks the integration connected and enabled
9. Runtime capability manifest now includes Linear
```

## Agent-Initiated Connect Flow

The agent can initiate the same connect lifecycle, but does not replace it.

```text
1. User asks Otto to use Linear
2. Runtime asks the control plane whether Linear is connected
3. Control plane says no
4. Runtime requests a connect intent
5. Control plane returns a workspace or connect URL
6. Otto asks the user to complete the connection
7. Browser completes consent
8. Control plane updates state
9. Otto resumes with the capability now available
```

This is a convenience layer on top of the same backend authority.

## Runtime Capability Injection

Managed Otto should add a new runtime plugin, `otto-integrations`, while keeping `otto-runtime-config` for now.

Near-term plugin split:

- `otto-runtime-config`
  Generic runtime config surfaces and lifecycle controls that already exist.
- `otto-integrations`
  Integration discovery, setup initiation, safe configuration, and execution.

Long-term direction:

- keep both for now
- once the model is proven, move Slack's runtime-facing integration surface into the `otto-integrations` family
- Slack transport and ingress remain control-plane-native even after runtime unification

## How Capabilities Register With The Runtime

Because we are choosing `one tool per integration`, the plugin will dynamically register one top-level tool for each enabled integration for the tenant.

Examples:

- `linear`
- `github`
- `notion`

Each integration tool exposes a set of operations and their input schemas.

Registration flow:

```text
1. Tenant runtime starts
2. otto-integrations plugin authenticates to the control plane
3. Plugin fetches the tenant integration manifest
4. Manifest includes enabled integrations and capability schemas
5. Plugin registers one tool per integration
6. The model sees those tools in the active runtime tool list
```

Conceptually:

```text
GET /api/internal/runtime/integrations

Response:
- integrations sorted deterministically
- each integration includes:
  - key
  - label
  - status
  - operations
  - input schemas
  - safe settings metadata
```

For Linear, the plugin would register a tool named `linear`. That tool would expose operations like:

- `search_issues`
- `get_issue`
- `create_issue`
- `add_comment`

The model learns the input shape from the runtime tool schema, not from prompt prose alone. The integration tool definition must therefore include operation-specific JSON schemas and examples.

## Prompt Caching Requirements

Plugin-injected tools do affect OpenClaw prompt caching.

OpenClaw includes active tool names in the prompt-sensitive path and explicitly treats tool definitions and capability ordering as cache-sensitive. The docs say the stable cache prefix includes tool definitions, and the runtime tracks tool digests for cache observability.

Therefore this is a hard requirement:

- We do not need cross-tenant prompt-cache sharing.
- We do need per-tenant prompt-cache stability.
- If the tenant's effective integration state is unchanged, the set of integration tools, their order, their names, and their schemas must remain byte-stable across runs.
- If the tenant changes integrations or settings in a way that changes the tool surface, a single cache bust is acceptable. The new tool surface must then stabilize again.

Implementation rules:

- sort integrations by stable key before tool registration
- sort operation definitions by stable key
- render schemas canonically and deterministically
- never rely on database insertion order or async completion order
- keep descriptions and examples stable unless the effective integration state changed

## Execution Path

The runtime never calls provider APIs directly for managed integrations.

Instead:

```text
runtime tool -> integration-gateway -> Otto OAuth credentials -> provider -> normalized result
```

Detailed flow:

```text
1. The model calls the `linear` tool
2. The otto-integrations plugin sends the request to integration-gateway
3. integration-gateway validates tenant, integration, operation, and policy
4. integration-gateway resolves the Otto-managed connected account
5. integration-gateway executes the request through the provider API
6. integration-gateway emits audit events
7. integration-gateway returns normalized output
8. Plugin returns the result to the model
```

This keeps raw provider credentials out of the runtime.

## Webhook Model

Webhooks should become part of the same integration architecture, not a separate subsystem.

Each integration may eventually declare:

- `outbound only`
- `inbound only`
- `hybrid`

Examples:

- Linear v1: outbound only
- Slack: hybrid
- GitHub later: hybrid
- Custom CRM integration later: hybrid

Over time, `integration-gateway` should also own:

- webhook ingress
- signature verification
- tenant routing
- event persistence
- enqueueing async follow-up jobs for `worker`

This means `Class C` integrations and webhook-driven integrations are the same conceptual family.

## Linear Example

Linear is the first recommended managed outbound integration.

Why:

- OAuth-based
- outbound only in v1
- clear read and write operations
- easy to explain to users
- no shared ingress requirements

Linear lifecycle:

```text
workspace connect -> provider consent -> Otto OAuth state -> runtime tool `linear`
```

Suggested Linear capabilities:

- `search_issues`
- `get_issue`
- `list_projects`
- `list_cycles`
- `create_issue`
- `add_comment`
- `update_issue_state`

Suggested safe settings:

- default team
- default project
- label mapping
- issue template defaults
- whether Otto may create issues directly or only draft

Suggested integration-linked skill:

- team and label conventions
- how to categorize bugs
- which project to use
- how to write issue titles

## Slack Example

Slack is different.

Slack remains a first-party control-plane-native integration because it needs:

- shared app lifecycle
- inbound routing
- shared ingress
- runtime projection
- directory sync
- reconnect and apply behavior

Slack should still be represented in the same conceptual integration framework:

- integration: `slack`
- capabilities: channel and message operations
- settings: safe runtime-facing configuration
- skill: optional workspace messaging guidance

But Slack should not move to Nango. The future migration is only about unifying the runtime-facing plugin surface, not the control-plane transport model.

## Custom Integration Example

Custom integrations are still integrations, not generic runtime automation.

A valid custom integration example is:

- a runtime-generated or runtime-installed connector to an external CRM
- backed internally by a local CLI, MCP server, or API bridge
- registered with the control plane as a workspace integration

A non-example is:

- a local script with no third-party app connection
- an arbitrary OpenClaw plugin
- a skill from ClawHub
- a generic local workflow

The user-facing model must remain:

- connect app
- inspect capabilities
- configure safe settings
- let Otto use it

Not:

- install a plugin
- install a skill
- configure OpenClaw internals

## How The Agent Can Self-Configure Integrations

The agent may be allowed to configure some integration settings, but not all.

Define three classes of settings:

- `Restricted`
  Credentials, connection ownership, elevated access rules, destructive policies, and approval requirements.
- `User-managed`
  Connect and disconnect, account selection, advanced policy, and sensitive configuration.
- `Agent-manageable`
  Safe defaults, label mappings, project or team preferences, non-sensitive behavior toggles, skill installation, and other reversible settings.

The agent must be able to:

- read available integrations
- read safe setting schemas
- validate a proposed settings change
- apply an allowed settings change
- initiate setup flows
- install or update associated skills when permitted

The agent must not be able to:

- modify raw credentials
- change elevated access restrictions
- bypass approval policies
- alter protected connection ownership

## Incremental Implementation Plan

Implement this as narrow vertical slices that produce a usable end-to-end outcome at each step. Avoid horizontal pushes such as "add all DB tables first" or "build the entire gateway first."

Each increment should be shippable to a dev environment, easy to validate manually, and small enough to keep regressions local.

### Increment 1: Tenant-scoped integration manifest with one fake integration

Build the smallest end-to-end capability injection path without OAuth, Nango, or provider traffic.

Scope:

- add a minimal control-plane integration registry path for one synthetic provider such as `demo-linear`
- add a tenant-scoped internal manifest endpoint that returns enabled integrations in deterministic order
- add the first `otto-integrations` runtime plugin
- register one tool per integration from the manifest
- keep execution stubbed with fixed responses

Why this comes first:

- it proves the runtime plugin contract
- it proves one-tool-per-integration registration
- it proves prompt-cache stability mechanics before real provider work

Acceptance criteria:

- a tenant with the synthetic integration enabled sees a corresponding runtime tool
- a tenant without it does not
- repeated runs for the same unchanged tenant produce the same tool names and ordering
- invoking the tool reaches the control plane and returns a stubbed result

### Increment 2: Stable execution path through `integration-gateway`

Replace the stubbed in-process execution path with the real dedicated service boundary, still without real OAuth.

Scope:

- add the `integration-gateway` service/container
- move runtime execution requests from `web` into `integration-gateway`
- define the runtime-to-gateway request and response contract
- keep the provider adapter stubbed, but emit audit records through the real path

Why this comes next:

- it locks the service boundary early
- it prevents later rewrites when real provider traffic arrives
- it keeps the first real vertical slice small

Acceptance criteria:

- runtime tool execution goes through `integration-gateway`, not `web`
- gateway validates tenant and integration identity
- gateway returns normalized stub responses
- gateway emits audit events or persisted audit rows for each execution

### Increment 3: Workspace-visible managed integration card for Linear

Introduce the first real product-facing integration shell in the workspace, but still without completing OAuth.

Scope:

- add a Linear integration page under workspace integrations
- show connected, disconnected, attention-needed, and disabled states from control-plane data
- define provider metadata, labels, descriptions, and capability inventory for Linear
- keep the connect action as a placeholder or disabled action if auth wiring is not yet present

Why this comes before OAuth:

- it lets product and UI settle without auth complexity
- it creates the provider-specific UI slot and metadata contract
- it keeps backend and frontend changes reviewable

Acceptance criteria:

- users can open a dedicated Linear integration page
- the page renders provider-specific copy and capability summary
- the page reads state from the same registry used by runtime capability injection

### Increment 4: First-party OAuth connect flow for Linear

Add the first real managed outbound integration connection path.

Scope:

- wire Otto-owned OAuth for Linear
- create signed connect intents in `web`
- persist the canonical Linear connection state in the control plane
- store the canonical OAuth connection plus provider-specific Linear installation metadata
- update the workspace UI after successful connect

Why this is a good first real integration step:

- Linear is outbound-only in v1
- it validates the shared OAuth connected-accounts substrate on a high-value first-party integration
- it proves the control plane remains the authority for auth state as well as integration state

Acceptance criteria:

- a user can connect Linear from the workspace UI
- the control plane stores canonical connection state, encrypted credentials, and Linear installation metadata
- the runtime manifest includes `linear` only after connection succeeds
- reconnecting updates the existing tenant integration instead of creating duplicates

### Increment 5: First real Linear read capability

Ship one useful, low-risk capability end to end.

Scope:

- implement `linear.search_issues`
- add provider adapter logic in `integration-gateway` that calls Linear through Otto-owned OAuth credentials
- normalize response payloads for the runtime
- keep the tool schema and ordering deterministic

Why this should be isolated:

- read-only operations are lower risk
- they validate the provider adapter contract before write behavior is added
- they give an immediate product win

Acceptance criteria:

- the `linear` runtime tool can execute `search_issues`
- requests flow runtime -> integration-gateway -> Otto OAuth credentials -> Linear
- results come back normalized and usable by the model
- failed auth produces a clear `attention needed` path instead of opaque provider errors

### Increment 6: Agent-initiated connect for Linear

Layer Otto-initiated setup on top of the existing UI flow instead of inventing a second authority.

Scope:

- add a runtime-visible way to detect that Linear is not connected
- add a control-plane endpoint that creates a connect intent for the current tenant
- let the runtime plugin surface a setup response that points the user back into the workspace flow

Why this is separate:

- it is product behavior, not infrastructure
- it should build on the already-working UI connect path

Acceptance criteria:

- Otto can detect a missing Linear connection
- Otto can return a workspace connect link for the tenant
- after the user completes connect, the runtime manifest refresh makes Linear available

### Increment 7: Safe Linear settings with validation

Allow Otto and users to configure non-sensitive integration behavior.

Scope:

- add provider-specific safe settings for Linear
- add validation and apply endpoints
- classify settings into restricted, user-managed, and agent-manageable
- expose those settings in the workspace UI and to the runtime plugin

Suggested initial safe settings:

- default team
- default project
- label mapping
- issue creation mode such as draft-only vs direct-create

Acceptance criteria:

- workspace users can edit safe Linear settings
- Otto can read safe settings metadata
- Otto can validate and apply only agent-manageable settings
- restricted settings remain blocked from the runtime path

### Increment 8: First Linear write capability

After the settings model exists, add one write operation that benefits from those defaults.

Scope:

- implement `linear.create_issue`
- enforce settings and policy at `integration-gateway`
- audit the mutation path

Why after settings:

- write actions need stronger defaults and policy boundaries
- this keeps the read and write rollout separate

Acceptance criteria:

- Otto can create a Linear issue using configured defaults
- audit records capture actor, capability, and result
- policy violations fail clearly

### Increment 9: Integration-linked skill projection

Add optional business guidance without making skills the integration mechanism.

Scope:

- allow an integration to project associated skill content into the runtime or managed workspace files
- support a first Linear-linked skill template
- keep this optional and non-blocking for integration functionality

Acceptance criteria:

- a connected Linear integration can optionally project a Linear-specific skill
- the skill can describe business conventions such as labels, team ownership, and project rules
- removing or changing the skill does not break the underlying integration

### Increment 10: Hybrid integration foundation for webhook-capable providers

Extend the shared model so webhook-driven integrations fit cleanly into the same system.

Scope:

- add integration transport metadata for outbound-only, inbound-only, and hybrid integrations
- add webhook ingress ownership to `integration-gateway`
- persist and route webhook events through the shared integration model

Why this should wait:

- it is not required to prove the outbound managed model
- it becomes much easier once the shared registry and gateway already exist

Acceptance criteria:

- the integration model can describe hybrid providers
- webhook ingress uses the same tenant integration registry and audit model
- inbound events can be persisted and handed off to `worker`

### Increment 11: Slack runtime-surface migration

Unify the runtime-facing integration model without changing Slack's control-plane-native transport.

Scope:

- keep Slack OAuth, ingress, and routing control-plane-native
- move Slack's runtime-facing read and safe-configure surface into `otto-integrations`
- keep `otto-runtime-config` in place for non-integration surfaces

Acceptance criteria:

- Slack appears through the same runtime integration plugin family as Linear
- Slack transport architecture remains unchanged
- the runtime-facing integration model is more unified than before

### Increment 12: Custom integration registration

Support long-tail third-party integrations without exposing OpenClaw primitives to the user.

Scope:

- add control-plane registration for custom third-party integrations
- require a manifest that declares provider purpose, capabilities, execution mode, and health
- allow runtime-local implementations such as CLI, MCP, or local bridge behind the manifest

Acceptance criteria:

- a custom third-party integration can appear in the workspace UI
- Otto can inspect its declared capabilities
- the user is not exposed to raw plugin, skill, or ClawHub concepts

## Suggested Delivery Order

If implementation begins immediately, the recommended first four increments are:

1. Increment 1: tenant-scoped manifest plus synthetic integration
2. Increment 2: real `integration-gateway` execution boundary
3. Increment 3: workspace-visible Linear shell
4. Increment 4: first-party OAuth connect flow for Linear

That sequence gives a real vertical line quickly without prematurely committing to a broad schema or webhook buildout.

This is the clarified target architecture and should replace the earlier, less precise wording.
