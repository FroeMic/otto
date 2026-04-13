# TODO 21: Workspace Multiplayer Chat And Web Channel

## Executive Summary

This spec defines a new multiplayer chat system in the Otto workspace that does not depend on OpenClaw's existing WebChat UI.

The key decisions are:

- The workspace UI is the only browser-facing chat surface.
- Browsers never connect directly to OpenClaw Gateway.
- The Control Plane owns canonical conversation state, multiplayer fanout, uploads, permissions, replay, and durable history.
- The tenant server remains the runtime-side bridge to local OpenClaw Gateway and runtime APIs.
- A dedicated `otto-workspace-chat` OpenClaw channel plugin is the correct long-term runtime transport seam, but it is not the collaboration layer.
- A workspace conversation is a Control Plane object, not an OpenClaw session.
- One conversation may map to many OpenClaw session segments over time.
- External surfaces such as Slack should reconcile into the same conversation model through a stable surface key instead of exposing raw runtime session splits to users.
- Durable named conversations are first-class product objects for long-lived topic feeds, API delivery targets, schedules, and webhooks.

This design supports:

- open workspace conversations
- personal conversations, including DMs
- live multiplayer participation from multiple browsers
- streamed assistant replies
- file upload
- voice upload
- external surface history such as Slack
- durable named conversations that act as persistent context feeds

## Goal And Purpose

The goal is to ship a first-class multiplayer chat experience inside the workspace app while keeping OpenClaw as the tenant-local execution runtime.

The purpose of the system is not to mirror OpenClaw sessions one-to-one. The purpose is to give Otto a stable collaborative conversation model that can unify:

- workspace-native chats
- open workspace chats
- personal chats, including DMs
- Slack channel and thread activity
- scheduled runs
- webhook deliveries
- API-delivered messages
- long-lived named topic feeds

The main product rules are:

1. The workspace app is the only browser UI for chat.
2. The Control Plane is the only browser-facing realtime and API surface.
3. Open conversations are the default for shared workspace chats.
4. Personal conversations are private and never visible to the full workspace.
5. Any authorized workspace member can open and continue an open conversation.
6. Otto-native reply-tree threading is out of scope for v1.
7. Slack threads remain separate top-level conversation items in history.
8. OpenClaw session boundaries are runtime metadata, not the primary user-facing chat identity.

## Scope

- add a new multiplayer conversation model to the Control Plane
- add a new workspace chat UI and sidebar history surface
- add browser-to-Control-Plane realtime fanout
- add Control-Plane-to-tenant bridge transport
- add a dedicated `otto-workspace-chat` OpenClaw channel plugin
- support streamed assistant replies in the workspace UI
- support file upload and voice upload
- support durable named conversations with slugs and delivery-target semantics
- support triggering and non-triggering inbound deliveries for durable named conversations
- reconcile Slack and other external surfaces into the same conversation model
- preserve the ability to inspect underlying OpenClaw session segments for diagnosis

Out of scope for this slice:

- using OpenClaw's existing WebChat UI
- direct browser-to-Gateway communication
- Otto-native reply-tree threading
- reactions, edits, polls, and rich message actions as a first-pass requirement
- turning every uploaded file into shared knowledge-base content automatically
- exposing raw runtime session rotation as the main user-facing conversation structure

## Dependencies

- `TODO_06_integrations_and_oauth.md`
- `TODO_09_ui_app_shell_and_onboarding_rebuild.md`
- `TODO_14_session_history_visibility.md`
- `TODO_17_managed_integrations_architecture.md`
- `TODO_19_oauth_connected_accounts_substrate.md`
- `TODO_20_unified_frontend_and_hono_migration.md`

## Architecture

The architecture has four product layers:

- workspace UI
- Control Plane
- tenant server
- tenant OpenClaw runtime

The architectural split is:

- the workspace UI is the collaborative browser surface
- the Control Plane is the authority for chat state and browser fanout
- the tenant server is the runtime-side bridge
- OpenClaw owns inference, tools, session mechanics, and external channel execution

```text
+-------------------------+
| Browser                 |
| workspace UI            |
+------------+------------+
             |
             v
+-------------------------+
| Control Plane           |
| - auth                  |
| - conversations         |
| - uploads               |
| - browser realtime hub  |
| - routing to tenant     |
+------+------------+-----+
       |            |
       |            +----------------------+
       |                                   |
       v                                   v
+--------------+                 +----------------------+
| Postgres     |                 | Object storage       |
| canonical DB |                 | uploads/media relay  |
+--------------+                 +----------------------+
       |
       v
+-------------------------+
| tenant server           |
| - bridge to Control     |
| - local Gateway client  |
| - session mapping       |
| - media staging         |
+------------+------------+
             |
             v
+-------------------------+
| OpenClaw runtime        |
| - Gateway               |
| - otto-workspace-chat   |
| - Slack and others      |
+-------------------------+
```

### Why the channel plugin is necessary but not sufficient

The `otto-workspace-chat` channel plugin is the correct seam for:

- session grammar
- routing inbound workspace messages into OpenClaw
- routing outbound OpenClaw replies back toward the tenant bridge
- reply threading semantics when they arrive later
- channel-owned streaming configuration

The plugin is not the right home for:

- browser auth
- multiplayer room membership
- canonical message persistence
- durable history
- presence
- per-user favorites
- sidebar filters
- Slack-to-workspace reconciliation

Those belong in the Control Plane.

### Current repo implementation stance

This repo should treat workspace chat as a new-app-surface feature from the start.

That means:

- browser-facing workspace chat should land in `apps/web`, not legacy `web/`
- native backend routes should land in `apps/api`
- shared contracts and domain handlers should land in `packages/features/*`
- tenant runtime work should remain compatible with the Otto-owned custom runtime image and bundled plugin model already used in this repo
- the OpenClaw work should target a custom channel plugin built with the plugin SDK rather than a source fork if at all possible

Current implementation status for Increment 1:

- the shared workspace-chat contract package now exists in `packages/features/workspace-chat`
- native non-UI workspace chat routes now exist in `apps/api`
- the first persisted backend slice now exists:
  - `apps/api` workspace-chat routes now use real conversation and message persistence instead of `501` placeholders
  - shared conversation tables now exist in `packages/features/integrations-runtime/src/db/schema.ts`
  - the initial migration now exists in `drizzle/0048_workspace_chat_increment_1.sql`
  - a tenant-authenticated runtime callback route now exists for assistant message completion and runtime-segment linkage
- the Control Plane-to-tenant outbound dispatch now exists for the first text-only slice:
  - `apps/api` now persists a user message, resolves the owning tenant runtime, and owns the first runtime callback seam for workspace-chat completions
  - the initial callback path established the stable `workspace:<conversationId>` surface key that later bridge slices continue to use
- the `otto-workspace-chat` runtime plugin now posts assistant completions back to the existing runtime callback route instead of throwing
- the managed tenant OpenClaw config now enables `otto-workspace-chat` alongside the other Otto-owned plugins when the workspace base URL is available
- the first `apps/web` workspace-chat UI slice now exists on the new app surface only:
  - the conversation route is `/{workspaceSlug}/c/{conversationId}`
  - `apps/web/src/features/workspace-chat` now owns the first feature-local UI files for API access, sidebar history, conversation detail, and message composition
  - the workspace shell now shows a first conversation history section and create-conversation action
  - the first browser path is polling-based and intentionally stops short of realtime fanout or streaming
- the first tenant-bridge heartbeat slice now also exists:
  - the Otto-managed runtime image now starts a lightweight `runtime-bridge-reporter` helper next to the existing cron watcher
  - the tenant runtime reports bridge liveness, gateway health, enabled plugin ids, and control-plane base URL back to `/api/internal/runtime/bridge/report`
  - the control plane persists the latest bridge heartbeat in `tenant_runtime_bridge_statuses`
  - the command relay and event-stream side of the bridge protocol is still the next slice
- the first async tenant-trigger slice now also exists:
  - `apps/api` now queues `run_workspace_chat_turn` jobs in `job_runs` instead of SSH-dispatching chat turns inline from the browser request path
  - `apps/worker` now resolves tenant runtime access and POSTs each queued workspace turn to a gateway-authenticated `otto-workspace-chat` tenant HTTP ingress route
  - `runtime-plugins/otto-workspace-chat` now accepts that plugin-owned HTTP event quickly, builds a shared inbound context, returns a `sessionKey` acknowledgment to the worker, and continues execution through OpenClaw's shared inbound reply pipeline instead of depending on an Otto sidecar runner plus bridge command claim/completion routes
  - this slice replaces SSH for workspace-chat dispatch only; richer runtime events remain follow-on work
- the first assistant-lifecycle slice now also exists:
  - creating a workspace chat turn now persists a pending assistant placeholder message alongside the completed user message
  - worker job payloads and plugin callbacks now carry `assistantMessageId` correlation so streaming, failure, and completion paths can target the correct placeholder
  - the first runtime delta callback now advances the assistant placeholder to `streaming`, worker/plugin failure callbacks mark it `failed`, and the runtime completion callback now fills and completes that exact assistant message instead of always inserting a new row
  - the workspace UI now renders empty-part assistant placeholders as queued/running/failed state instead of treating every missing assistant reply as an implicit spinner only
- the first browser push slice now also exists:
  - `apps/api` now exposes a typed Bun websocket route at `/api/workspace/:orgSlug/chat/realtime`
  - the control plane now keeps an in-memory workspace-chat fanout hub, validates typed `subscribe` / `unsubscribe` messages, returns explicit `subscription_denied` control events, and treats websocket fanout as best-effort after successful DB writes
  - `apps/web` now opens one websocket from the workspace shell, and active conversation pages only manage subscribe / unsubscribe while pushed events update TanStack Query caches for both the conversation detail and sidebar summary list
  - this slice gives live queued/running/completed/failed updates without waiting for polling and aligns the browser with the intended workspace-scoped websocket model
- the first streaming-delta slice now also exists:
  - `packages/features/workspace-chat` now defines tenant-runtime delta request/response contracts for cumulative assistant text snapshots plus monotonic `sequence`
  - `apps/api` now exposes `/api/internal/runtime/workspace-chat/messages/delta` and applies idempotent assistant placeholder updates against the canonical workspace conversation state
  - `runtime-plugins/otto-workspace-chat` now exposes a gateway-authenticated tenant HTTP ingress route, builds a QA/Slack-style synthetic inbound context from those posted events, uses the shared OpenClaw inbound reply pipeline for execution, and streams cumulative assistant text snapshots back to the control plane through plugin-owned callbacks
  - once ingress is accepted, the plugin now owns post-acceptance delta, completion, and failure callbacks; the worker only owns failures that happen before the tenant accepted the event
  - the channel plugin no longer registers a fake no-op provider lifecycle; the long-lived ingress surface is the plugin HTTP route itself
  - the old workspace-chat bridge-command runner path has been removed from the runtime image
  - the existing workspace websocket path now republishes those assistant placeholder updates as canonical `conversation.message_upserted` events so the same assistant bubble grows live until final completion marks it `completed`
  - `apps/web` now interpolates the last assistant text part locally between canonical cumulative snapshots so browser streaming reads more continuously without changing the canonical transport contract

## Frameworks And Packages To Use

### Control Plane browser UI

Current first implementation path:

- `web/`
- Next.js App Router
- React
- TypeScript
- shadcn UI

Long-term target direction from `TODO_20`:

- `apps/web`
- Hono-hosted frontend
- Vite-built React workspace SPA
- TanStack Router
- shadcn UI

Recommendation:

- do not wait for the full `apps/web` migration before defining the chat model
- define the domain model and transport contracts once, then adapt the route/UI layer as the migration proceeds

### Control Plane backend

- current first implementation path: Next.js route handlers in `web/`
- long-term extraction target: `apps/api`
- Postgres as the source of truth
- Drizzle for schema and query access
- worker-backed async jobs for retries, imports, media processing, and reconciliation
- WebSocket as the primary browser realtime transport

Why WebSocket is the default:

- multiplayer presence and fanout need bidirectional state
- typing and abort signals are interactive
- streaming updates should not require spinning up a separate transport shape from the existing websocket path

Server-side persistence recommendation:

- persist canonical message and event state in Postgres
- use a DB-backed outbox plus lightweight wakeup or pub-sub fanout for multi-instance delivery
- do not treat in-memory WS hub state as the source of truth

### Tenant-side bridge

- long-running bridge process close to Gateway
- persistent outbound connection from tenant server to the Control Plane
- local access to OpenClaw Gateway WebSocket and runtime APIs
- media staging helpers for uploads and generated files

This bridge should remain a background process, not an HTTP request handler that tries to hold long-lived streaming state inline.

### OpenClaw integration

- custom channel plugin built with the OpenClaw channel plugin SDK
- plugin should use the normal channel responsibilities documented by OpenClaw:
  - config
  - session grammar
  - pairing/security if needed
  - outbound delivery
  - threading semantics
- OpenClaw block streaming should be enabled where helpful
- tenant bridge should also subscribe to Gateway `session.message`, `session.tool`, `sessions.changed`, and related events for richer browser sync than plugin block replies alone

## Implementation Rule

This spec should be implemented in vertical increments, not horizontal layer-by-layer batches.

For every increment, the implementing agent must read through the relevant existing data architecture before making schema, service, or transport changes.

At minimum, review:

- the current Control Plane schema in `web/src/db/schema.ts`
- the current Control Plane data access layer in `web/src/db/control-plane.ts`
- the current adjacent planning docs:
  - `TODO_14_session_history_visibility.md`
  - `TODO_06_integrations_and_oauth.md`
  - `TODO_17_managed_integrations_architecture.md`
  - `TODO_20_unified_frontend_and_hono_migration.md`
- the local OpenClaw repo at `/Users/michaelfrohlich/Repositories/openclaw`, especially:
  - channel plugin SDK docs
  - gateway protocol docs
  - streaming docs
  - the `qa-channel` reference implementation

This rule exists to keep each slice aligned with:

- existing normalization choices such as `tenant_sessions`, `integration_messaging_conversations`, and `user_channel_identities`
- the managed-runtime plugin packaging already used in this repo
- OpenClaw's actual channel, session, media, and streaming seams rather than guessed abstractions

Do not implement a slice by inventing parallel storage or transport concepts without first checking how the current repo already represents adjacent data.

## Product Model

### Conversation classes

The product should expose three top-level conversation classes:

- `open`
- `personal`
- `external_surface`

Non-Slack conversations may also be one of two lifecycle kinds:

- `ad_hoc`
- `durable_named`

This yields the practical user-facing combinations:

- open ad hoc conversation
- open durable named conversation
- personal conversation, including DMs
- external conversation such as Slack channel or Slack thread

### Sidebar behavior

The sidebar behaves like a ChatGPT-style history list, but it is multiplayer and workspace-wide by default.

The primary filters are:

- `All`
- `Open`
- `Mine`
- `Personal`

Filter rules:

- `All` includes chats, scheduled runs, webhook deliveries, and external surfaces visible to the user
- `Open` is the default view for shared workspace conversations
- `Mine` shows any conversation where the current user participated at least once
- `Personal` shows private conversations, including DMs

Recommended additional sidebar treatment:

- a pinned or favorites section above the main recency list
- durable named conversations should be pinnable or favoritable per user
- Slack threads should appear as separate items from Slack channel mainline history

### Durable named conversations

For non-Slack conversations, the system should support durable named conversations.

A durable named conversation is a long-lived workspace conversation with:

- a human-readable name
- a stable slug or external id
- normal visibility and participant semantics
- per-user favorite or pinned state
- eligibility as a delivery target for API calls, schedules, and webhooks

Examples:

- `founder-calls/acme`
- `portfolio/company-x`
- `research/voice-ai`
- `ops/incidents`

These should act as persistent context feeds for a topic, project, company, or workflow.

### Triggering and non-triggering input

Durable named conversations should support two inbound delivery modes:

- `triggering`
- `non_triggering`

Meaning:

- `triggering` appends the message and starts an Otto/OpenClaw run
- `non_triggering` appends the message to history only

This supports:

- cron jobs that deposit status updates without forcing a reply
- webhook events that should enrich context without generating a response
- imported transcripts or notes
- later explicit user prompts that ask Otto to use the accumulated context

## Canonical Data Model

The Control Plane should introduce conversation-native tables instead of relying on `tenant_sessions` as the primary user-facing model.

Recommended core tables:

- `conversations`
- `conversation_members`
- `conversation_participants`
- `conversation_messages`
- `conversation_message_parts`
- `conversation_attachments`
- `conversation_presence`
- `conversation_favorites`
- `conversation_event_log`
- `conversation_delivery_targets`
- `runtime_session_segments`
- `external_surface_bindings`

### Recommended `conversations` fields

- `id`
- `workspace_id`
- `kind` with values such as `ad_hoc`, `durable_named`, `external_surface`
- `visibility` with values such as `open`, `personal`
- `origin_kind` with values such as `otto_web`, `slack_channel`, `slack_thread`, `slack_dm`, `schedule`, `webhook`, `api`
- `name`
- `slug`
- `canonical_surface_key`
- `accepts_external_delivery`
- `default_delivery_mode`
- `created_by_user_id`
- `last_activity_at`
- `archived_at`
- `created_at`
- `updated_at`

### Recommended `conversation_members` fields

This table is for workspace access and membership semantics, not raw authoring history.

- `id`
- `conversation_id`
- `user_id`
- `membership_kind` with values such as `owner`, `member`
- `membership_source` with values such as `creator`, `manual`, `auto_join`, `dm_bootstrap`
- `is_muted`
- `last_read_message_id`
- `last_read_at`
- `created_at`
- `updated_at`

Use this table for:

- who can see a personal conversation
- who is explicitly a member of a durable named conversation
- who has joined or been added to an open workspace conversation
- sidebar filtering such as "conversations I belong to"

Do not use this table alone to answer "who actually participated" because some members may never send a message.

### Recommended `conversation_participants` fields

This table is the cheap participation projection used for "Mine" and "who was part of this conversation?" queries.

- `id`
- `conversation_id`
- `user_id` nullable
- `external_identity_provider` nullable
- `external_identity_id` nullable
- `first_message_id`
- `last_message_id`
- `first_participated_at`
- `last_participated_at`
- `message_count`
- `last_source_kind`
- `created_at`
- `updated_at`

Use this table for:

- "Mine" queries
- showing workspace users who have participated at least once
- showing external participants such as Slack users even when they are not mapped to workspace users
- fast participant chips and conversation-summary metadata

Recommended invariants:

- a workspace user participant row should use `user_id`
- an external-only participant row should use `external_identity_provider + external_identity_id`
- if an external identity later resolves to a workspace user, keep the external identifiers for provenance but backfill `user_id`

### Recommended `runtime_session_segments` fields

- `id`
- `conversation_id`
- `tenant_id`
- `runtime_session_key`
- `runtime_session_id`
- `channel`
- `origin_kind`
- `started_at`
- `ended_at`
- `metadata_json`
- `created_at`

The key rule is:

- one conversation may attach to many runtime session segments over time

### Recommended `conversation_delivery_targets` fields

- `id`
- `conversation_id`
- `target_type` such as `api`, `schedule`, `webhook`
- `target_key`
- `default_trigger_mode`
- `auth_scope`
- `enabled`
- `created_at`
- `updated_at`

### Recommended favorites model

Use a per-user table rather than a global boolean on `conversations`.

Recommended table:

- `conversation_favorites`
  - `conversation_id`
  - `user_id`
  - `created_at`

## Membership And Participation Rules

The Control Plane should distinguish three related but different concepts:

- visibility
- membership
- participation

### Visibility

Visibility is the broad access rule:

- `open` means workspace members can discover and open the conversation unless later product ACLs narrow that rule
- `personal` means only explicit members can see it

### Membership

Membership is the explicit workspace-user relationship captured in `conversation_members`.

Examples:

- the creator of a durable named conversation
- users explicitly included in a personal conversation or DM
- a teammate who has joined a previously open conversation

### Participation

Participation is actual message activity captured in `conversation_participants`.

Examples:

- a workspace user who sent one message months ago
- a Slack user who wrote in an imported thread
- an automation source that appended a webhook or scheduled-task event

### Query guidance

To answer "which workspace users were part of this conversation?" use `conversation_participants` first, then optionally join `users`.

To answer "who can access this conversation?" use `conversation_members` plus `visibility`.

To answer "which conversations belong in the `Mine` filter?" query by `conversation_participants.user_id = currentUserId`.

This split avoids expensive message-history scans while also avoiding incorrect answers from membership rows alone.

### V1 visibility simplification

For v1, the product should support only two visibility modes:

- `open`
- `personal`

`personal` is the umbrella visibility mode for:

- direct messages
- private ad hoc chats
- private durable named conversations

If later product requirements need a distinction between private group chats and direct messages, `personal` can be split into narrower visibility or subtype semantics without changing the broader conversation model.

## External Surface Reconciliation

This is the most important modeling problem after realtime fanout.

OpenClaw runtime sessions are not enough to define sidebar items because a single external surface can produce many runtime sessions over time.

The Control Plane should reconcile external activity by a stable `canonical_surface_key`.

Examples:

- Slack channel mainline:
  - `slack:<team_id>:channel:<channel_id>`
- Slack thread:
  - `slack:<team_id>:channel:<channel_id>:thread:<thread_ts>`
- Slack DM:
  - `slack:<team_id>:dm:<participant_set_hash>`
- durable named workspace conversation:
  - `workspace:<workspace_id>:conversation:<conversation_id>`

Reconciliation rule:

1. If a new event resolves to an existing `canonical_surface_key`, attach it to the existing conversation.
2. If not, create a new conversation.
3. Store raw runtime session segments separately for diagnosis and session-level views.

This prevents Slack channel history from fragmenting into multiple unrelated sidebar items just because OpenClaw rotated runtime sessions over time.

## Realtime And Streaming Model

The Control Plane should own the canonical browser realtime layer.

```text
Browser A ----\
               \
Browser B ------> Control Plane realtime hub ---> Postgres canonical state
               /
Browser C ----/
                      ^
                      |
                tenant bridge
                      ^
                      |
             OpenClaw Gateway + runtime
```

### Streaming recommendation

Use a hybrid model:

- `otto-workspace-chat` channel plugin for channel-native outbound delivery and block streaming
- tenant bridge subscription to Gateway session events for richer live state
- Control Plane browser fanout as the canonical multiplayer transport

Why:

- OpenClaw channel streaming is block-oriented, not true token-delta channel messaging
- the browser UI wants finer-grained progress, tool state, and reconnect replay semantics
- the Control Plane must be able to fan out the same live reply to multiple browsers in the same conversation

### Browser transport

Recommended Control Plane WebSocket event families:

- `conversation.subscribe`
- `conversation.unsubscribe`
- `conversation.snapshot`
- `message.send`
- `message.created`
- `message.part.delta`
- `message.completed`
- `message.failed`
- `run.status`
- `tool.event`
- `attachment.updated`
- `presence.updated`
- `typing.updated`
- `conversation.updated`

The browser should use HTTP for:

- initial page loads
- history pagination
- upload initialization
- conversation creation and rename
- favorite and settings mutations

The browser should use WebSocket for:

- live message streaming
- presence
- typing
- abort
- reconnect replay

### Tenant bridge transport

Recommended tenant bridge model:

- the bridge maintains one authenticated outbound connection to the Control Plane
- the Control Plane sends normalized commands to the bridge
- the bridge uses local Gateway connections for session injection and event subscription

Current implemented workspace-chat trigger model:

- `apps/api` queues `run_workspace_chat_turn` jobs in `job_runs`
- `apps/worker` POSTs the workspace event JSON to a gateway-authenticated tenant HTTP route owned by `otto-workspace-chat`
- `runtime-plugins/otto-workspace-chat` converts that posted event into a synthetic inbound channel event, runs it through OpenClaw's shared inbound reply pipeline, and posts delta/final callbacks back to the Control Plane

Recommended Control Plane to tenant bridge command families:

- `conversation.trigger_message`
- `conversation.append_message`
- `conversation.abort_run`
- `conversation.ensure_binding`
- `attachment.stage_request`

Recommended tenant bridge to Control Plane event families:

- `conversation.binding_ready`
- `runtime.segment_started`
- `runtime.segment_ended`
- `assistant.block`
- `assistant.delta`
- `tool.started`
- `tool.updated`
- `tool.completed`
- `run.completed`
- `run.failed`
- `external.message_observed`
- `attachment.ready`

## Dataflow

### 1. Otto-native shared chat

```text
Browser
  -> Control Plane: send message
  -> Control Plane: persist user message + broadcast optimistic event
  -> Control Plane: route command to tenant bridge
  -> tenant bridge: map conversation to stable OpenClaw session key
  -> tenant bridge: inject message into Gateway/OpenClaw
  -> OpenClaw: runs tools/model
  -> tenant bridge: subscribes to live Gateway/session events
  -> tenant bridge: relays normalized assistant/tool events
  -> Control Plane: persist canonical events and messages
  -> Control Plane: fan out live updates to every connected browser
```

### 2. Non-triggering delivery into a durable conversation

```text
Webhook / schedule / API
  -> Control Plane delivery target
  -> Control Plane: append message to conversation
  -> Control Plane: mark as non-triggering input
  -> no runtime run starts
  -> browser history updates immediately
```

### 3. Slack and external surface reconciliation

```text
Slack event
  -> Control Plane-owned Slack ingress
  -> tenant runtime / OpenClaw processing
  -> tenant bridge and/or reporter pushes normalized event upstream
  -> Control Plane resolves canonical_surface_key
  -> event attaches to existing Slack conversation
  -> runtime session segment stored separately
  -> browser sidebar shows one stable Slack conversation item
```

## `otto-workspace-chat` Channel Plugin Design

The dedicated channel plugin should make workspace chat a first-class OpenClaw channel without turning the plugin into the collaboration layer.

### Responsibilities

- define channel identity such as `otto-workspace-chat`
- resolve session routing for workspace conversations
- map incoming workspace messages into OpenClaw inbound context
- route outbound replies back to the tenant bridge
- preserve future reply-thread semantics when v2 threading arrives
- expose channel-specific streaming and outbound behavior

### Non-responsibilities

- browser session auth
- workspace membership and ACLs
- multiplayer browser presence
- canonical message archive
- conversation favorites
- external surface reconciliation

### OpenClaw SDK fit

The OpenClaw channel plugin SDK already aligns with this split:

- plugins own config, security, session grammar, outbound delivery, and threading
- core owns shared message tooling and dispatch
- channel plugins can define outbound session routing
- channel plugins can use block streaming

The `qa-channel` reference implementation in the local `openclaw` repo is a good starting pattern because it shows:

- `createChatChannelPlugin(...)`
- a long-running gateway account loop
- inbound mapping through `dispatchInboundReplyWithBase(...)`
- explicit outbound session route resolution

### Managed Otto recommendation

The preferred long-term implementation is:

- develop the plugin against the local `openclaw` repo
- bundle the compiled plugin into Otto's custom runtime image
- keep Control Plane-specific browser semantics outside the plugin

This should avoid a hard OpenClaw source fork unless SDK gaps prove otherwise.

## Upload Model

Uploads should be Control Plane-owned.

### File upload

1. Browser uploads to Control Plane-managed object storage.
2. Control Plane creates attachment rows.
3. Control Plane sends attachment references to the tenant bridge.
4. Tenant bridge stages media for OpenClaw consumption.
5. OpenClaw receives either staged local media or approved remote URLs, depending on runtime constraints.

### Voice upload

1. Browser uploads recorded audio to the Control Plane.
2. Control Plane stores original audio and attachment metadata.
3. The system may optionally pre-transcribe the audio in the Control Plane for low-latency UX.
4. The tenant bridge forwards transcript, audio, or both to OpenClaw.

Recommendation:

- support recorded voice upload in v1
- keep browser speech-to-text as an optional later UX layer, not the only voice path

### Outbound runtime-generated media

Browsers must never depend on runtime-local file paths.

Recommendation:

- tenant bridge should relay runtime-generated media into Control Plane-managed URLs before browser delivery

## UI Requirements

### Main workspace chat surface

- sidebar with conversation history
- filters for `All`, `Open`, `Mine`, and `Personal`
- a favorites or pinned area
- compact indicators for source, visibility, and live state
- open conversations should show that multiple workspace members can participate

### Conversation view

- single linear message flow in v1
- visible participant identity for multi-user conversations
- streamed assistant replies
- tool/progress lane or inline tool state
- upload composer for files and voice
- reconnect-safe replay of in-flight assistant responses

### External-surface treatment

- Slack threads should appear as separate conversation items
- Slack channel mainline history should reconcile to a single conversation where appropriate
- external conversations should be deep-linkable back to the original surface when available

### Durable named conversation affordances

- create and rename named conversations
- assign stable slug
- favorite or pin
- expose delivery-target settings
- show whether inbound automation messages are triggering or non-triggering

## Security And Permissions

- browser auth and workspace membership remain Control Plane-owned
- tenant runtimes must not be browser-facing
- uploads should use workspace-scoped authorization and signed URLs where needed
- tenant bridge authentication should use tenant-scoped Otto credentials, not shared browser tokens
- personal conversations must enforce private membership visibility in both history queries and realtime fanout
- open conversations should still obey workspace membership and any future finer-grained ACLs

## V1 Delivery Recommendation

Build this in two passes.

### Pass 1

- open workspace conversations
- personal conversations, including DMs
- multiplayer browser sync
- text chat
- streamed assistant replies
- file upload
- recorded voice upload
- durable named conversations
- favorites or pinned section
- triggering and non-triggering inbound delivery
- Slack conversation import into the same history model

### Pass 2

- richer tool streaming polish
- approvals
- interactive replies and buttons
- reactions and edits
- polls
- TTS playback and audio reply polish
- search and export
- richer analytics and audit surfaces

## Increment Plan

Implement this feature as thin end-to-end increments that each cross:

- workspace UI
- Control Plane backend
- tenant bridge
- OpenClaw integration
- storage

Do not defer the `otto-workspace-chat` channel plugin until the end. If the tenant runtime agent is what powers workspace conversations, then the plugin is part of the real architecture and should appear early.

### Increment 1: One open workspace conversation end to end

Goal:

- prove the browser -> Control Plane -> tenant bridge -> OpenClaw -> Control Plane -> browser loop with one real conversation

Includes:

- one `open` conversation
- one conversation detail UI
- one message composer
- one Control Plane send-message path
- one background worker trigger path into the tenant gateway
- one minimal `otto-workspace-chat` channel plugin
- one stable conversation-to-session-key mapping
- streamed assistant deltas over the existing workspace websocket path

Acceptance criteria:

- a user can open one workspace conversation and send a message
- the tenant runtime agent produces a response through the managed runtime path
- the response is persisted in the Control Plane
- reloading the page shows the same conversation history

Implementation note:

- before implementing this increment, read the current data architecture and confirm how `tenant_sessions`, `tenant_runtime_*`, and current OpenClaw session routing already work
- Increment 1 now has a first complete streamed path in code:
  - shared contracts, persisted `apps/api` conversation and message routes, worker-triggered tenant ingress, plugin-native `otto-workspace-chat` inbound-dispatch callbacks, and browser websocket fanout all exist
  - `apps/web` now has a first conversation route, detail page, message composer, and sidebar history section on the new app surface
  - browser updates now use the workspace-scoped websocket path for live assistant lifecycle and streamed text updates, with polling only as fallback elsewhere

### Increment 2: Shared history and sidebar

Goal:

- turn the single-conversation path into a usable workspace chat surface

Includes:

- conversation list
- `All`, `Open`, and `Mine` filters
- conversation title handling
- create new open conversation
- `conversation_members`
- `conversation_participants`
- last-message previews

Acceptance criteria:

- multiple open conversations can exist
- sidebar history is backed by persisted Control Plane state
- `Mine` is based on participation, not just membership

Implementation note:

- before implementing this increment, review how existing session and Slack list views query and present recency, ownership, and display labels

### Increment 3: Multiplayer realtime

Goal:

- allow multiple browsers to view and continue the same conversation live

Includes:

- Control Plane WebSocket layer
- conversation subscription model
- optimistic user-message fanout
- shared assistant lifecycle state
- reconnect replay

Acceptance criteria:

- two users can open the same open conversation
- one user sends a message and both browsers see it immediately
- both browsers stay in sync through assistant completion

Implementation note:

- before implementing this increment, review the planned conversation model and the OpenClaw gateway event surfaces that will later feed streaming and replay

### Increment 4: Streaming

Goal:

- support streamed assistant replies in the workspace UI

Includes:

- tenant bridge subscription to Gateway session events
- normalized runtime-to-Control-Plane stream events
- Control Plane browser fanout for streaming assistant state
- one assistant message lifecycle from `pending` to `streaming` to `completed`

Acceptance criteria:

- assistant replies stream into the workspace UI
- multiple browsers in the same conversation see the same stream
- final assistant content is persisted exactly once

Implementation note:

- plugin-level block streaming is useful, but browser-grade streaming should still be designed against OpenClaw Gateway session events

### Increment 5: Personal conversations

Goal:

- add private conversations without changing the core architecture

Includes:

- `visibility = personal`
- personal conversation creation
- `Personal` filter
- stricter membership enforcement
- stricter realtime fanout rules

Acceptance criteria:

- personal conversations are visible only to explicit members
- open and personal conversations coexist in one model
- multiplayer still works correctly inside allowed personal conversations

Implementation note:

- before implementing this increment, review `conversation_members`, `conversation_participants`, and existing workspace membership/auth assumptions in the repo

### Increment 6: Durable named conversations

Goal:

- add long-lived context feeds with stable names and slugs

Includes:

- `kind = durable_named`
- slug
- rename
- favorite or pin
- dedicated delivery-target configuration
- triggering and non-triggering input

Acceptance criteria:

- a user can create a durable named conversation
- it can be favorited or pinned
- it can accept non-triggering context input
- it can later be resumed as a normal collaborative conversation

Implementation note:

- before implementing this increment, review how existing scheduled-task and webhook-adjacent flows are modeled so delivery targets fit the broader Control Plane architecture

### Increment 7: File upload

Goal:

- support browser file attachments in conversations

Includes:

- Control Plane-managed attachment storage
- attachment metadata rows
- tenant bridge media staging
- message parts for file and image attachments

Acceptance criteria:

- a user can attach a file to a conversation message
- the runtime can consume the attachment
- all connected browsers in the conversation can see it

Implementation note:

- before implementing this increment, review OpenClaw media context fields and outbound media handling so attachment modeling aligns with runtime expectations

### Increment 8: Voice upload

Goal:

- support recorded voice input in workspace conversations

Includes:

- browser audio upload
- attachment representation for audio
- transcript fallback path
- tenant bridge media handoff

Acceptance criteria:

- a user can upload recorded audio
- the tenant runtime agent can respond from that input
- audio and transcript metadata are preserved in the conversation model

Implementation note:

- before implementing this increment, review the existing runtime audio-transcription path and OpenClaw `Transcript` and media-understanding seams

### Increment 9: Slack and external-surface reconciliation

Goal:

- unify workspace-native and Slack-derived history in one conversation model

Includes:

- `external_surface` conversations
- canonical surface key resolution
- Slack channel and Slack thread mapping
- participant projection from external identities
- linkage back to the original Slack surface

Acceptance criteria:

- Slack threads appear as distinct conversation items
- repeated runtime sessions in one Slack surface attach to the same workspace conversation
- runtime session fragmentation is hidden from the primary history list

Implementation note:

- before implementing this increment, review `integration_messaging_conversations`, Slack ingress architecture, and current identity-resolution tables

### Increment 10: Automation delivery into conversations

Goal:

- let schedules, webhooks, and APIs target conversations directly

Includes:

- `conversation_delivery_targets`
- append-only non-triggering deliveries
- append-and-run triggering deliveries
- delivery target settings
- audit trail

Acceptance criteria:

- schedules, webhooks, or APIs can write into a durable conversation
- non-triggering deliveries append context without starting a run
- triggering deliveries append context and start a run

Implementation note:

- before implementing this increment, review current job, scheduled-task, and webhook data flows so conversation delivery targets reuse existing operational patterns where they fit

## Acceptance Criteria

- the workspace app provides a browser chat surface that does not depend on OpenClaw WebChat
- browsers connect only to the Control Plane, not directly to tenant Gateway instances
- multiple users can watch and continue the same shared conversation in real time
- assistant replies stream to multiple browsers in the same conversation
- non-Slack conversations can be promoted to durable named conversations with names, slugs, and favorites or pinned state
- durable named conversations can receive API, schedule, and webhook deliveries in either triggering or non-triggering mode
- one workspace conversation can accumulate many runtime session segments without fragmenting the sidebar
- Slack threads appear as distinct conversation items while channel mainline activity can reconcile into a stable surface conversation
- files and recorded voice uploads can be attached from the browser and consumed in runtime execution
- runtime-generated media shown in the workspace is available through Control Plane-managed URLs rather than runtime-local paths
- the `otto-workspace-chat` channel plugin can route workspace-originated turns through OpenClaw without requiring direct browser-to-Gateway connectivity

## Status Checklist

- [x] decide that the workspace app replaces OpenClaw WebChat for browser chat
- [x] decide that the Control Plane owns canonical conversation state
- [x] decide that one conversation may contain many runtime session segments
- [x] decide that durable named conversations are first-class product objects
- [x] decide that durable named conversations can receive triggering and non-triggering deliveries
- [x] decide that the tenant server remains the runtime-side bridge
- [x] decide that a dedicated `otto-workspace-chat` OpenClaw channel plugin is the preferred runtime seam
- [ ] define the Control Plane conversation schema and DB access layer
- [ ] define the browser realtime protocol
- [~] define the tenant bridge protocol and auth model
- [x] implement the Control Plane conversation history and conversation detail routes
- [x] implement the first `apps/web` conversation route and detail page at `/{workspaceSlug}/c/{conversationId}`
- [ ] implement Control Plane browser fanout and replay
- [ ] implement durable named conversation create, rename, favorite, and delivery-target flows
- [ ] implement Slack and external surface reconciliation onto conversations
- [ ] implement the `otto-workspace-chat` OpenClaw channel plugin
- [~] bundle the plugin and tenant bridge into the Otto-managed runtime image

## Open Questions

- Should v1 use one active run per conversation with steering, or queue multiple user sends when two teammates speak at once?
- Should the first browser realtime implementation use one workspace-level socket with per-conversation subscriptions, or one direct conversation-scoped socket namespace?
- Should voice upload default to Control Plane transcription first, runtime transcription first, or a provider-configurable fallback order?
- Should durable named conversation slugs be workspace-global or namespaced by conversation kind?
- Should Slack channel mainline history always reconcile into one durable conversation, or should the UI offer a sessions-oriented split view when the channel becomes too large?
- Does any required browser-grade streaming detail still force a small OpenClaw core change, or is the plugin plus Gateway event model sufficient as-is?
