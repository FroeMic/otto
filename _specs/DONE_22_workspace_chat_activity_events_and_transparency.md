# DONE 22: Workspace Chat Activity Events And Transparency

## Goal

Expose the assistant's runtime activity in workspace chat so users can see what Otto is doing while a reply is streaming and inspect that same activity later when they reopen an old conversation.

This slice should give workspace chat the next level of messaging-surface parity with Slack and align the workspace UI with the core Agent Interaction Guidelines principles of:

- providing instant feedback
- being clear and transparent about internal state
- inhabiting the platform natively

Reference:

- [Linear Agent Interaction Guidelines](https://linear.app/developers/aig)

## Scope

- add a canonical activity-event model attached to assistant messages in workspace chat
- persist live runtime activity events in the Control Plane while a workspace chat turn is running
- replay the same canonical activity events when loading historic conversations
- expose activity events over the existing workspace websocket fanout
- render a first collapsed activity lane beneath assistant messages in `apps/web`
- normalize a small first-pass set of runtime events from OpenClaw into stable workspace event types

Out of scope for this slice:

- replacing the existing assistant text delta/completion path
- exposing raw transcript JSONL directly in the chat UI
- full transcript/session-history UI redesign
- Slack live activity parity on day one
- per-token or provider-specific reasoning trace rendering
- a generic event bus for every runtime surface in the product

## Dependencies

- `TODO_14_session_history_visibility.md`
- `TODO_21_workspace_multiplayer_chat_and_web_channel.md`

## Decision Summary

- Keep `workspace_chat_messages` focused on what Otto said, not how Otto got there.
- Add a sibling canonical activity-event model attached to the assistant message.
- Use plugin-emitted live callbacks for workspace chat.
- Use the same canonical event shape for later reconciliation from Slack and other surfaces.
- Keep raw runtime transcript/session storage separate for diagnostics and historic playback.
- Start with a narrow normalized vocabulary: lifecycle, item/progress, tool, approval, and optional command output.
- Treat raw thinking traces as optional and collapsed by default if exposed at all.

## Why This Slice Exists

The current workspace chat path already supports:

- tenant-local channel execution
- assistant placeholder lifecycle
- canonical text streaming
- realtime browser fanout

What it does not yet support is transparent runtime progress.

Today the browser can see only:

- queued
- running
- failed
- completed
- cumulative assistant text

That is enough for a basic chat surface, but not enough for a high-trust agent surface. Users should be able to tell at a glance whether Otto is:

- thinking
- calling tools
- waiting on approval
- executing a command
- finished

and, when useful, inspect those details without leaving the conversation.

## Why Not Put This In `message.parts`

The existing message-part model is intentionally content-oriented:

- `text`
- `file`
- `audio`

That is the right model for the assistant reply itself, but the wrong model for:

- `tool.started`
- `tool.completed`
- `approval.requested`
- `item.updated`
- `command_output.delta`

If we overload `message.parts` with runtime activity, we create three problems:

1. the final assistant reply becomes harder to reason about
2. live/runtime state gets mixed with durable content
3. later Slack and transcript reconciliation become awkward because the data model is content-shaped, not activity-shaped

The cleaner design is:

```text
conversation
  -> messages
    -> assistant message
      -> activity events
```

## Recommended Architecture

Use a second canonical stream attached to the assistant message.

```text
Browser
  -> apps/api: create user message + assistant placeholder
  -> apps/worker: deliver workspace event to tenant
  -> otto-workspace-chat plugin: accept ingress and start turn
  -> otto-workspace-chat plugin: subscribe to runtime activity events
  -> plugin: POST assistant text deltas/completion/failure to apps/api
  -> plugin: POST normalized assistant activity events to apps/api
  -> apps/api: persist canonical message + event state
  -> apps/api websocket fanout: publish both to browsers
  -> apps/web: render assistant bubble + collapsed activity lane
```

This keeps ownership boundaries coherent:

- `otto-workspace-chat` owns tenant-side runtime observation and emission
- `apps/api` owns canonical persistence and browser fanout
- `apps/web` owns rendering

## Data Model

Add a new table:

- `workspace_chat_message_events`

Recommended fields:

- `id`
- `tenant_id`
- `conversation_id`
- `message_id`
- `runtime_segment_id` nullable
- `session_key`
- `run_id` nullable
- `sequence`
- `event_type`
- `item_id` nullable
- `status` nullable
- `title` nullable
- `summary` nullable
- `payload_json`
- `created_at`
- `updated_at`

Recommended constraints and indexes:

- unique `(message_id, sequence)`
- index `(conversation_id, created_at)`
- index `(message_id, sequence)`
- index `(message_id, item_id)` where `item_id` is not null

### Event Shape

Each stored event should be normalized to a small Otto-owned shape, for example:

```json
{
  "assistantMessageId": "msg_123",
  "conversationId": "conv_123",
  "sessionKey": "agent:main:otto-workspace-chat:channel:workspace:conv_123",
  "sequence": 7,
  "event": {
    "type": "tool.updated",
    "itemId": "tool_call_1",
    "status": "running",
    "title": "Read file",
    "summary": "Reading AGENTS.md",
    "payload": {
      "toolName": "read_file",
      "path": "/repo/AGENTS.md"
    }
  }
}
```

### First-Pass Event Vocabulary

Start with:

- `lifecycle.started`
- `lifecycle.completed`
- `lifecycle.failed`
- `item.started`
- `item.updated`
- `item.completed`
- `item.failed`
- `tool.started`
- `tool.updated`
- `tool.completed`
- `tool.failed`
- `approval.requested`
- `approval.resolved`
- `command_output.delta`
- `command_output.completed`

Do not require raw thinking storage in v1.

If thinking is surfaced later, keep it optional and collapsed by default:

- `thinking.started`
- `thinking.delta`
- `thinking.completed`

## Runtime Source Of Truth

For workspace chat, the plugin should observe native OpenClaw runtime events using:

- `api.runtime.events.onAgentEvent(...)`
- optionally `api.runtime.events.onSessionTranscriptUpdate(...)` for reconciliation support or transcript-linked metadata

The concrete runtime seam already exists in OpenClaw and exposes structured streams such as:

- `item`
- `tool`
- `approval`
- `command_output`
- `thinking`
- `lifecycle`

That means `otto-workspace-chat` can emit canonical workspace activity events today without scraping logs or inventing a second runtime bridge.

## Live Streaming Behavior

### During a running turn

Once tenant ingress accepts the event:

1. the plugin computes the accepted `sessionKey`
2. the plugin starts the shared inbound reply pipeline
3. the plugin subscribes to runtime agent events for the accepted run/session
4. the plugin sends two callback streams to `apps/api`

Callback stream A:

- assistant text delta
- assistant completion
- assistant failure

Callback stream B:

- assistant activity events

The browser then receives interleaved canonical websocket updates:

- `conversation.message_upserted`
- `conversation.message_event_upserted`

The UI should render those as:

- the main assistant bubble continuing to stream text
- a compact activity lane beneath it that updates in place

### Important behavior rule

Do not treat every runtime event as a new visible row.

For stateful items:

- one `tool.started` card becomes one `tool.completed` card
- one `approval.requested` card becomes one `approval.resolved` card
- one `item.started` progress item becomes one `item.completed` item

That means the persisted log can stay append-oriented while the UI reduces it into stable item state.

## Historic Conversation Loading

Old chat loading should use the same canonical data model as live streaming.

When loading a conversation detail response, the Control Plane should return:

- conversation
- messages
- message activity events

This can be embedded per message or side-loaded by message id. The first implementation may choose whichever shape is simpler for `apps/api` and `apps/web`.

The important rule is:

- historic replay must not depend on reconnecting to the tenant runtime
- historic replay must not require parsing raw session transcript JSONL in the browser

So an old assistant message should load with:

- final content
- persisted activity events

and render the same collapsed activity lane that the user would have seen live.

## Relationship To Session History

This slice does not replace `TODO_14`.

Keep two different layers:

### Workspace chat activity events

- curated
- normalized
- attached to a workspace assistant message
- optimized for live chat transparency and historic chat replay

### Session transcripts

- raw
- complete
- OpenClaw-shaped
- optimized for diagnostics, audit, and session inspection

The chat UI should render the first.
The session-history UI should render the second.

That separation keeps the chat surface simple and lets `TODO_14` continue to store faithful transcript history without forcing that raw model into the main conversation UI.

## Slack And Other External Surfaces

Do not require Slack to emit the full activity stream live in v1.

Instead, design this canonical event model so it can be populated by two ingestion paths:

1. live plugin callbacks from workspace chat
2. later reconciliation from session logs/transcript updates for Slack and other external surfaces

That means the canonical event shape must be surface-agnostic.

Good:

- `tool.started`
- `tool.completed`
- `approval.requested`

Bad:

- `workspace.delta.callback`
- `slack_tool_row`

This keeps the model reusable across:

- workspace chat
- Slack
- future external channels

## API Shape

Add runtime-authenticated routes such as:

- `POST /api/internal/runtime/workspace-chat/messages/events/upsert`

Possible follow-on:

- `POST /api/internal/runtime/workspace-chat/messages/events/batch`

The route should:

- authenticate the tenant runtime
- validate payload shape with Zod
- upsert or append canonical activity events
- return the affected `messageId`, `conversationId`, and `tenantId`
- fan out a websocket update after the DB write succeeds

Add conversation-detail read support so the browser can fetch historic activity events together with messages.

## Websocket Shape

Add a new typed websocket event family, for example:

- `conversation.message_event_upserted`

Payload should contain:

- `conversationId`
- `messageId`
- normalized event record

This should be best-effort fanout just like the existing canonical message updates.

## UI Shape

Render a second lane attached to the assistant message bubble.

First implementation recommendation:

- collapsed by default
- shows active/high-signal items only
- expands to reveal the full event list for that assistant message

Preferred visible categories:

- current task or progress item
- active tool calls and final tool results
- pending approvals
- final failure reason if present

Optional later categories:

- command output panels
- raw thinking traces

The main product goal is transparency at a glance, not transcript dumping.

## Recommended Increment Order

### Increment 1: Canonical event substrate

- add `workspace_chat_message_events`
- add write-side runtime callback route
- add read-side conversation-detail support
- add websocket event type

### Increment 2: Workspace live runtime emission

- subscribe to `onAgentEvent(...)` in `otto-workspace-chat`
- normalize lifecycle, item, tool, and approval events
- persist them through the new callback route

### Increment 3: Browser rendering

- update `apps/web` conversation detail cache to hold message events
- render a collapsed activity lane under assistant messages
- reduce repeated events into stable item cards in the UI

### Increment 4: Historic replay polish

- ensure old conversations load and render activity events deterministically
- tune ordering, collapsing, and reconnect behavior

### Increment 5: Optional richer event classes

- command output streaming
- carefully-scoped thinking visibility
- Slack/session-log reconciliation into the same event model

## Acceptance Criteria

- a live workspace chat turn shows more than text-only progress in the browser
- the browser receives canonical activity-event updates over the existing websocket path
- reloading the conversation during or after a turn reconstructs the same activity lane from stored state
- historic conversations render persisted assistant activity without requiring a runtime connection
- assistant message content remains separate from assistant activity state
- tool and approval updates can be rendered as stable in-place UI items rather than only as append-only text
- the canonical event schema is reusable by later Slack/session-log reconciliation

## Status Checklist

- [ ] define canonical activity-event DB schema and migration
- [ ] define shared request/response contracts in `packages/features/workspace-chat`
- [ ] add runtime-authenticated callback route in `apps/api`
- [ ] persist and query activity events in `apps/api`
- [ ] fan out websocket activity events from `apps/api`
- [ ] emit normalized runtime activity events from `otto-workspace-chat`
- [ ] render collapsed assistant activity lane in `apps/web`
- [ ] verify historic replay from persisted events
- [ ] document later Slack/session-log reconciliation path against the same event model

## Open Questions

- Should the first browser payload embed events per message or side-load them by message id?
- Should `command_output.delta` be persisted in v1, or should command output wait until after tool/item cards ship?
- Do we want to expose raw `thinking.*` events in the workspace chat UI at all, or keep them only for deeper inspection/debug views?
- Should the write API be single-event upsert first, or do we want to start with a small batch endpoint immediately?
