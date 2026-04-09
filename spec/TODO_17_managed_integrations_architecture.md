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
- Runtime injection should use a fixed `otto-integrations` metatool plugin, not one dynamic top-level tool per integration.
- The metatool surface should include installed-integration listing, catalog listing, integration detail/status reads, execution, and connection-management primitives.
- Tool registration should remain static and image-backed so prompt caching stays stable while tenant integration state changes behind the discovery layer.
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
- `Capability`: a runtime-callable command exposed by that integration.
- `Skill`: text-based business guidance that may depend on one or more integrations.

Examples:

- Linear is an `integration`.
- `issue.search` and `issue.create` are `capabilities`.
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

Extend the current integration schema with generic tenant integration records, shared OAuth state, optional generic settings/state blobs, and custom integration manifests. Provider-specific tables should be the exception, not the default.

Core records should include:

- `tenant_integrations`
  This remains the canonical tenant and workspace connection state.
- `integration_oauth_connections`, `integration_oauth_credentials`, `integration_oauth_sessions`, and `integration_oauth_events`
  The shared OAuth connected-accounts substrate for first-party managed integrations.
- `tenant_integration_settings`
  Tenant-scoped safe and validated configuration.
- `tenant_integration_state`
  Optional provider-specific durable state stored generically as JSON, used when provider-specific relational tables are not justified.
- `integration_capability_definitions`
  Canonical capability metadata per provider.
- `tenant_integration_capability_states`
  Tenant-level enable, disable, or restrictions on capabilities.
- `custom_integrations`
  Registered manifests for runtime-local third-party integrations.

A conceptual schema shape:

```text
tenant_integrations
- tenant_id
- provider_key
- status
- connected_at
- disconnected_at
- last_error
- last_error_at

tenant_integration_settings
- tenant_integration_id
- settings_json
- settings_version
- updated_by_type
- last_validation_error

tenant_integration_state
- tenant_integration_id
- state_json
- state_version
- updated_at

integration_capability_definitions
- provider_key
- capability_key
- label
- description
- input_schema_json
- output_schema_json
- safety_class
- agent_manageable

custom_integrations
- tenant_integration_id
- manifest_json
- execution_mode
- health_status
```

Concrete direction:

- `linear` should not need its own installation table by default.
- `slack` and `whatsapp` can keep provider-specific tables where they back real directory caches, link sessions, or other query-heavy state.
- New integrations should normally add code registry entries, not tables.
- Discovery should be first-class in the runtime plugin contract:
  - agents should be able to search for the best integration command from user intent before guessing an integration/command pair
  - integration detail responses should include exact execution guides and example calls, not only raw parameter schemas
  - the plugin-level metatool contract should explicitly teach the discovery -> inspect -> connect -> execute workflow

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
9. Runtime integration discovery and status now reflect Linear as connected
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

A fixed metatool surface should be registered statically by the runtime plugin. Tenant-specific integration state should come from control-plane discovery at execution time, not from a projected manifest in `openclaw.json`.

The implementation should now use an explicit internal integration framework under `web/src/integrations/`, with a strict split between framework code and provider code:

- `web/src/integrations/framework`
  Registry, manifest generation, execution dispatch, OAuth resolution hooks, and shared types.
- `web/src/integrations/library/<provider>`
  Provider-owned metadata, OAuth binding, runtime operations, normalization, and UI bindings.

For example:

```text
web/src/integrations/
  framework/
    registry.ts
    manifest.ts
    execute.ts
    types.ts
  library/
    linear/
      definition.ts
      oauth/
        provider.ts
      runtime/
        execute.ts
        operations/
          search-issues.ts
```

This is an internal framework approach, not just a loose helper library.

The framework owns:

- one canonical integration registry
- one execution contract
- one way to advertise schemas and capabilities back to Otto
- one place to integrate with the OAuth substrate

Each provider module plugs into that framework by exporting one canonical definition object.

Conceptually:

```text
IntegrationDefinition
- key
- label
- category metadata
- workspace visibility metadata
- agent capability metadata
- runtime command groups, commands, and schemas
- optional OAuth binding
- provider execute handler
```

The registry should be the single source of truth for:

- workspace catalog visibility
- runtime manifest generation
- per-integration detail and status responses
- provider OAuth registration
- execution dispatch

This replaces the older split where catalog metadata, runtime manifest metadata, and OAuth provider registration lived in separate parallel registries.

Suggested metatools:

- `find_integration_commands`
  Semantic discovery for the best installed or available commands for a user request.
- `list_integrations`
  Deterministic workspace inventory, with `scope=installed` by default and optional `available` / `all`.
- `get_integration`
  Summary-only read for one integration, including top-level command groups and root commands.
- `get_integration_details`
  Full detail for one command group or one command, including schema, usage notes, and example calls.
- `execute_integration_command`
  Execute one integration command through Otto.
- `manage_integration`
  Initiate connect, reconnect, disconnect, or account-selection flows.

Near-term v1 behavior:

- `manage_integration` may initially return workspace URLs, connect URLs, and a recommended next action instead of performing every lifecycle mutation directly from the runtime.
- That still satisfies the product goal as long as Otto can move the user into the real workspace-owned connect or reconnect flow without guessing URLs.

Registration flow:

```text
1. Tenant runtime starts
2. otto-integrations plugin registers a fixed metatool set from its static plugin contract
3. The model sees those metatools in the active runtime tool list
4. When the model needs integration context, the plugin authenticates to the control plane
5. The model uses `find_integration_commands` or `list_integrations` to narrow the target
6. The control plane reads from the canonical integration registry plus tenant state
7. The control plane returns summary-only integration reads or one targeted command/group detail dynamically
8. The plugin executes integration commands through Otto's runtime execution path
```

Control-plane structure:

```text
agent
  -> execute_integration_command("linear", "issue.search", args)
  -> otto-integrations metatool
  -> control-plane execute route
  -> integrations/framework/registry.ts resolves "linear"
  -> integrations/framework/execute.ts resolves auth + dispatches command
  -> integrations/library/linear/commands/... calls Linear
  -> normalized result returns to Otto
```

Conceptually:

```text
GET /api/internal/runtime/integrations

Response:
- integrations sorted deterministically for the requested scope
- each entry includes:
  - key
  - label
  - status
  - installed / available flags
  - top-level command-group summaries
  - root-command summaries
```

```text
GET /api/internal/runtime/integrations/:key

Response:
- one integration
- summary only
- current status
- top-level command groups
- root commands
```

```text
POST /api/internal/runtime/integrations/:key/details

Response:
- one command group or one command
- full arguments schema when detailType=command
- usage notes
- example call
```

For Linear, `get_integration("linear")` returns top-level groups such as:

- `workspace`
- `issue`

Then `get_integration_details("linear", "command_group", "issue")` would return commands such as:

- `issue.search`
- `issue.get`
- `issue.list`
- `create_issue`
- `add_comment`
- `update_issue_state`

The model learns the input shape by calling the metatools, not by receiving tenant-specific top-level runtime tools.

The important schema rule is:

- static metatool schemas are advertised directly by the runtime plugin
- provider command schemas are advertised dynamically in metatool responses such as `get_integration_details("linear", "command", "issue.search")`
- Otto should never receive one dynamic top-level runtime tool per provider command

So the schema flow should be:

```text
runtime startup
  -> static metatools registered
  -> model sees those schemas

model needs Linear details
  -> get_integration("linear")
  -> response includes group summaries + root command summaries
  -> get_integration_details("linear", "command", "issue.search")
  -> response includes command schema + example call
  -> model calls execute_integration_command(...)
```

This keeps prompt caching stable while still letting Otto discover the exact provider-specific input shape at runtime.

## OAuth Substrate Integration

The integration framework should treat OAuth as a shared substrate, not something each provider re-invents inside each command handler.

Provider definitions may declare an OAuth binding:

```text
integration registry entry
  -> says "linear uses oauth provider linear"
  -> framework resolves current tenant connection + token
  -> provider runtime handler receives authenticated context
```

The execution layering should be:

```text
framework
  -> looks up provider definition
  -> checks whether OAuth is required
  -> resolves connected account from the shared substrate
  -> passes authenticated context into provider execution

provider module
  -> never queries OAuth tables directly during normal execution
  -> receives auth context and calls the provider API
```

That means:

- `TODO_19` remains the owner of OAuth session state, token storage, refresh, reconnect, and durable failure state
- `TODO_17` remains the owner of integration registration, schema advertising, discovery, and execution dispatch
- provider modules should consume OAuth through framework context instead of reaching deep into the DB layer directly

## Prompt Caching Requirements

Plugin-injected tools do affect OpenClaw prompt caching.

OpenClaw includes active tool names in the prompt-sensitive path and explicitly treats tool definitions and capability ordering as cache-sensitive. The docs say the stable cache prefix includes tool definitions, and the runtime tracks tool digests for cache observability.

Therefore this is a hard requirement:

- We do not need cross-tenant prompt-cache sharing.
- We do need a stable runtime tool registry.
- The set of metatools, their order, their names, and their schemas must remain byte-stable across runs.
- Dynamic integration state should live in tool responses and lightweight runtime hints, not in dynamically registered tool definitions.
- If we project installed-integration hints into prompts or managed files, those hints must be deterministically ordered and rendered canonically.

Implementation rules:

- keep the metatool registry static
- sort integrations and commands by stable key in control-plane responses
- render schemas canonically and deterministically
- never rely on database insertion order or async completion order
- keep prompt hints stable unless the effective integration state changed

## Execution Path

The runtime never calls provider APIs directly for managed integrations.

Instead:

```text
runtime metatool -> integration-gateway -> Otto OAuth credentials -> provider -> normalized result
```

Detailed flow:

```text
1. The model calls `execute_integration_command`
2. The otto-integrations plugin sends the request to integration-gateway with integration key and command key
3. integration-gateway validates tenant, integration, command, and policy
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

## Full Webhook Support

The long-term direction should treat inbound webhook transport as a first-class part of the managed integrations framework, not a one-off Slack subsystem.

The immediate implementation scope should stay narrower:

- build only what Slack needs right now
- keep the current shared Slack ingress behavior working
- shape the implementation so additional webhook-capable providers can later reuse the same framework hooks

The design goal is to avoid two bad outcomes:

- baking more Slack-only control-plane routes and metadata into unrelated parts of the app
- prematurely forcing every future provider into one identical single-endpoint webhook abstraction

### Framework model

Each integration definition may eventually declare optional inbound transport metadata in addition to OAuth, commands, settings, and lifecycle.

That inbound transport model should support:

- one or more provider-owned inbound endpoints per integration
- provider-specific request parsing and verification
- tenant resolution through the shared tenant integration registry
- persisted ingress deliveries and errors
- handoff to the existing async execution and worker path where needed

The framework should describe inbound endpoint ownership with explicit setup modes:

- `platform_managed`
  - configured once by the control plane for one shared provider app or shared provider account
  - example: the shared Slack app used by every Otto workspace
- `provider_managed`
  - configured by the control plane through the provider API, usually per tenant, account, project, repo, or similar external resource
  - example: a future GitHub or Jira webhook created by the control plane during connect/setup
- `workspace_managed`
  - owned entirely inside Otto-managed infrastructure, with no external provider-side registration step
- `manual`
  - the control plane exposes the endpoint and setup instructions, but a human must register it in the external provider UI

### Slack-first implementation boundary

Slack should be the first provider implemented in this model, but only to the extent needed by the current shared Slack app architecture.

For Slack specifically:

- inbound transport is `platform_managed`
- the control plane owns the shared Slack app webhook configuration once for the whole product
- individual workspaces connect to the shared Slack app, but do not configure inbound Slack webhooks themselves
- tenant runtimes continue to receive forwarded Slack traffic and do not own provider-side webhook registration

That means the workspace should not present Slack webhook setup as a per-workspace manual configuration task.

Instead, the Slack integration should eventually surface read-only ingress health and setup state such as:

- shared app ingress is active
- last successful delivery
- last delivery error
- whether reconnect is needed for the workspace connection

### Route shape

The long-term public route family should be framework-owned and provider-keyed, for example:

- `/api/webhooks/integrations/[provider]/[endpointKey]`

For Slack this would map to:

- `/api/webhooks/integrations/slack/events`
- `/api/webhooks/integrations/slack/commands`
- `/api/webhooks/integrations/slack/interactivity`

During migration, keep the current public Slack routes as compatibility wrappers:

- `/api/integrations/slack/events`
- `/api/integrations/slack/commands`
- `/api/integrations/slack/interactivity`

Those wrappers should call the same provider-owned ingress handler, not maintain a separate Slack-only control-plane code path indefinitely.

### Provider ownership

The generic framework should own routing and registration concepts, but provider-specific inbound behavior should live under the provider library.

For Slack, that means moving toward provider-owned modules under `web/src/integrations/library/slack` for:

- endpoint definitions
- request parsing
- signature verification behavior
- team/workspace resolution helpers
- direct challenge or `ssl_check` responses
- forwarded header construction
- setup and health copy shown in the workspace UI

The route handlers themselves can remain in Next.js route files, but they should become thin wrappers around provider-owned framework helpers.

### Persistence and operations

Slack already persists ingress audit rows in `slack_ingress_deliveries`.

That should remain the current implementation for the Slack slice, but the framework direction should be:

- start from the current Slack delivery audit model
- keep new Slack work compatible with a later generic `integration_ingress_deliveries` model
- avoid baking Slack-specific assumptions into higher-level framework interfaces

If later providers need dynamic inbound registrations, the control plane should also persist per-registration state such as:

- tenant integration ownership
- endpoint key
- registration mode
- verification material or provider webhook id when relevant
- active or degraded status
- last success and last error

This does not require generic user-authored webhook logic yet. For the current phase, provider-owned behavior remains the correct model.

### Near-term acceptance criteria

The Slack-only implementation should count as aligned with the full webhook direction if it does all of the following:

- keeps Slack ingress control-plane-native
- keeps Slack on the existing shared-app routing model by `team_id`
- moves provider-owned ingress logic toward `web/src/integrations/library/slack`
- preserves compatibility with the current public Slack endpoints during migration
- leaves a clear route to a framework-owned provider-keyed webhook family later
- avoids introducing new Slack-only ingress concepts outside the integration framework unless they are strictly transport shims

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
workspace connect -> provider consent -> Otto OAuth state -> runtime metatools discover and execute Linear
```

Suggested Linear capabilities:

- `workspace.get_viewer`
- `workspace.list_teams`
- `workspace.list_users`
- `workspace.list_workflow_states`
- `issue.search`
- `issue.get`
- `issue.list`
- `issue.create`
- `comment.create`

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

### Linear Coverage Tracker

Build Linear object first, not schema first.

Rules:

- keep `linear` as one integration
- keep one shared execution surface
- organize commands by object group such as `workspace`, `issue`, or `project`
- prefer curated business objects over full GraphQL parity
- isolate file upload under `attachment.*`
- defer raw binary download until there is a concrete agent use case

Current shipped Linear commands:

- `workspace.get_viewer`
- `workspace.get_organization`
- `workspace.list_teams`
- `workspace.list_users`
- `workspace.list_workflow_states`
- `workspace.list_project_statuses`
- `team.list`
- `team.get`
- `team.create`
- `team.update`
- `team.delete`
- `team.unarchive`
- `team.members_add`
- `team.members_update`
- `team.members_remove`
- `team.list_cycles`
- `team.list_workflow_states`
- `team.list_labels`
- `team.list_projects`
- `team.list_issues`
- `workspace_member.invite`
- `workspace_member.invite_update`
- `workspace_member.invite_cancel`
- `workspace_member.invite_resend`
- `workspace_member.update`
- `issue.list`
- `issue.get`
- `issue.search`
- `issue.create`
- `issue.update`
- `issue.delete`
- `issue.archive`
- `issue.batch_update`
- `issue.list_comments`
- `issue.list_attachments`
- `issue.list_documents`
- `issue.list_relations`
- `issue.add_label`
- `issue.remove_label`
- `comment.list`
- `comment.get`
- `comment.create`
- `comment.update`
- `comment.delete`
- `project.list`
- `project.get`
- `project.search`
- `project.create`
- `project.update`
- `project.delete`
- `project.archive`
- `project.list_issues`
- `project.list_updates`
- `project.create_update`
- `project.list_documents`
- `project.list_milestones`
- `project.list_labels`
- `document.list`
- `document.get`
- `document.search`
- `document.create`
- `document.update`
- `document.delete`
- `label.list_issue_labels`
- `label.get_issue_label`
- `label.create_issue_label`
- `label.update_issue_label`
- `label.delete_issue_label`
- `label.restore_issue_label`
- `label.retire_issue_label`
- `label.list_project_labels`
- `label.get_project_label`
- `label.create_project_label`
- `label.update_project_label`
- `label.delete_project_label`
- `label.restore_project_label`
- `label.retire_project_label`
- `project_milestone.list`
- `project_milestone.get`
- `project_milestone.create`
- `project_milestone.update`
- `project_milestone.delete`
- `project_milestone.move`
- `project_status.list`
- `project_status.get`
- `project_status.create`
- `project_status.update`
- `initiative.list`
- `initiative.get`
- `initiative.create`
- `initiative.update`
- `initiative.create_update`
- `initiative.delete`
- `initiative.archive`
- `initiative.list_projects`
- `initiative.list_updates`
- `customer.list`
- `customer.get`
- `customer.create`
- `customer.update`
- `customer.delete`
- `customer.list_needs`
- `customer_need.list`
- `customer_need.get`
- `customer_need.create`
- `customer_need.create_from_attachment`
- `customer_need.update`
- `customer_need.archive`
- `customer_need.unarchive`
- `customer_need.delete`
- `customer_status.list`
- `customer_status.get`
- `customer_status.create`
- `customer_status.update`
- `customer_status.delete`
- `customer_tier.list`
- `customer_tier.get`
- `customer_tier.create`
- `customer_tier.update`
- `customer_tier.delete`

Recommended implementation order:

1. `workspace`
2. `issue`
3. `comment`
4. `project`
5. `cycle`
6. `team`
7. `attachment`
8. `document`
9. `label`
10. `project_milestone`
11. `project_status`
12. `initiative`
13. `customer`
14. `customer_need`
15. `customer_status`
16. `customer_tier`

Tracker:

- `workspace`
  - `[x]` `workspace.get_viewer`
  - `[x]` `workspace.list_teams`
  - `[x]` `workspace.list_users`
  - `[x]` `workspace.list_workflow_states`
  - `[x]` `workspace.get_organization`
  - `[x]` `workspace.list_project_statuses`
  - `[ ]` `workspace.search_issues`
  - `[ ]` `workspace.search_projects`
  - `[ ]` `workspace.search_documents`

- `issue`
  - `[x]` `issue.list`
  - `[x]` `issue.get`
  - `[x]` `issue.search`
  - `[x]` `issue.create`
  - `[x]` `issue.update`
  - `[x]` `issue.delete`
  - `[x]` `issue.insert_inline_image`
  - `[x]` `issue.upload_inline_image`
  - `[x]` `issue.archive`
  - `[x]` `issue.batch_update`
  - `[x]` `issue.list_comments`
  - `[x]` `issue.list_attachments`
  - `[x]` `issue.list_documents`
  - `[x]` `issue.list_relations`
  - `[x]` `issue.add_label`
  - `[x]` `issue.remove_label`

- `comment`
  - `[x]` `comment.list`
  - `[x]` `comment.get`
  - `[x]` `comment.create`
  - `[x]` `comment.update`
  - `[x]` `comment.delete`

- `project`
  - `[x]` `project.list`
  - `[x]` `project.get`
  - `[x]` `project.search`
  - `[x]` `project.create`
  - `[x]` `project.update`
  - `[x]` `project.delete`
  - `[x]` `project.archive`
  - `[x]` `project.list_issues`
  - `[x]` `project.list_updates`
  - `[x]` `project.create_update`
  - `[x]` `project.list_documents`
  - `[x]` `project.list_milestones`
  - `[x]` `project.list_labels`

- `cycle`
  - `[x]` `cycle.list`
  - `[x]` `cycle.get`
  - `[x]` `cycle.create`
  - `[x]` `cycle.update`
  - `[x]` `cycle.archive`
  - `[x]` `cycle.list_issues`

- `team`
  - `[x]` `team.list`
  - `[x]` `team.get`
  - `[x]` `team.create`
  - `[x]` `team.update`
  - `[x]` `team.delete`
  - `[x]` `team.unarchive`
  - `[x]` `team.members_add`
  - `[x]` `team.members_update`
  - `[x]` `team.members_remove`
  - `[x]` `team.list_cycles`
  - `[x]` `team.list_workflow_states`
  - `[x]` `team.list_labels`
  - `[x]` `team.list_projects`
  - `[x]` `team.list_issues`
  - Later testing plan:
    - verify `team.list` returns all accessible teams with stable key/id/displayName metadata
    - verify `team.get` by both team key and canonical team id
    - verify `team.list_cycles` against a team with an active cycle and one with historical cycles only
    - verify `team.list_workflow_states` against a team with inherited and custom workflow states
    - verify `team.list_labels` against a team with active and retired issue labels
    - verify `team.list_projects` against a team with multiple projects in different statuses
    - verify `team.list_issues` against a team with active backlog and completed work
    - verify `team.create` and `team.update` in a workspace where the connected Linear actor has sufficient team-management permissions

- `workspace_member`
  - `[x]` `workspace_member.invite`
  - `[x]` `workspace_member.invite_update`
  - `[x]` `workspace_member.invite_cancel`
  - `[x]` `workspace_member.invite_resend`
  - `[x]` `workspace_member.update`
  - Later testing plan:
    - verify workspace-member invite create/update/cancel/resend against a pending invite that includes explicit `teamIds`
    - verify workspace-member update against an accepted human user with mutable profile fields such as display name, status label, and timezone
    - verify invite resend works by both canonical invite id and raw invite email address

- `user`
  - `[x]` `user.get`
  - `[x]` `user.list`
  - `[x]` `user.list_assigned_issues`
  - `[x]` `user.list_created_issues`
  - `[x]` `user.list_team_memberships`
  - Later testing plan:
    - use `workspace.list_users` to fetch canonical user ids for live smoke tests
    - verify `user.get` against one active human user and one app user if available
    - verify `user.list` includes normalized display-name fallbacks when `name` is blank
    - verify `user.list_assigned_issues` against a user with active workload and a user with zero assigned issues
    - verify `user.list_created_issues` against a user who has opened issues recently
    - verify `user.list_team_memberships` against a user who belongs to multiple teams and confirm owner flags map correctly

- `attachment`
  - `[x]` `attachment.list`
  - `[x]` `attachment.get`
  - `[x]` `attachment.list_for_url`
  - `[x]` `attachment.request_upload_url`
  - `[x]` `attachment.upload_file`
  - `[x]` `attachment.create`
  - `[x]` `attachment.create_from_uploaded_file`
  - `[x]` `attachment.update`
  - Later testing plan:
    - verify `attachment.list` against a workspace with a mix of rich external links and uploaded assets
    - verify `attachment.get` on one attachment linked to an issue and one moved attachment with `originalIssue` populated
    - verify `attachment.list_for_url` returns all issue links for the same external URL
    - verify `attachment.request_upload_url` returns usable signed upload metadata, then complete the signed upload and follow with `attachment.create_from_uploaded_file`
    - verify `attachment.upload_file` performs the full server-side upload and attachment-create flow without requiring a separate follow-up command
    - verify `attachment.create` against both a fresh external URL and a repeated URL to confirm Linear updates the existing attachment record
    - verify `attachment.update` for title, subtitle, icon, and metadata changes on an existing attachment

- `document`
  - `[x]` `document.list`
  - `[x]` `document.get`
  - `[x]` `document.search`
  - `[x]` `document.create`
  - `[x]` `document.update`
  - `[x]` `document.delete`
  - Later testing plan:
    - verify `document.list` against a workspace with both project-linked and issue-linked documents
    - verify `document.get` on a document that has creator, updatedBy, project, issue, and team associations populated
    - verify `document.search` returns relevant matches for title-only and content-only terms
    - verify `document.create` with only `title`, then again with project/team linkage and markdown content
    - verify `document.update` for title/content edits plus toggling `trashed` and changing linked project or issue context
    - verify `document.delete` removes a document from follow-up list/get calls and returns the deleted document id

- `label`
  - `[x]` `label.list_issue_labels`
  - `[x]` `label.get_issue_label`
  - `[x]` `label.create_issue_label`
  - `[x]` `label.update_issue_label`
  - `[x]` `label.delete_issue_label`
  - `[x]` `label.restore_issue_label`
  - `[x]` `label.retire_issue_label`
  - `[x]` `label.list_project_labels`
  - `[x]` `label.get_project_label`
  - `[x]` `label.create_project_label`
  - `[x]` `label.update_project_label`
  - `[x]` `label.delete_project_label`
  - `[x]` `label.restore_project_label`
  - `[x]` `label.retire_project_label`
  - Later testing plan:
    - verify issue-label list/get on both workspace-level and team-level issue labels
    - verify issue-label create/update with `replaceTeamLabels=true` against a workspace that already has matching team labels
    - verify issue-label delete/restore/retire transitions and confirm the returned label state changes as expected
    - verify project-label list/get against a workspace with grouped project labels
    - verify project-label create/update/delete/restore/retire against at least one active project label and one archived/retired label

- `project_milestone`
  - `[x]` `project_milestone.list`
  - `[x]` `project_milestone.get`
  - `[x]` `project_milestone.create`
  - `[x]` `project_milestone.update`
  - `[x]` `project_milestone.delete`
  - `[x]` `project_milestone.move`
  - Later testing plan:
    - verify milestone list/get against a project with multiple milestones in different statuses
    - verify milestone create/update for description, target date, and sort-order changes
    - verify milestone delete returns the deleted milestone id and removes it from subsequent list calls
    - verify milestone move across projects, including one case that requires `addIssueTeamToProject` or `newIssueTeamId`

- `project_status`
  - `[x]` `project_status.list`
  - `[x]` `project_status.get`
  - `[x]` `project_status.create`
  - `[x]` `project_status.update`
  - Later testing plan:
    - verify status list/get against a workspace with custom project statuses beyond the defaults
    - verify status create with each relevant `ProjectStatusType` used in the workspace flow
    - verify status update for color, position, and `indefinite` transitions

- `initiative`
  - `[x]` `initiative.list`
  - `[x]` `initiative.get`
  - `[x]` `initiative.create`
  - `[x]` `initiative.update`
  - `[x]` `initiative.create_update`
  - `[x]` `initiative.delete`
  - `[x]` `initiative.archive`
  - `[x]` `initiative.list_projects`
  - `[x]` `initiative.list_updates`
  - Later testing plan:
    - verify initiative list/get against a workspace with multiple active and completed initiatives
    - verify initiative create/update for owner, status, target date, and markdown content changes
    - verify initiative create_update against an initiative with historical updates and check returned health/diff metadata
    - verify initiative delete returns the deleted initiative id and removes it from subsequent list calls
    - verify initiative archive removes the initiative from normal active planning views
    - verify initiative list_projects against an initiative linked to multiple projects
    - verify initiative list_updates against an initiative with multiple historical updates and different health states

- `customer`
  - `[x]` `customer.list`
  - `[x]` `customer.get`
  - `[x]` `customer.create`
  - `[x]` `customer.update`
  - `[x]` `customer.delete`
  - `[x]` `customer.list_needs`
  - Later testing plan:
    - verify customer list/get against a workspace with customers spanning different statuses and tiers
    - verify customer create/update for domain arrays, external ids, owner, status, tier, revenue, and size changes
    - verify customer delete returns the deleted customer id and removes it from subsequent list/get calls
    - verify customer list_needs against a customer with multiple linked needs across issues and projects

- `customer_need`
  - `[x]` `customer_need.list`
  - `[x]` `customer_need.get`
  - `[x]` `customer_need.create`
  - `[x]` `customer_need.create_from_attachment`
  - `[x]` `customer_need.update`
  - `[x]` `customer_need.archive`
  - `[x]` `customer_need.unarchive`
  - `[x]` `customer_need.delete`
  - Later testing plan:
    - verify customer-need list/get against a workspace with active and archived customer needs
    - verify customer-need create/update for customer, issue, project, and attachment linkage plus priority propagation
    - verify customer-need create_from_attachment against a real existing Linear attachment
    - verify customer-need archive/unarchive transitions and confirm archived needs only appear when explicitly requested
    - verify customer-need delete with both `keepAttachment=true` and `keepAttachment=false`

- `customer_status`
  - `[x]` `customer_status.list`
  - `[x]` `customer_status.get`
  - `[x]` `customer_status.create`
  - `[x]` `customer_status.update`
  - `[x]` `customer_status.delete`
  - Later testing plan:
    - verify customer-status list/get against a workspace with multiple custom customer-flow states
    - verify customer-status create/update for color, displayName, and position changes
    - verify customer-status delete succeeds only after the status is no longer referenced by active customers

- `customer_tier`
  - `[x]` `customer_tier.list`
  - `[x]` `customer_tier.get`
  - `[x]` `customer_tier.create`
  - `[x]` `customer_tier.update`
  - `[x]` `customer_tier.delete`
  - Later testing plan:
    - verify customer-tier list/get against a workspace with multiple account tiers
    - verify customer-tier create/update for color, displayName, and position changes
    - verify customer-tier delete succeeds only after the tier is no longer referenced by active customers

Immediate next recommended slice:

- Linear command coverage is complete through the post-coverage cleanup slice, including team membership management, workspace-member invite/update flows, and delete coverage for issue, project, document, initiative, and customer.
- next recommended work:
  - `Increment 7: Capability policy, capability inventory UI, and gateway enforcement`
  - `Increment 8: First Linear write capability` is already satisfied by the current `issue.create` path through `integration-gateway`; the remaining policy/defaults work now belongs under Increment 7
  - then `Increment 9: Integration-linked skill projection`

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

### Increment 1: Static metatool plugin with one real integration

Build the smallest end-to-end capability injection path with a narrow real provider slice instead of a synthetic placeholder.

Scope:

- add a minimal control-plane integration registry path for one real provider such as `linear`
- add tenant-scoped internal routes for scoped integration inventory, one-integration summary, and one targeted command/group detail in deterministic order
- add the first `otto-integrations` runtime plugin
- register a fixed metatool set from the plugin contract
- keep the first executable surface intentionally narrow, such as `issue.search`

Why this comes first:

- it proves the runtime plugin contract
- it proves control-plane-backed discovery without poisoning tenant config
- it proves prompt-cache stability mechanics without needing a synthetic provider that later has to be removed

Acceptance criteria:

- the runtime always exposes the same metatools
- `list_integrations(scope=installed)` returns only integrations installed for the tenant
- `list_integrations(scope=available)` returns the full supported set in deterministic order
- `get_integration` returns summary metadata for one integration without dumping every command schema
- `get_integration_details` returns one command group or one command schema on demand
- invoking `execute_integration_command` reaches the control plane and returns a real result for the narrow shipped command

### Increment 2: Stable execution path through `integration-gateway`

Extract the runtime execute path into a real dedicated service boundary while leaving discovery and status reads in `web` for now.

Scope:

- add the `integration-gateway` service/container
- move runtime execution requests from `web` into `integration-gateway`
- define the runtime-to-gateway request and response contract
- route the existing shipped provider operations through the gateway first
- emit audit records through the real path

Why this comes next:

- it locks the service boundary early
- it prevents later rewrites when real provider traffic arrives
- it keeps the first real vertical slice small

Acceptance criteria:

- runtime tool execution goes through `integration-gateway`, not `web`
- gateway validates tenant and integration identity
- gateway returns normalized responses for the shipped operations
- gateway emits audit events or persisted audit rows for each execution

### Increment 3: Workspace-visible managed integration card for Linear

Introduce the first real product-facing integration shell in the workspace, but still without completing OAuth.

Status:

- done on `main`
- the canonical Linear workspace surface now lives under `/integrations2`
- the legacy `/integrations` page no longer carries Linear

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

Status:

- done on `main` for Linear
- no additional substrate expansion is recommended until the next provider proves a real gap
- future rollout should add provider-specific pieces first and only widen the shared OAuth layer when needed

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
- runtime discovery and status surfaces reflect the new Linear state after connection succeeds
- reconnecting updates the existing tenant integration instead of creating duplicates

### Increment 5: First real Linear read capability

Ship one useful, low-risk capability end to end.

Scope:

- implement `linear.issue.search`
- add provider adapter logic in `integration-gateway` that calls Linear through Otto-owned OAuth credentials
- normalize response payloads for the runtime
- keep the tool schema and ordering deterministic

Why this should be isolated:

- read-only operations are lower risk
- they validate the provider adapter contract before write behavior is added
- they give an immediate product win

Acceptance criteria:

- `execute_integration_command` can execute `linear.issue.search`
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
- after the user completes connect, the runtime status/detail responses reflect the updated Linear state without changing the static tool registry

### Increment 7: Capability policy, capability inventory UI, and gateway enforcement

Introduce a first-class capability control layer on top of managed integrations.

Status:

- functionally done on `main`
- `integration-gateway` now resolves and enforces command capability state before execution
- workspace users can review and toggle user-controllable command capabilities in:
  - `/[orgSlug]/integrations2/[integrationKey]/capabilities`
  - `/[orgSlug]/capabilities2`
- provider-unavailable Linear commands now resolve as disabled with a clear reason instead of relying only on usage-note copy

Product intent:

- `Integrations` remain the workspace-managed connections to external systems.
- `Capabilities` are the commands and triggers those integrations expose to Otto.
- Users should be able to see all capabilities in the workspace, understand whether they are usable, and block individual ones when appropriate.
- The runtime and `integration-gateway` must enforce those capability controls, not just the UI.

Scope:

- derive canonical capability definitions from the integration registry instead of maintaining a second hand-written capability catalog
- treat integration commands and triggers as capability rows, with commands marked as `read` or `write`
- add tenant-scoped capability policy records with a default-allow model
- surface resolved capability state in the workspace UI and the runtime detail path
- add per-integration capability inventory under `/[orgSlug]/integrations2/[integrationKey]/capabilities`
- add a global workspace capability inventory under `/[orgSlug]/capabilities2`
- enforce capability policy and provider/runtime availability at `integration-gateway` before command execution

Data model:

- add `tenant_integration_capability_states`
- store `policy_json` with a v1 shape of:

```json
{
  "policy": "allow" | "block"
}
```

- no row means allow by default
- keep policy storage generic so richer policies can be added later without reworking the schema

Capability model:

- capabilities are derived from the integration registry
- commands and triggers are both capability types
- commands carry:
  - `effect: "read" | "write"`
- capability definitions may also carry:
  - `userControllable`
  - provider-owned availability notes for cases where a capability should remain visible but not be executable by Otto in the current provider/actor shape

Resolved capability state:

- the runtime and agent-facing surface should use:
  - `status: "enabled" | "disabled" | "needs_attention"`
  - `reason?: string`
- the workspace UI may additionally read:
  - `policy`
  - `userControllable`
- disabled capability rows must remain visible in discovery and UI instead of being hidden

Examples:

- user blocks `linear.issue.delete`
  - UI shows the capability as `disabled`
  - `reason = "Disabled by workspace policy."`
  - execution fails in `integration-gateway`
- provider/actor limitation such as `team.delete`
  - UI still shows the capability as `disabled`
  - `reason = "Not available for Otto's current Linear actor in this workspace."`
  - the row is not user-toggleable
- disconnected integration
  - capability resolves as `needs_attention`
  - `reason = "Integration disconnected."`

UI:

- per-integration capability page:
  - route: `/[orgSlug]/integrations2/[integrationKey]/capabilities`
  - sortable data table
  - default sort: triggers first, then commands, then label
  - actions column with a three-dot menu for `Enable` / `Disable` when the capability is user-controllable
- global capability page:
  - route: `/[orgSlug]/capabilities2`
  - includes installed integration capabilities plus Otto core capabilities such as file read/write
  - filter dropdown with:
    - `All`
    - `Triggers`
    - `Commands`

Runtime and enforcement:

- `get_integration_details(command)` should include resolved capability state for the selected command
- disabled capabilities stay discoverable so Otto can explain why a capability exists but cannot be used
- `integration-gateway` must resolve capability state before executing a command and reject:
  - workspace-blocked capabilities
  - provider-unavailable capabilities
  - integrations in a `needs_attention` state

Initial provider-owned disabled examples for Linear:

- `workspace_member.invite_update`
- `workspace_member.invite_resend`
- `workspace_member.invite_cancel`
- `team.delete`
- `team.unarchive`

Acceptance criteria:

- every managed integration command resolves to a capability row
- command capabilities are classified as `read` or `write`
- workspace users can block and re-allow user-controllable capabilities
- blocked capabilities remain visible in the capability tables and integration details
- blocked capabilities fail clearly at `integration-gateway`
- provider-unavailable capabilities remain visible and disabled with a clear reason
- provider-unavailable capabilities are not user-toggleable
- `/integrations2/[integrationKey]/capabilities` shows resolved capability rows for that integration
- `/capabilities2` shows workspace-wide capability inventory across installed integrations and Otto core tools

### Increment 8: First Linear write capability

After the settings model exists, add one write command that benefits from those defaults.

Status:

- functionally done on `main`
- `linear.issue.create` exists and executes through `integration-gateway`
- execution is audited already
- the remaining capability-policy enforcement belongs to Increment 7

Scope:

- implement `linear.issue.create`
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
- use the `Full Webhook Support` chapter above as the architectural shape, while keeping the first concrete implementation Slack-first and compatible with the current shared Slack ingress routes

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
- move the remaining legacy workspace surfaces onto the same registry-driven shape, covering Slack, WhatsApp, and Brave where that fit is appropriate
- keep `otto-runtime-config` in place for non-integration surfaces

Acceptance criteria:

- Slack appears through the same runtime integration plugin family as Linear
- Slack transport architecture remains unchanged
- the remaining legacy workspace integration surfaces no longer depend on the older `/integrations` composition
- the runtime-facing integration model is more unified than before

Concrete delivery plan:

1. Add integration-settings primitives to the managed-integrations framework.
   - extend `IntegrationDefinition` with a provider-owned settings definition instead of reusing `web/src/tools/` for managed integrations
   - add generic settings storage under `tenant_integration_settings`
   - keep capability policy outside the settings model
2. Add one runtime-facing settings contract to `otto-integrations`.
   - keep lifecycle in `manage_integration`
   - keep command discovery and execution in the existing metatools
   - add one settings-specific read/update path for safe integration config instead of routing Slack through `otto-runtime-config`
3. Port Slack's current safe config surface into the provider-owned integration definition.
   - move `allowedUserIds`
   - move `allowedChannelIds`
   - move `answerInThreads`
   - move `channelAccessMode`
   - move `requireMentionInChannels`
   - move `ackReactionEnabled`
   - keep derived reachability warnings and destructive-change previews
4. Preserve the current Slack transport split.
   - keep Slack OAuth, signing secret ownership, install state, and shared HTTP ingress in the control plane
   - keep raw Slack request forwarding behavior compatible with the current voice-note path
   - do not move Slack webhook transport into `integration-gateway` in this increment
5. Replace the workspace UI with a provider-owned integration page on the new model.
   - move the current Slack status/configuration UI out of the legacy runtime-surface page path
   - keep the same user-facing controls and diagnostics where they still make sense
   - show `Configuration` only when the provider definition actually exposes settings
6. Keep `otto-runtime-config` only as a compatibility layer during migration.
   - leave only the remaining non-integration surfaces there
   - remove Slack from the runtime-surface inventory once the new integration-backed page and runtime contract are live
   - avoid a long-lived period where both runtime plugins can mutate Slack independently

Provider-owned Slack settings shape:

- editable-by-user-and-agent:
  - `allowedUserIds`
  - `allowedChannelIds`
  - `answerInThreads`
  - `channelAccessMode`
  - `requireMentionInChannels`
  - `ackReactionEnabled`
- read-only provider state:
  - connected workspace name
  - connected team id
  - last webhook time
  - last directory sync time
  - last Slack API validation result
  - reconnect-needed / apply-needed state
- never exposed as managed settings:
  - bot token
  - signing secret
  - capability permission toggles
  - shared ingress routing internals

Recommended implementation phases:

Phase A: contract and storage

- add framework-native settings metadata plus storage and audit helpers
- add the `otto-integrations` settings read/update contract
- keep Slack UI behavior unchanged during this phase

Phase B: Slack provider port

- add a provider-owned Slack integration definition under `web/src/integrations/library/slack`
- port the current Slack config schema, directory-backed options, semantic validation, and derived effects
- add a provider-owned workspace detail page that replaces the old Slack runtime-surface page

Phase C: runtime cutover

- remove Slack from the `otto-runtime-config` integration inventory
- make `otto-integrations` the only runtime plugin that can read or mutate Slack settings
- keep the existing public `/api/integrations/slack/*` ingress routes unchanged

Phase D: verification and cleanup

- verify that a connected workspace can read and update Slack settings through both the new workspace UI and the new runtime integration contract
- verify there are no stale-write or double-mutation paths after the cutover
- delete the now-unused Slack-specific runtime-surface adapters and routes

Implementation status:

- completed on `main`
- Slack capability policy now renders through the shared managed capability inventory table
- Slack lifecycle/status UI is provider-owned under `web/src/integrations/library/slack`
- the legacy `/integrations/slack` page is now a redirect into `/integrations2/slack/status`
- `otto-runtime-config` no longer registers Slack-specific tools
- managed integration tabs now use nested routes like `/integrations2/slack/status`, `/integrations2/slack/capabilities`, and `/integrations2/slack/channels`
- Slack workspace navigation now points at the managed route from the sidebar, setup-flow shell, workspace status rail fallback, Slack OAuth callback redirects, and the legacy Slack tool-detail redirect
- the legacy `/integrations` index now only carries non-migrated runtime-surface entries such as WhatsApp
- Slack is now registered in the generic managed OAuth provider registry, and workspace Slack connect/reconnect starts through `/oauth/start/integration/slack?orgSlug=...`
- the shared managed integration callback route now completes Slack OAuth and redirects back to the managed Slack page
- `manage_integration` for Slack now returns the explicit managed Slack reconnect URL while keeping disconnect routed through the shared provider disconnect endpoint
- Slack onboarding now also uses the generic managed OAuth route family, so `/oauth/start/integration/slack` and `/oauth/callback/integration/slack` are the canonical Slack OAuth entrypoints
- Slack now declares `platform_managed` ingress metadata in the managed integration definition
- Slack provider-owned ingress parsing and request handling now live under `web/src/integrations/library/slack/ingress`
- the generic provider-keyed route family now exists at `/api/webhooks/integrations/[provider]/[endpointKey]`
- the current public `/api/integrations/slack/*` routes remain as compatibility wrappers over the same Slack provider-owned ingress handler
- Slack ingress delivery persistence now uses the generic `integration_ingress_deliveries` table with normalized external workspace/account columns plus `provider_metadata`, and the old `slack_ingress_deliveries` table is migrated away

Completion plan from the current partial migration state:

1. Make `web/src/integrations/library/slack` the only long-term home for Slack integration behavior.
   - keep the Slack provider definition, integration page shell, capability rendering, and integration-specific actions under `web/src/integrations/library/slack`
   - stop growing Slack-specific behavior inside `web/src/app/[orgSlug]/(app)/integrations/slack/*` except as temporary shims
   - treat `web/src/app/[orgSlug]/(app)/integrations/slack/*` as compatibility wrappers that should eventually disappear
2. Finish the Slack page-shell migration so it matches the shared managed-integration shape used by Linear.
   - stop rendering the old custom Slack tab system directly from the legacy runtime-config panel
   - move Slack onto a provider-owned detail shell under `library/slack` that uses the same managed-integration layout concepts as Linear
   - keep Slack-specific sections only where Slack genuinely needs them, such as people and channels
3. Move Slack capabilities onto the shared managed capability inventory path.
   - render the `Capabilities` tab with the shared capability table instead of custom grouped badges
   - support enable and disable actions through the same managed capability policy endpoints used by Linear
   - stop treating Slack capability display as a one-off static rendering
4. Finish lifecycle parity in the managed integration contract.
   - add Slack-specific `connect`, `reconnect`, and `disconnect` behavior to `manage_integration`
   - show reconnect and disconnect actions in the managed Slack status UI, not only in temporary legacy controls
   - remove the current gap where Slack falls back to `open_workspace` for actions the runtime should understand explicitly
5. Remove Slack-specific agent mutation tools from `otto-runtime-config`.
   - delete `get_slack_policy`, `preview_slack_policy_action`, and `apply_slack_policy_action`
   - leave `otto-runtime-config` responsible only for non-integration runtime surfaces
   - make `otto-integrations` the only runtime plugin surface for Slack lifecycle and settings
6. Extract shared integration detail-page behavior.
   - create a shared sticky save treatment for editable integration pages instead of Slack owning its own save bar behavior
   - fix the current Slack save bar layout shift by rendering it outside normal page flow and positioning it higher on the viewport
   - reuse the same shared save treatment for future editable integrations so Linear, Slack, and later providers do not drift
7. Replace query-param tabs with real nested routes for managed integration detail pages.
   - stop using `?tab=` as the primary navigation shape for `integrations2`
   - move to routes such as `/integrations2/slack/status`, `/integrations2/slack/capabilities`, `/integrations2/slack/configuration`, and provider-specific child routes like `/integrations2/slack/channels`
   - make the integration framework own tab routing at the page-shell level so every provider follows the same URL semantics

Definition of done for the full Slack migration:

- Slack capability policy uses the shared managed capability inventory table and policy endpoints
- Slack status actions for connect, reconnect, and disconnect are exposed consistently in both the workspace UI and `manage_integration`
- Slack settings, page shell, and provider-specific UI all live under `web/src/integrations/library/slack`
- `otto-runtime-config` no longer exposes any Slack-specific tools or Slack inventory entries
- Slack managed integration pages use route-based tabs rather than query-param tabs
- the remaining legacy `/integrations/slack` page is either removed or reduced to a redirect into `/integrations2/slack/...`

Verification checklist:

- Slack still connects and reconnects through the control-plane OAuth flow
- Slack HTTP ingress still routes events, commands, and interactivity by `team_id`
- a connected workspace can read Slack settings through the new integration detail path
- Otto can update agent-manageable Slack settings through the new integration settings contract
- Slack capability policy appears in the shared managed capability inventory table and can be enabled or disabled there
- Slack lifecycle actions are available through `manage_integration`, including explicit reconnect and disconnect handling
- locked or read-only Slack fields fail clearly when the agent tries to mutate them
- no Slack-specific runtime mutation tools remain in `otto-runtime-config`
- route-based managed integration tabs work for Slack and the shared integration detail shell
- voice-note transcription still works after the runtime-facing settings migration
- the legacy `otto-runtime-config` plugin no longer advertises Slack once the cutover is complete

### Current follow-on slice: platform-managed Brave migration

Brave web search is the first concrete `Class A: Global managed integration`
and should now move onto the same registry-driven integration shape as the
workspace-managed providers.

Current direction:

1. Add explicit platform-managed integration support to the shared framework.
   - integrations must be able to appear as installed, enabled, and visible in
     the workspace/runtime catalogs without a `tenant_integrations` row
   - provider-owned status should be able to resolve from control-plane env or
     other platform state instead of tenant OAuth state
   - platform-managed integrations must not advertise user-disable or
     uninstall behavior
2. Port Brave into `web/src/integrations/library/brave`.
   - Brave should appear in `/integrations2` instead of only under the legacy
     `Tools` surface
   - the provider-owned page should reuse the current read-only Brave config
     visibility, capability inventory, and status reporting
   - `configure_integration action=get` should expose current projected Brave
     defaults, while validation/apply remain blocked because Brave is
     platform-managed
3. Keep the current runtime projection path temporarily while the product
   surface migrates.
   - this first slice may continue projecting Brave into tenant runtime env and
     `openclaw.json`
   - the older `web/src/tools/web-search` path is now removed, so the managed
     integration page is the only workspace surface for Brave
4. Add an Otto-owned web provider plugin and proxy path in the next slice.
   - create a dedicated runtime plugin, `otto-web-provider`, rather than
     extending `otto-ai-provider`
   - register an Otto-owned OpenClaw web-search provider that proxies through
     the workspace app using `TENANT_TOKEN` and
     `OTTO_CONTROL_PLANE_BASE_URL`
   - keep upstream provider API keys only in the workspace app / control plane
5. Remove direct tenant-runtime Brave credentials after the proxy path is
   stable.
   - desired-state compilation should stop projecting `BRAVE_API_KEY` into
     tenant env
   - runtime web-search egress should then be controlled centrally through the
     workspace app

Acceptance criteria for the first slice:

- Brave is registered under `web/src/integrations/library/brave`
- Brave appears in the managed integration catalog for every workspace without
  requiring a tenant integration record
- runtime integration inventory and detail routes report Brave as a
  platform-managed integration
- `configure_integration action=get` returns a read-only Brave settings view
- the next proxy slice is explicitly documented as `otto-web-provider` plus a
  control-plane web-search endpoint

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

1. Increment 1: static metatool plugin plus one narrow real integration
2. Increment 2: real `integration-gateway` execution boundary
3. Increment 3: workspace-visible Linear shell (done)
4. Increment 4: first-party OAuth connect flow for Linear

That sequence gives a real vertical line quickly without prematurely committing to a broad schema or webhook buildout.

This is the clarified target architecture and should replace the earlier, less precise wording.
