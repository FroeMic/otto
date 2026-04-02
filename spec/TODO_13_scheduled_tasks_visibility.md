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
  - `status` such as `active`, `paused`, `sync_failed`
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

## UI shape

Keep one primary nav item: `Scheduled Tasks`.

Within that area, add route-backed tabs or subroutes for:

- `Tasks`
- `Sessions`

### Tasks view

Purpose:

- answer "what is scheduled right now?"
- answer "when does it run next?"
- answer "is Otto's runtime in sync with the control plane?"

Initial content:

- summary badges for `Active`, `Paused`, `Sync failed`, and `Stale`
- a table with:
  - task name
  - schedule
  - status
  - last run
  - next run
  - last sync
- empty state when no tasks exist yet
- inline warning when data is stale or last sync failed

### Sessions view

Purpose:

- answer "what actually ran?"
- answer "what failed most recently?"

Initial content:

- a reverse-chronological table with:
  - task
  - trigger type
  - scheduled for
  - status
  - started
  - finished
  - error summary when present
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
- [ ] add the schema and DB access layer
- [ ] add runtime-authenticated session callback endpoints
- [ ] add the sync/reconciliation worker jobs
- [ ] replace the scheduled-tasks placeholder page with real tasks and sessions views

## Open questions

- Does the upstream OpenClaw runtime already expose a stable automation API we can target directly, or do we need Otto-owned plugin endpoints for scheduled tasks just as we did for managed config and runtime config surfaces?
- Should `next_run_at` be computed and persisted by the control plane, by the runtime, or by both with one side marked authoritative?
- When create/edit flows arrive, should runtime-side task creation be forbidden entirely, or should runtime edits be allowed only if they write back through the control plane API immediately?
