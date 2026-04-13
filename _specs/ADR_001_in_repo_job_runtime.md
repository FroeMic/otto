# ADR 001: In-Repo Job Runtime For V1

## Status

Accepted

## Context

The control plane needs durable background work for tenant provisioning and later for config apply. These workflows include retries, external API polling, SSH reachability checks, and explicit state transitions. The repository is still at an early stage, and the product shape is not stable enough to justify a separate workflow platform yet.

## Decision

For v1, the control plane will run a Postgres-backed job system inside the existing repository instead of introducing `trigger.dev`.

The control plane is split like this:

- Next.js handles UI, auth, and request-response mutations.
- Postgres stores desired state, tenant state, and durable job state.
- A dedicated worker process claims and runs queued jobs.
- Provider-specific logic lives in service modules such as `hetzner`, `ssh`, `runtime`, and `openclaw`.

## Why this decision

- The first hard requirement is durable state, not advanced orchestration.
- Provisioning and config apply can be modeled as explicit state machines.
- The repository is still small enough that one app plus one worker process is easier to operate than adding another platform dependency.
- This keeps migration to `trigger.dev` possible later if the job abstraction remains narrow.

## Job model

Jobs are stored in `job_runs` and `job_events`.

`job_runs` stores:

- job type
- tenant id
- status
- attempt count
- payload
- result or error
- next available execution time

`job_events` stores:

- step-level timeline events
- operator-visible diagnostics
- structured metadata for retries and failures

## Initial workflows

### Provision tenant server

States:

- `queued`
- `running`
- `succeeded`
- `failed`

Step progression:

1. `create_server`
2. `wait_for_hetzner_action`
3. `fetch_server_ip`
4. `wait_for_ssh`
5. `mark_server_ready`

### Apply tenant config

States:

- `queued`
- `running`
- `succeeded`
- `failed`

Step progression:

1. `compile_desired_state`
2. `upload_runtime_files`
3. `restart_runtime`
4. `verify_runtime`
5. `mark_apply_complete`

## Worker shape

- Run a dedicated Node process from this repository.
- Claim jobs from Postgres in small batches.
- Use explicit retry scheduling instead of blocking sleeps.
- Keep handlers idempotent at each step boundary.
- Prefer `FOR UPDATE SKIP LOCKED` or equivalent locking semantics when job claiming is implemented.

## Consequences

### Positive

- Fewer moving parts in the first product increment.
- Full control over the data model and workflow shape.
- Easy to reason about tenant state and job state together.

### Negative

- Worker lifecycle and reliability are the control plane’s responsibility.
- Retry semantics and observability need to be implemented internally.
- More manual work if workflows become highly concurrent or fan out.

## Revisit conditions

Adopt `trigger.dev` only if one or more of these become true:

- worker reliability work is taking meaningful engineering time
- workflow fan-out, scheduling, or retry semantics become materially complex
- operating the in-repo worker is clearly worse than the cost of the dependency
