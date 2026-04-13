# First Increment Plan

## Product increment

Ship an internal alpha where an authenticated user can create a tenant from the control plane and the system provisions one dedicated Hetzner VPS for that tenant through a durable background job, then shows the resulting status in the dashboard.

This is the first meaningful product slice because it proves the core value proposition:

- central control plane
- one tenant per VPS
- durable provisioning state
- visible operations status

## What is included

- Next.js control-plane shell
- WorkOS authentication
- Postgres schema and migrations
- durable job runner backed by Postgres
- tenant creation flow
- Hetzner provisioning happy path
- dashboard showing tenant and server status

## What is intentionally not included

- Slack or other integrations
- full config compilation and remote apply
- tenant runtime health checks beyond SSH reachability
- rebuild and delete lifecycle flows
- billing
- `trigger.dev`

## Definition of done

- a signed-in user can create a tenant
- tenant creation persists DB state and enqueues a provisioning job
- worker claims and executes the job asynchronously
- Hetzner server metadata and status are persisted
- dashboard shows `provisioning`, `reachable`, `ready`, or `failed`
- job retries are visible and failures are diagnosable

## Ordered implementation steps

### Step 1: Lock architecture and worker shape

Goal:

- finish `TODO_00` enough to prevent churn during implementation

Deliverables:

- ADR for in-repo job runner over `trigger.dev`
- job tables and state model
- decision to run a dedicated worker process alongside Next.js

Exit check:

- there is one clear job interface and one worker entrypoint design

### Step 2: Build repo foundation

Goal:

- finish `TODO_01` enough to support real feature work

Deliverables:

- Drizzle schema and migrations
- env validation
- shared library directories
- local setup notes for web and worker

Exit check:

- app and worker can both start against local Postgres

### Step 3: Implement auth and tenant creation

Goal:

- complete the minimum from `DONE_02` required to create tenants

Deliverables:

- WorkOS sign-in
- user, organization, membership, tenant, and tenant_server tables
- dashboard page with tenant list
- create-tenant action that enqueues provisioning

Exit check:

- authenticated user can create a tenant and see it in `provisioning`

### Step 4: Implement provisioning workflow

Goal:

- complete the happy path from `TODO_03`

Deliverables:

- Hetzner API wrapper
- cloud-init renderer
- provisioning job handler with explicit step transitions:
  - create server
  - wait for action
  - fetch IP
  - wait for SSH
  - persist server ready state

Exit check:

- a tenant reaches `ready` on a real Hetzner VPS in the happy path

### Step 5: Add operations visibility

Goal:

- make the increment operable without building the full ops suite

Deliverables:

- job event log or timeline
- tenant detail view with latest provisioning attempt
- retry button for failed provisioning jobs

Exit check:

- failures are understandable and retryable from the control plane

## Suggested implementation sequence by file area

1. `web/src/db`
2. `web/src/lib/jobs`
3. `web/src/lib/env`
4. `web/src/app/(auth and dashboard routes)`
5. `web/src/lib/hetzner`
6. `web/src/lib/ssh`
7. `web/src/worker`

## Risks to manage early

- serverless deployment constraints if the worker process assumption is wrong
- SSH readiness taking longer than expected
- provisioning retries creating duplicate servers if idempotency is weak
- auth setup delaying core infrastructure work

## Recommendation

Implement this increment in two milestones:

1. local vertical slice with a fake provisioning provider
2. real Hetzner happy path

That keeps the interface and state model testable before real infrastructure is involved.
