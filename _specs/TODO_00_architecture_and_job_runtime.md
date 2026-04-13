# TODO 00: Architecture And Job Runtime

## Goal

Lock the control-plane architecture and introduce a durable background job model that supports provisioning and config apply without committing to `trigger.dev` yet.

## Scope

- define the core service boundaries inside `web/`
- define the database tables needed for resumable jobs and state transitions
- choose the execution model for long-running tasks
- document the conditions that would justify adding `trigger.dev` later

## Dependencies

- none

## Implementation notes

- Keep Next.js for request-response UI and API concerns.
- Add a small internal job system backed by Postgres.
- Jobs should be resumable, idempotent, and explicit about state transitions.
- The first version can use one worker loop in the same repo, for example:
  - a dedicated `worker` entrypoint run alongside Next.js
  - or a protected route/cron trigger that drains queued jobs
- Use an internal interface like `enqueueJob`, `claimJob`, `completeJob`, `failJob`, `retryJob`.
- Separate workflow intent from provider implementations:
  - `lib/jobs`
  - `lib/hetzner`
  - `lib/ssh`
  - `lib/runtime`

## Suggested data model additions

- `job_runs`
  - `id`
  - `job_type`
  - `tenant_id`
  - `status`
  - `attempt`
  - `payload_json`
  - `result_json`
  - `error`
  - `available_at`
  - `started_at`
  - `finished_at`
- `job_events`
  - `id`
  - `job_run_id`
  - `event_type`
  - `message`
  - `data_json`
  - `created_at`

## Why not Trigger.dev first

- Provisioning a VPS and applying config are long-running, but still simple enough to model as explicit DB-backed workflows.
- The repo does not yet have enough stable workflow volume to justify another operational dependency.
- A local job interface keeps migration to `trigger.dev` possible later without rewriting product routes.

## Exit criteria

- one written architecture decision record exists in the repo
- job state machine is defined
- worker execution model is selected
- clear adoption triggers for `trigger.dev` are written down

## Status checklist

- [x] define control-plane module boundaries
- [x] define job tables
- [x] define provisioning job states
- [x] define config apply job states
- [x] document escalation path to `trigger.dev`

## Open questions

- Will the worker have direct DB access and shared code with `web/`, or should it be a separate package immediately?
- Do we need advisory locks or `FOR UPDATE SKIP LOCKED` semantics from day one?
- Current decision: keep the worker in `web/` for now and share the same env, schema, and service modules.
- Current direction: use `FOR UPDATE SKIP LOCKED` semantics when job claiming is implemented.
