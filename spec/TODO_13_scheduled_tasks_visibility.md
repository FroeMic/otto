# TODO 13: Scheduled Tasks Visibility

## Goal

Expose scheduled task definitions and scheduled task sessions in the Otto control plane, with one clear source of truth for schedules and one clear sync model for keeping execution state current.

## Scope

- add a real scheduled-tasks area under the org-scoped app shell
- show the current scheduled task definitions for the org's primary tenant
- show recent scheduled task sessions with run status and timestamps
- persist canonical scheduled task data in the control plane instead of treating the tenant runtime as the only copy
- define how scheduled tasks are synced to the tenant runtime and how session updates come back
- surface stale-sync and sync-error states in the UI

Out of scope for this slice:

- create/edit/delete scheduled tasks from the Otto UI
- importing arbitrary runtime-local cron state by scraping the VPS or the OpenClaw dashboard
- full task output inspection or transcript browsing
- cross-tenant or operator-global automation views

## Dependencies

- `TODO_05_config_apply_and_reconciliation.md`
- `TODO_07_operations_and_observability.md`
- `TODO_09_ui_app_shell_and_onboarding_rebuild.md`
- `TODO_12_runtime_dashboard_access.md`

## Decision summary

- The control plane should own scheduled task definitions and scheduled task session history.
- The tenant runtime should be the execution target, not the only system of record.
- Do not read "cronjobs" by SSHing into the VPS, scraping runtime-local files, or treating the runtime dashboard as the canonical API.
- Keep the scheduled-tasks payload out of the shared `DashboardOrganization` shell data and load it only on scheduled-tasks routes.

## Why this should be the default direction

The repo already treats Slack installation state, managed bootstrap files, and runtime config surfaces as control-plane-owned data that is projected onto the tenant runtime. Scheduled tasks fit the same model better than a runtime-owned model.

If the runtime is the only source of truth:

- the UI goes blind when the runtime is offline
- local runtime edits create silent drift the control plane cannot explain
- task history becomes hard to reconcile with control-plane jobs and onboarding state
- importing current schedules becomes a brittle scraping problem instead of a typed API contract

If the control plane owns the data:

- the UI can always show the last known task and session state
- sync failures become diagnosable control-plane events
- runtime callbacks can update session state without changing ownership
- later edit/create flows can reuse the same optimistic-concurrency and apply patterns already used for runtime config surfaces

## Proposed data model

Add two control-plane tables for the org's primary tenant:

- `tenant_scheduled_tasks`
  - `id`
  - `tenant_id`
  - `task_key`
  - `name`
  - `description`
  - `status` such as `active`, `paused`, `deleted`, `sync_failed`
  - `schedule_kind` such as `cron`
  - `schedule_expression`
  - `timezone`
  - `external_task_id` for the runtime-side identifier when one exists
  - `next_run_at`
  - `last_run_at`
  - `last_synced_at`
  - `last_sync_error`
  - `config_version`
  - `created_by_type`
  - `created_by_external_id`
  - `updated_by_type`
  - `updated_by_external_id`
  - `created_at`
  - `updated_at`
- `tenant_scheduled_task_sessions`
  - `id`
  - `tenant_scheduled_task_id`
  - `tenant_id`
  - `external_session_id`
  - `trigger_type` such as `scheduled`, `manual`, `retry`
  - `scheduled_for`
  - `started_at`
  - `finished_at`
  - `status` such as `queued`, `running`, `succeeded`, `failed`, `canceled`
  - `summary`
  - `error`
  - `created_at`
  - `updated_at`

Implementation note:

- Keep this separate from `job_runs`.
- `job_runs` should continue to track control-plane worker activity such as provisioning, apply, or future sync jobs.
- Scheduled task sessions are user-facing runtime work, not worker-internal orchestration rows.

## Sync model

### Source of truth

The control plane owns the canonical schedule definitions.

That means:

- new tasks are created in the control plane first
- task edits update control-plane rows first
- pause/resume changes update control-plane rows first
- the runtime receives a projected copy

### Push path

When a scheduled task changes:

1. persist the new task definition in the control plane
2. enqueue a dedicated sync job such as `sync_tenant_scheduled_tasks`
3. have the worker push the projected task definitions to the tenant runtime through one explicit boundary:
   - either a runtime-authenticated internal API
   - or a versioned file projection plus runtime restart/reload if the upstream runtime only supports file-based loading
4. update `last_synced_at`, `last_sync_error`, and any `external_task_id` mapping returned by the runtime

### Session updates

The runtime should report session lifecycle changes back to the control plane through an authenticated internal API, similar to the existing managed-config and runtime-config-surface pattern.

Recommended runtime callback events:

- session created / queued
- session started
- session succeeded
- session failed
- session canceled

The control plane should upsert sessions by `tenant_id + external_session_id`.

### Reconciliation

Callbacks alone are not enough. Add a periodic reconciliation job that:

- confirms the runtime still has the expected task definitions
- refreshes `next_run_at` and task status if the runtime computes them
- repairs missing or stale session terminal states if callbacks were dropped
- marks task sync state as stale or failed when the runtime cannot be reached

This should be a narrow reconciliation job, not a broad SSH scrape of cron state.

## OpenClaw integration findings

Reviewing the current OpenClaw runtime and UI code clarified which seams already exist and which do not.

What OpenClaw already gives us:

- typed Gateway methods for cron definitions and run history:
  - `cron.status`
  - `cron.list`
  - `cron.add`
  - `cron.update`
  - `cron.remove`
  - `cron.run`
  - `cron.runs`
- persisted runtime-side storage behind those methods:
  - cron definitions in `~/.openclaw/cron/jobs.json`
  - run history in `~/.openclaw/cron/runs/<jobId>.jsonl`
- per-run history entries that already include:
  - `jobId`
  - `jobName`
  - `status`
  - `summary`
  - `deliveryStatus`
  - `sessionId`
  - `sessionKey`
- UI precedent in OpenClaw itself for linking a cron run back to the run session via `sessionKey`

Important limitation:

- OpenClaw does not currently expose one general plugin hook or runtime event that fires for every cron mutation performed through all surfaces such as the runtime UI, CLI, and direct Gateway RPC calls.
- Plugins can observe:
  - agent/tool lifecycle such as `after_tool_call`
  - agent event streams
  - session lifecycle hooks
  - transcript update events
- that is enough to react quickly to some agent-originated cron changes and run sessions, but not enough to guarantee that every runtime-local `cron.add`, `cron.update`, or `cron.remove` reaches Otto immediately

Resulting Otto design implication:

- use OpenClaw `cron.list` and `cron.runs` as the typed runtime read and reconciliation surface
- do not scrape raw cron files or treat the runtime dashboard HTML as an API
- keep the Otto workspace backed by Postgres rows in the control plane
- rely on reconciliation to capture runtime-local cron edits until Otto owns cron writes end to end
- when Otto later creates or edits scheduled tasks itself, apply those changes to the runtime through typed `cron.*` Gateway calls rather than raw file projection

## Push sync plan

The current pull path is now working and should remain the repair path. The next slice should add a faster push path for runtime-originated cron changes and run freshness.

### Recommended primary seam

Use an Otto-owned runtime-local watcher process inside the custom runtime image.

Why this is now the right default:

- it catches runtime UI, CLI, and direct Gateway RPC cron edits instead of only agent-originated tool calls
- it uses cron storage files only as change triggers, while still reading typed runtime data through `cron.list` and `cron.runs`
- Otto already owns the custom runtime image and can safely start a small helper beside the gateway process

### What the watcher should push

Add a runtime helper under `runtime-image/helpers/` that:

1. watches cron storage changes
   - `~/.openclaw/cron/jobs.json`
   - `~/.openclaw/cron/runs/*.jsonl`
2. debounces file events and then re-reads typed runtime state
   - `cron.list` for the full task snapshot
   - `cron.runs` for the changed job or jobs
3. posts those updates to Otto through one runtime-authenticated callback route

The first implemented watcher slice should:

- perform one startup sync after the local gateway is healthy
- always send the full task list when any cron file change is observed
- send changed-job run history in bounded batches
- keep the existing pull/reconciliation worker as the repair path

### Control-plane callback API shape

Add one runtime-authenticated endpoint, ideally:

- `POST /api/internal/runtime/scheduled-tasks/sync`

Payload shape should support both full task snapshots and incremental run upserts:

- `tasks`: array of scheduled task definitions
- `runs`: array of scheduled task run rows
- `source`: `watcher`
- optional `reason`: `startup`, `jobs_file_change`, `run_log_change`, or retry variants

The route should:

- authenticate with the tenant gateway token via the existing runtime-auth path
- validate bounded batch sizes
- replace tasks and upsert runs using separate scheduled-task DB helpers
- set `lastSyncedAt` and clear `lastSyncError` on successful task updates

### Important limitation

This watcher-based push path depends on the runtime container and helper process staying healthy.

It should catch:

- runtime UI cron edits
- direct Gateway RPC cron edits
- CLI cron edits
- cron run-log appends as tasks execute

It can still miss updates if:

- the helper process is down
- filesystem watch events are dropped
- the helper starts after a runtime-local change and before the next repair cycle

So reconciliation stays mandatory. The push path improves freshness; the pull path preserves correctness.

### Deleted task lifecycle

Runtime tasks that disappear from `cron.list` should not be hard-deleted from Otto immediately.

Instead:

- tasks still present in runtime stay `active` or `paused`
- tasks missing from runtime after a successful sync become `deleted`
- deleted tasks remain visible in the workspace and keep their run history
- `sync_failed` remains a sync-health concern, not the primary task lifecycle state

This is especially important for one-shot jobs created with `delete-after-run`, because their run logs can still be read from `cron.runs(jobId)` even after the task definition disappears from `cron.list`.

### Implementation order

1. add `/api/internal/runtime/scheduled-tasks/sync`
2. split scheduled-task writes into full task snapshot replacement plus run upserts
3. add a watcher helper under `runtime-image/helpers/`
4. add a small runtime wrapper helper that starts both the gateway and watcher inside the same container
5. update tenant runtime startup to use that wrapper
6. keep the existing worker pull/reconciliation job on a slower repair cadence

### Follow-up if watcher coverage is not enough

If the watcher proves too coarse or too delayed in practice, the next follow-up should be a small plugin signal layer for agent-originated cron changes. That plugin should still call the same callback route, and it should complement the watcher rather than replace it.

## UI shape

Keep one primary nav item: `Scheduled Tasks`.

Within that area, add route-backed tabs or subroutes for:

- `Scheduled Tasks`
- `Task Runs`

### UI remodel plan

The first shipped scheduled-tasks page proved the data flow, but the UI should now be remodeled to match the stronger workspace and operator patterns already in the repo.

Use these existing references as the visual and interaction baseline:

- workspace sessions table on `/[orgSlug]/sessions`
- platform jobs table and URL-backed tab strip on `/platform/organizations/[orgSlug]/jobs`

Remodel decisions:

- remove the summary statistic cards entirely
- move from two stacked card sections to one page-level tabbed navigation model
- keep the page header compact and match the sessions page rhythm:
  - title
  - short muted description
  - right-aligned `Refresh from runtime` action
  - sync-state badge or inline warning only when needed
- use a `DataTable`-based list for both tabs instead of hand-built `Table` sections so spacing, sticky headers, sorting, empty states, and search behave like the existing pages
- keep the top-level naming consistent across tabs, URLs, and tables:
  - `Scheduled Tasks`
  - `Task Runs`
- make filters URL-driven where possible so state is shareable and navigation feels like the platform jobs page

Implementation sequence:

1. Replace the current inline tables on `/[orgSlug]/scheduled-tasks` with a client content component modeled after `sessions/_components/sessions-content.tsx`.
2. Add a compact URL-backed tab strip near the page header for:
   - `Scheduled Tasks`
   - `Task Runs`
3. Make the default `/[orgSlug]/scheduled-tasks` route resolve to the scheduled-tasks view, with subroutes or query-backed state that preserves direct linking.
4. Add a jobs filter control matching the platform jobs pattern:
   - `All`
   - `Active`
   - `Disabled`
   - optional later: `Needs attention`
5. Keep the runs view as a dedicated table that mirrors the sessions table more closely than the current static table:
   - search input in the toolbar
   - sortable columns
   - status badges
   - linked session column when `runtimeSessionKey` exists
6. Move sync-failure and stale-state messaging into the page header / toolbar area so it reads like page state, not a separate dashboard card stack.

### Jobs view

Purpose:

- answer "what is scheduled right now?"
- answer "when does it run next?"
- answer "is Otto's runtime in sync with the control plane?"

Initial content:

- toolbar controls:
  - search
  - status filter for `All`, `Active`, and `Disabled`
  - refresh action
- a sessions-style data table with:
  - task name
  - schedule
  - status
  - last run
  - next run
  - last sync
- empty state when no tasks exist yet
- inline warning when data is stale or last sync failed

### Task Runs view

Purpose:

- answer "what actually ran?"
- answer "what failed most recently?"

Initial content:

- a sessions-style reverse-chronological data table with:
  - task
  - trigger type
  - scheduled for
  - status
  - started
  - finished
  - session link
  - error summary when present
- toolbar controls:
  - search
- filters can wait until after the first slice unless volume forces them earlier

## Loading strategy

- Use dedicated scheduled-task loaders instead of extending `DashboardOrganization`.
- Keep the route server-rendered and `force-dynamic`, matching the current operational pages.
- Start with normal page refresh and explicit refresh actions instead of live polling.
- Add targeted client refresh only if the session view proves too stale in practice.

## Acceptance criteria

- an unlocked organization can open the scheduled-tasks area and see a non-placeholder tasks view
- the UI shows scheduled task definitions from control-plane data, not hardcoded mock rows
- the UI shows recent scheduled task sessions from control-plane data, not worker `job_runs`
- each task row surfaces enough state to answer schedule, status, last run, next run, and sync health
- the system has one documented source of truth for task definitions
- runtime-originated session changes can be written back into the control plane through an authenticated API
- a dropped callback or offline runtime does not silently erase visibility; the UI shows last known data plus stale/sync-failed state

## Status checklist

- [x] define the source-of-truth decision for scheduled tasks
- [x] define the control-plane tables for task definitions and sessions
- [x] define the runtime push/callback/reconciliation sync model
- [x] define the org-scoped tasks and sessions UI shape
- [x] add the schema and DB access layer
- [x] add runtime-authenticated session callback endpoints
- [x] add the sync/reconciliation worker jobs
- [x] add the watcher-based scheduled-task push sync path in the custom runtime image
- [x] replace the scheduled-tasks placeholder page with real tasks and sessions views
- [x] remodel the scheduled-tasks page to use sessions-style data tables instead of summary cards and stacked static tables
- [x] add jobs-style `All / Active / Disabled` filtering for scheduled jobs
- [x] add URL-backed `Scheduled Tasks / Task Runs` navigation aligned with existing page tabs
- [x] keep scheduled-task and task-run tables to single-line rows with separate run-summary text
- [x] add natural-language schedule descriptions for cron expressions without a third-party parser
- [x] add per-task detail routes with `Setup` and `Task Runs` tabs

Implementation note:

- the first shipped sync path is an explicit runtime pull initiated from the workspace UI plus worker-driven reconciliation
- the page now links synced cron runs to existing session detail pages when the runtime reports `sessionKey`
- the next shipped push slice uses a runtime-local watcher helper plus `/api/internal/runtime/scheduled-tasks/sync`
- the runtime now starts through a small wrapper helper so the gateway and cron watcher run in the same container
- the DB layer now separates full task snapshot replacement from incremental run upserts so push sync cannot delete tasks accidentally
- missing runtime tasks are now retained as `deleted` rows instead of being hard-deleted from Postgres
- the watcher now reads changed run logs even if the related task has already been removed from `cron.list`
- linked session rows are now only clickable when the session has actually been synced into Otto
- task detail routes now use `Overview`, `Configuration`, and `Task Runs` tabs and hide the parent scheduled-tasks tab strip to avoid duplicate navigation

## Open questions

- OpenClaw already exposes stable typed Gateway read/write APIs for cron definitions and run history. The remaining decision is whether Otto should:
  - stop at the watcher-based push plus reconciliation design
  - or add plugin hints later for lower-latency agent-originated updates on top of the watcher
- Should `next_run_at` be computed and persisted by the control plane, by the runtime, or by both with one side marked authoritative?
- When create/edit flows arrive, should runtime-side task creation be forbidden entirely, or should runtime edits be allowed only if they write back through the control plane API immediately?
