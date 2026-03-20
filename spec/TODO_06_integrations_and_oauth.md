# TODO 06: Integrations And OAuth

## Goal

Connect Slack through the control plane with one shared Otto Slack app, a web-based OAuth flow, centrally stored installation secrets, and tenant-specific OpenClaw configuration projected onto each tenant VPS.

## Scope

- create the first shared Slack app strategy for all Otto customers
- implement Slack OAuth start and callback flows in the control plane
- store Slack installation metadata and secrets centrally with encryption at rest
- route incoming Slack webhooks for all installations to the correct tenant runtime
- project tenant-specific Slack runtime config into desired state and trigger apply jobs
- define reconnect, disconnect, and token lifecycle behavior

## Dependencies

- `DONE_02_auth_and_tenant_model.md`
- `TODO_04_runtime_packaging.md`
- `TODO_05_config_apply_and_reconciliation.md`

## Decision summary

- Use one Slack app owned by Otto for all tenants.
- OAuth terminates in the control plane, not on the tenant VPS.
- Persist canonical Slack installation state in the control-plane database.
- Treat the tenant VPS as a projected runtime target, not the system of record.
- Prefer Slack HTTP mode for the shared app architecture.
- Do not use per-tenant Socket Mode connections with one shared Slack app:
  - Slack app-level tokens are shared across all installations
  - Socket Mode supports multiple concurrent connections for the same app
  - that connection model is not a safe tenant-routing primitive for one-VPS-per-tenant isolation
- Do not assume Slack can call each tenant VPS directly with one shared app:
  - Slack request URLs are configured at the app level
  - one shared app therefore needs one shared ingress layer that can route by installation metadata

## Why the proposed direction mostly makes sense

The control-plane-owned OAuth flow and centralized token storage make sense and should be the default design.

The important correction is ingress routing:

- outgoing Slack API calls can use tenant-specific bot tokens on the tenant VPS
- incoming Slack events, slash commands, and interactive payloads cannot be routed to the correct tenant VPS by token alone when using one shared Slack app
- The control plane therefore needs a shared Slack ingress endpoint under a control-plane-owned domain, plus tenant-aware routing behind it

## Proposed architecture

### 1. Shared Slack app

Create one Slack app for Otto with:

- a single client ID and client secret
- one app-level signing secret
- public distribution enabled later when the product is ready
- Slack Marketplace listing as a separate later milestone if needed

Initial recommendation:

- Phase 1: public distribution link or controlled installs
- Phase 2: Slack Marketplace submission after the integration is stable and policy/compliance work is complete

### 2. Control plane as the installation authority

Add control-plane routes:

- `GET /api/integrations/slack/start`
- `GET /api/integrations/slack/callback`

Responsibilities:

- require an authenticated control-plane user and tenant context before starting install
- create a signed OAuth state payload that binds:
  - tenant ID
  - organization ID
  - current user ID
  - post-install return URL
- redirect the browser to Slack OAuth
- exchange the returned code for installation tokens
- persist installation metadata and secrets
- enqueue a desired-state update and config apply job for the tenant

### 3. Shared Slack ingress router

Add control-plane-owned public endpoints for Slack webhooks, for example:

- `POST /api/integrations/slack/events`
- `POST /api/integrations/slack/interactivity`
- `POST /api/integrations/slack/commands`

Responsibilities:

- receive all Slack traffic for the shared app
- identify the installation from the raw payload:
  - `team_id`
  - `enterprise_id` when present
  - `api_app_id`
- look up the corresponding tenant integration record
- forward the request to the correct tenant runtime path or internal adapter
- log delivery attempts and failures

Important consequence:

- the tenant VPS should not be the public Slack entrypoint
- the control plane or a dedicated ingress service must sit in front of all tenant runtimes

### 4. Tenant runtime projection

For each connected tenant, project only runtime-needed Slack material to desired state.

Recommended tenant runtime material:

- bot token for that tenant installation
- workspace/team ID
- optional enterprise ID
- selected Slack channel configuration
- control-plane-generated internal webhook path or tenant runtime endpoint metadata

Keep only in the control plane:

- Slack client secret
- OAuth refresh token if token rotation is enabled
- full install audit trail
- uninstall and reauthorization state

Signing secret handling:

- preferred end state: validate Slack signatures centrally and forward internally with control-plane authentication
- acceptable v1 fallback if required by vanilla OpenClaw: mirror the app signing secret to tenant runtime config and raw-proxy the request unchanged
- if the fallback is used, explicitly document the blast-radius tradeoff because one shared app means one shared signing secret across all tenants

## Slack app setup plan

### 1. App manifest and scopes

Write a checked-in Slack app manifest template that captures:

- app name and support metadata
- redirect URLs for the control-plane web OAuth flow
- event subscriptions and interactivity endpoints on the control-plane domain
- required bot scopes
- optional user scopes if OpenClaw needs them

Scope policy:

- start with the minimum bot scopes required by the OpenClaw Slack channel
- avoid user tokens in v1 unless the product clearly needs installer-user actions

### 2. Distribution mode

Decide explicitly between:

- public distribution link first
- Slack Marketplace listing later

Reason:

- Marketplace submission adds review and policy overhead
- it should not block the functional installation architecture

### 3. Channel mode

Use HTTP mode for the shared app rollout.

Do not use Socket Mode for the shared public app unless the control plane moves Slack event handling into one centralized service instead of one runtime per tenant VPS.

## Control-plane data model plan

Add integration tables that separate provider, installation, and secret state.

Recommended tables:

- `integration_providers`
  - `id`
  - `provider_key` such as `slack`
  - `status`
- `tenant_integrations`
  - `id`
  - `tenant_id`
  - `provider_key`
  - `status`
  - `connected_at`
  - `disconnected_at`
  - `last_apply_run_id`
  - `last_delivery_error`
- `slack_installations`
  - `id`
  - `tenant_integration_id`
  - `slack_team_id`
  - `slack_team_name`
  - `slack_enterprise_id`
  - `slack_enterprise_name`
  - `slack_bot_user_id`
  - `installer_user_id`
  - `scope_csv`
  - `token_rotation_enabled`
  - `installed_at`
  - `last_token_refresh_at`
  - `last_webhook_at`
- `integration_secrets`
  - `id`
  - `tenant_integration_id`
  - `secret_type`
  - `ciphertext`
  - `key_version`
  - `created_at`
  - `rotated_at`
- `messaging_workspaces`
  - `id`
  - `tenant_integration_id`
  - `external_workspace_id`
  - `display_name`
  - `sync_status`
  - `last_synced_at`
  - `last_sync_error`
- `messaging_workspace_members`
  - `id`
  - `messaging_workspace_id`
  - `external_member_id`
  - `display_name`
  - `member_type`
  - `is_deleted`
  - `profile_json`
  - `last_synced_at`
- `messaging_conversations`
  - `id`
  - `messaging_workspace_id`
  - `external_conversation_id`
  - `name`
  - `conversation_type`
  - `is_archived`
  - `metadata_json`
  - `last_synced_at`

Secret types for Slack:

- `slack_bot_token`
- `slack_refresh_token` if rotation is enabled
- optionally `slack_signing_secret` only if the runtime must verify Slack directly

## OAuth workflow plan

### Step 1. Install start

- user clicks `Connect Slack` inside a tenant settings page
- control plane verifies tenant membership
- control plane creates OAuth state and stores a short-lived install session
- browser redirects to Slack OAuth

### Step 2. Callback

- control plane verifies OAuth state and tenant binding
- exchange code for installation payload
- upsert installation metadata by `slack_team_id` plus `slack_enterprise_id`
- encrypt and store returned secrets
- mark the tenant integration as `pending_apply`

### Step 3. Desired-state update

- create a new desired-state version for the tenant
- render Slack-related OpenClaw config from canonical DB state
- enqueue config apply

### Step 4. Post-install verification

- after apply completes, run a control-plane verification step
- confirm ingress routing resolves to this tenant
- optionally send a Slack test call such as `auth.test`
- mark the integration `connected`

## OpenClaw and VPS apply plan

Add a Slack section to tenant desired state that can render into the runtime config produced by `TODO_05`.

V1 recommendation:

- configure OpenClaw in Slack HTTP mode on the tenant VPS
- expose only a control-plane-managed ingress target on the VPS
- keep the tenant runtime behind control-plane routing instead of public tenant-managed Slack endpoints

Config projection should include:

- tenant bot token
- account identifier derived from the tenant integration ID
- workspace metadata
- any routing path or internal listener configuration required by the runtime

Config projection should exclude:

- Slack client secret
- raw OAuth code exchange state
- refresh logic

## Slack runtime config substrate

The control plane should not keep Slack policy only as ad hoc fields inside desired state.

Implemented foundation:

- generic tenant-scoped runtime config rows now live in one shared table
- the first concrete row is `channel/slack`
- Slack policy is stored canonically as:
  - `allowedUserIds`
  - `allowedChannelIds`
  - `answerInThreads`
  - `channelAccessMode`
  - `requireMentionInChannels`
- desired state is now compiled from that canonical row instead of hardcoded permissive Slack defaults
- control-plane write helpers now validate Slack user and channel IDs against the synced `messaging_*` directory tables before accepting config changes
- the Slack control plane can now manage channel membership directly for public channels by calling Slack join/leave APIs and resyncing the directory
- when `channelAccessMode = member_of_channels`, desired state now derives the effective Slack channel set from joined-channel membership instead of the stored manual allowlist
- the Slack settings page now refreshes the synced Slack directory on load so channels Otto was invited to directly in Slack appear without a separate manual sync step
- OpenClaw projection now maps `channelAccessMode = member_of_channels` to Slack `groupPolicy = "open"` with a wildcard channel mention policy, instead of incorrectly keeping Slack on channel allowlist mode

This keeps one generic storage path for future plugin and tool config without creating one table per tool.

The next layer on top of this substrate is now in place as well:

- `web/src/tools/` acts as the control-plane-owned registry for configurable tool surfaces
- `tenant_runtime_config_entries.install_state` plus `tenant_runtime_config_mutations` now cover lifecycle state and audit history without per-tool tables
- runtime-authenticated agent access now goes through `/api/internal/runtime/tool-config/...`
- `runtime-plugins/otto-tool-config` now exposes generic list/read/validate/apply/lifecycle/reapply tools for registry-backed surfaces
- the first non-Slack surface is now `web/search`, resolved from control-plane env instead of tenant DB state
- tenant desired-state compilation now projects Brave web search into `tools.web.search` plus runtime `.env`, so globally managed web search is visible in both the UI and runtime surface APIs without becoming tenant-editable
- runtime surface payloads now carry explicit `surfaceType` and `uiGroup` metadata so the same registry can back both `Integrations` and `Tools`
- `otto-tool-config` keeps its stable plugin ID but now also exposes surface-oriented alias tool names such as `list_configurable_surfaces` and `get_configurable_surface`

## Routing strategy plan

Because one shared app receives payloads for many workspaces, routing must be explicit.

Recommended v1 router behavior:

1. accept raw Slack request
2. parse enough of the body to identify `team_id` or `enterprise_id`
3. look up the tenant integration
4. forward the request to the tenant runtime endpoint
5. persist a delivery event row
6. retry or dead-letter failed deliveries

Compatibility requirement for `TODO_10_voice_note_understanding.md`:

- preserve the Slack attachment metadata and private file URL semantics that OpenClaw expects for media download
- avoid transforming inbound Slack payloads into a custom shape that would stop tenant runtimes from downloading and transcribing voice notes with the tenant bot token

Recommended supporting tables:

- `slack_ingress_deliveries`
  - `id`
  - `tenant_integration_id`
  - `request_type`
  - `team_id`
  - `status`
  - `attempt`
  - `error`
  - `created_at`
  - `finished_at`

If low-latency proxying proves fragile, move step 4 behind the existing job/event system rather than pushing long-lived logic into a request handler.

## Token lifecycle plan

Initial recommendation:

- do not enable Slack token rotation until the control plane has a background refresh flow and re-apply path

If token rotation is enabled later:

- keep refresh tokens only in the control plane
- add a scheduled refresh job
- update encrypted secrets centrally
- create a new desired-state version
- trigger tenant config apply before old access tokens expire

## Disconnect and recovery plan

Add explicit flows for:

- reconnect Slack after failed apply
- reinstall Slack to a different workspace
- disconnect Slack from a tenant
- handle Slack uninstall events or revoked tokens

Behavior:

- mark the integration degraded if ingress delivery fails repeatedly
- surface the last successful webhook time and last Slack API validation time in the UI
- never delete historical install audit rows on disconnect

## Ordered implementation plan

### Step 1: lock the integration architecture

Deliverables:

- written decision that one shared Slack app requires shared ingress
- written decision to use HTTP mode for the shared app rollout
- decision on public distribution first vs Marketplace later

### Step 2: define schema and secret handling

Deliverables:

- integration tables
- encrypted secret abstraction
- tenant integration status model

### Step 3: implement OAuth web flow

Deliverables:

- install start route
- callback route
- Slack token exchange wrapper
- tenant-scoped install UI

### Step 4: implement Slack ingress router

Deliverables:

- public Slack ingress endpoints
- tenant lookup by team or enterprise ID
- forwarding or proxy path to tenant runtime
- delivery logging
- preserve enough raw Slack attachment semantics for tenant runtimes to keep downloading private audio attachments for voice-note transcription

### Step 5: project config to OpenClaw and apply

Deliverables:

- desired-state renderer for Slack runtime config
- apply trigger on connect, reconnect, and token change
- post-apply validation

### Step 6: add lifecycle and operations support

Deliverables:

- disconnect flow
- revoked-token handling
- operational visibility for deliveries and last webhook time
- optional token refresh worker if rotation is enabled

## Exit criteria

- one Otto Slack app can be installed into multiple customer workspaces
- the OAuth install flow completes in the web app for a chosen tenant
- installation state is stored centrally and encrypted at rest
- Slack payloads reach the correct tenant runtime through shared ingress routing
- tenant desired state updates trigger runtime apply automatically
- a connected tenant can pass a basic Slack health check

## Status checklist

- [ ] decide public distribution vs Marketplace timing
- [ ] write Slack app manifest template and scope list
- [x] define integration and secret schema
- [x] implement OAuth entry and callback routes
- [x] encrypt stored Slack secrets
- [x] add generic runtime config storage for tenant-scoped Slack policy
- [x] add shared server-side validation helpers for Slack runtime config writes
- [x] expose Slack runtime config through control-plane APIs and the Slack integration UI
- [x] expose Slack runtime config through runtime-authenticated internal APIs for agent/plugin use
- [x] add a registry-backed tool-surface layer plus generic runtime plugin for agent-managed tool config
- [x] add the first non-Slack env-backed runtime surface for global web search
- [x] project Brave web search into tenant runtime config and env as a read-only control-plane-managed surface
- [x] add explicit runtime-surface grouping metadata plus surface-oriented plugin aliases while keeping the existing plugin ID stable
- [x] add a channel access mode that can derive allowed channels from Otto's Slack membership
- [x] add Slack channel join/leave actions in the control plane for public-channel membership management
- [ ] implement shared Slack ingress router
- [x] render Slack policy from canonical runtime config into desired state
- [x] trigger apply after connect or token change
- [ ] add reconnect and disconnect flows
- [ ] decide whether token rotation is enabled in v1

## Open questions

- Is the first release target an install link with public distribution, or a full Slack Marketplace listing?
- Can unmodified OpenClaw accept control-plane-forwarded webhook traffic after central signature verification, or must the raw Slack request be proxied to the tenant runtime?
- Do we support exactly one Slack workspace per tenant in v1, or multiple installations per tenant?
- Do we need Enterprise Grid org installs in v1, or can we defer them until after single-workspace installs are stable?
