# TODO 14: Session History Visibility

## Goal

Expose tenant runtime session history in the Otto workspace so users can inspect historic sessions and understand what Otto actually did, including the full transcript trace for each session.

## Scope

- add a real sessions area under the org-scoped app shell
- show historic tenant runtime sessions for the org's primary tenant
- persist session metadata and full transcript content in the control plane
- keep control-plane session state current through runtime-originated callbacks
- repair dropped callback gaps with a narrow reconciliation job
- surface stale-sync and sync-error states in the UI

Out of scope for this slice:

- editing or deleting runtime session history from the workspace
- cross-tenant or operator-global session search
- live tailing in the browser over a direct runtime websocket
- transcript summarization, retention policies, or object-storage archival

## Dependencies

- `TODO_05_config_apply_and_reconciliation.md`
- `TODO_07_operations_and_observability.md`
- `TODO_09_ui_app_shell_and_onboarding_rebuild.md`
- `TODO_12_runtime_dashboard_access.md`

## Decision summary

- Store full session transcripts in the control plane.
- Use an Otto-owned runtime plugin as the primary sync path.
- Use reconciliation only to repair gaps, not as the main integration model.
- Persist one row per session in Postgres with the full transcript JSONL on that row.
- Do not build a per-message relational transcript table in v1.

## Review of the options

### Rejected: periodic SSH/file scraping as the main mechanism

This would work, but it makes Otto depend on runtime-local file layout as the primary API and keeps the UI stale by design. It also conflicts with the existing direction already captured for scheduled tasks: runtime callbacks first, reconciliation second.

### Rejected: persistent control-plane websocket subscriptions to every tenant runtime

OpenClaw already emits websocket session events, but that would force the control plane to manage long-lived per-tenant connections, reconnect state, and event-loss handling. That is operationally heavier than needed for historic session visibility.

### Rejected: per-message relational storage as the primary data model

A `tenant_session_messages` table would make SQL querying easier, but it couples Otto tightly to OpenClaw's transcript schema, increases write amplification, and complicates compaction or transcript rewrites. The first requirement here is faithful playback in the workspace, not analytical querying.

### Recommended

Ship an Otto-owned runtime plugin that:

- listens to `session_start` and `session_end` hooks for lifecycle boundaries
- listens to `api.runtime.events.onSessionTranscriptUpdate(...)` for transcript changes
- posts batched session updates to the control plane through a runtime-authenticated internal API using the existing bearer-token model
- maintains a small local spool on disk so transient control-plane failures do not block or lose runtime events

The control plane should store the full transcript as raw JSONL text on the session row and render that trace in the workspace. A periodic reconciliation job should read session files only to backfill missed updates or repair divergence after restarts, compaction rewrites, or temporary network failures.

That is the recommendation. The runtime plugin is the primary integration. Reconciliation exists only as repair.

## Why this is the right default

OpenClaw already exposes the two seams this needs:

- plugin hooks for `session_start` and `session_end`
- runtime event subscription for `onSessionTranscriptUpdate`

Otto already has the matching control-plane pattern:

- runtime-authenticated internal routes using `authenticateTenantRuntimeRequest`
- Otto-owned runtime plugins that call back into the workspace app

So the clean path is to extend the pattern Otto already uses rather than inventing a new control-plane transport.

## Proposed sync model

### Runtime plugin

Add a new runtime plugin such as `otto-session-reporter`.

Responsibilities:

- create or update a control-plane session record when a session starts
- append transcript changes as they happen
- mark the session terminal state when it ends
- persist a local spool of pending outbound updates under the runtime state directory
- retry failed control-plane sends in the background

### Event model

The plugin should send one explicit batch endpoint payload to the control plane:

```json
{
  "events": [
    {
      "type": "session_started",
      "sessionKey": "slack:u123:default",
      "sessionId": "2dc3c2d0-6e7d-4d36-8bb1-1af2c9f6ab77",
      "startedAt": "2026-04-03T10:12:03.000Z"
    },
    {
      "type": "transcript_appended",
      "sessionKey": "slack:u123:default",
      "messageId": "msg_123",
      "jsonlLines": [
        "{\"role\":\"user\",\"content\":[{\"type\":\"text\",\"text\":\"check deploy status\"}]}"
      ],
      "messageCount": 1,
      "lastActivityAt": "2026-04-03T10:12:05.000Z"
    },
    {
      "type": "session_ended",
      "sessionKey": "slack:u123:default",
      "status": "done",
      "endedAt": "2026-04-03T10:12:42.000Z",
      "runtimeMs": 39000,
      "messageCount": 14
    }
  ]
}
```

Implementation notes:

- on normal incremental transcript updates, the plugin should append only new JSONL lines
- on transcript rewrite or compaction detection, the plugin should send a full snapshot event instead of a delta
- the control plane should accept both append events and full-snapshot replacement events

### Reconciliation

Add a periodic worker job such as `reconcile_tenant_sessions`.

Responsibilities:

- inspect recent runtime session files for the tenant
- backfill sessions that never reached the control plane
- repair stale terminal status if the runtime callback was missed
- repair transcript divergence by comparing content hash or transcript size
- mark sync state as stale or failed when the runtime cannot be reached

This job is not the source of truth and not the main feed. It is strictly a repair path.

## Database model

Create one control-plane table for session history:

- `tenant_sessions`
  - `id`
  - `tenant_id`
  - `session_key`
  - `external_session_id`
  - `status`
  - `started_at`
  - `ended_at`
  - `runtime_ms`
  - `message_count`
  - `channel`
  - `account_id`
  - `conversation_id`
  - `sender_id`
  - `parent_session_key`
  - `spawn_depth`
  - `subagent_role`
  - `model`
  - `model_provider`
  - `input_tokens`
  - `output_tokens`
  - `total_tokens`
  - `estimated_cost_usd`
  - `last_activity_at`
  - `transcript_jsonl`
  - `transcript_sha256`
  - `last_message_preview`
  - `session_updated_at`
  - `last_synced_at`
  - `last_sync_error`
  - `sync_state`
  - `sync_source`
  - `created_at`
  - `updated_at`

Recommended constraints and indexes:

- unique `(tenant_id, session_key)`
- index `(tenant_id, started_at desc)`
- index `(tenant_id, status)`
- index `(tenant_id, sync_state)`
- index `(tenant_id, parent_session_key)`

### Strong schema recommendation

Use `transcript_jsonl text` as the canonical stored transcript format.

Do not add a `tenant_session_messages` table in v1.

Reasons:

- it preserves the runtime transcript format Otto is already consuming
- Postgres TOAST compression is good enough for this size class
- appending or replacing one transcript blob is simpler than maintaining hundreds of child rows
- OpenClaw compaction and transcript rewrite flows are easier to model as replace-the-blob operations

If later we need search or analytics, add a derived indexing table then. Do not make v1 harder to support hypothetical future queries.

## Field semantics

- `session_key` is the natural external key for control-plane upserts
- `external_session_id` stores the OpenClaw session UUID when available
- `status` should use runtime-facing values such as `running`, `done`, `failed`, `killed`, `timeout`
- `transcript_sha256` lets reconciliation skip unchanged sessions
- `sync_state` should distinguish `current`, `stale`, and `sync_failed`
- `sync_source` should distinguish `callback` and `reconciliation`

## Metadata capture strategy

Not every useful field is exposed by one OpenClaw callback. Use the following source priority:

1. runtime plugin lifecycle hooks for `sessionId`, `sessionKey`, timestamps, and terminal state
2. transcript-update callbacks for appended transcript content
3. `before_dispatch` or similar inbound hooks for channel/session envelope fields such as `channelId`, `accountId`, `conversationId`, and `senderId`
4. reconciliation reads for any metadata that was missed transiently

This keeps the main design on public plugin/runtime seams and limits file-based repair to the reconciliation path.

## Control-plane API shape

Add runtime-authenticated routes under:

- `POST /api/internal/runtime/sessions/batch`
- optionally `POST /api/internal/runtime/sessions/reconcile`

The batch route should:

- authenticate the tenant with the runtime gateway bearer token
- validate event payload shape with Zod
- upsert `tenant_sessions` by `tenant_id + session_key`
- apply transcript append or replacement semantics atomically
- update sync health fields on each successful write

## UI shape

Keep one primary nav item: `Sessions`.

Within that area, add route-backed tabs or subroutes for:

- `History`
- `Detail`

### History view

Purpose:

- answer "what has Otto done recently?"
- answer "which sessions failed?"
- answer "is the runtime sync healthy?"

Initial content:

- summary badges for `Running`, `Failed`, `Sync failed`, and `Stale`
- a reverse-chronological table with:
  - session key or derived title
  - started
  - status
  - runtime
  - last activity
  - message count
  - sync state

### Detail view

Purpose:

- answer "what exactly happened in this session?"

Initial content:

- full transcript rendered from `transcript_jsonl`
- visible tool calls and tool results as first-class transcript items
- session metadata header with status, times, model, and token usage when available
- inline warning if the transcript is stale or the last sync failed

## Loading strategy

- keep sessions data out of shared shell loaders
- load history and detail on dedicated session routes
- keep the first slice server-rendered and `force-dynamic`
- use manual refresh before adding live client polling

## Acceptance criteria

- an unlocked organization can open the sessions area and see non-placeholder historic session rows
- a user can open one session and inspect the full transcript trace in the workspace
- the control plane remains usable when the tenant runtime is offline because last-known session data is stored centrally
- runtime-originated session updates can be written through an authenticated internal API
- dropped callbacks do not silently erase history because reconciliation repairs gaps and the UI surfaces stale/sync-failed state

## Status checklist

- [x] decide that full session transcripts should be stored in the control plane
- [x] choose the runtime plugin as the primary sync mechanism
- [x] define the control-plane table shape
- [x] define the callback and reconciliation model
- [x] define the workspace UI shape
- [ ] add the schema and DB access layer
- [ ] add the runtime-authenticated session callback endpoint
- [ ] implement the `otto-session-reporter` runtime plugin
- [ ] add the reconciliation worker job
- [ ] replace the sessions placeholder route with real history and detail views

## Open questions

- Should the first UI title use raw `session_key` strings, or should Otto derive a user-facing label server-side from channel and sender metadata?
- Should transcript updates be posted immediately per message, or batched on a short timer such as 1 to 3 seconds?
- Do we want a later retention policy for very old transcripts, or should v1 keep all transcript history in Postgres indefinitely?
