# TODO 38: Provisioning Provider Abstraction And Docker Tenant Labs

## Goal

Introduce a first-class provisioning provider abstraction so tenant server provisioning can run through either:

- the current Hetzner production path, or
- a new Docker-backed ephemeral tenant-lab path for short-lived coding/test environments.

The immediate objective is to keep production behavior stable while making an additive Docker provider possible without rewriting the provisioning workflow state machine.

## Scope

- define and implement a worker-owned provisioning provider contract
- refactor current worker provisioning and teardown code to use the provider contract
- add explicit provider selection config with safe production defaults
- add a second provider setup for Docker-host lifecycle
- implement Docker provider behavior for create/get/wait/delete host lifecycle
- add per-tenant SSH endpoint metadata required by Docker-host routing
- add tenant-lab environment wiring and focused integration tests

## Non-goals

- replacing the queue/job system
- changing request-handler ownership into long-running execution logic
- redesigning runtime-manager command semantics
- introducing Trigger.dev

## Dependencies

- `_specs/TODO_03_provisioning_workflow.md`
- `_specs/TODO_05_config_apply_and_reconciliation.md`
- `_specs/TODO_07_operations_and_observability.md`

## Current implementation snapshot

The current code path is functional but tightly coupled:

- Provider selection is currently implicit by `HETZNER_API_TOKEN`, not explicit env policy.
- Provisioning has a single handler that combines state-machine orchestration, provider specifics, runtime bootstrap, and credential provisioning.
- Non-Hetzner provisioning paths skip meaningful SSH/bootstrap/start/verify behavior.
- Runtime connection resolution is duplicated in worker and API.
- Delete flows are currently Hetzner-targeted.

This spec defines a phased migration to make provider behavior pluggable while preserving current production stability.

## Architecture

### Layered architecture (target)

1. **API enqueue layer** (`apps/api`)
   - queues `provision_tenant_server` jobs and seeds initial `tenant_servers` row
   - remains thin and does not execute provisioning runtime logic

2. **Worker orchestration layer** (`apps/worker/src/runtime/lib/jobs/provisioning.ts`)
   - owns state transitions and retry/requeue semantics
   - calls provider interface for host lifecycle
   - calls runtime-manager for SSH/bootstrap/runtime actions

3. **Provider lifecycle layer** (`apps/worker/src/runtime/lib/provisioning-provider/*`)
   - encapsulates provider-specific host creation/fetch/wait/delete behavior
   - ships `hetzner`, `fake`, and `docker` implementations

4. **Runtime execution layer** (`apps/worker/src/runtime/lib/runtime/*`, `ssh/*`)
   - remains provider-agnostic
   - receives resolved `host/port/username` from connection resolution

### Control-flow diagram

```text
apps/api enqueue -> job_runs(provision_tenant_server)
                 -> worker claims job
                 -> provisioning step machine
                    -> provider.createHost()
                    -> provider.waitForHostAction()
                    -> provider.getHost()
                    -> wait_for_ssh
                    -> wait_for_host_bootstrap
                    -> bootstrap_runtime
                    -> start_runtime
                    -> verify_runtime
                    -> mark_server_ready
```

### Provider abstraction diagram

```text
Provisioning Job Handler
  |
  +-- resolveProvisioningProvider()
         |
         +-- HetznerProvisioningProvider
         +-- FakeProvisioningProvider
         +-- DockerProvisioningProvider
```

### Docker tenant-lab topology (target)

```text
worker (control-plane)
  -> Docker API
  -> tenant-host container (SSH endpoint)
      -> runtime manager connects over SSH
      -> remote docker commands manage openclaw runtime container
```

## Implementation notes

## Phase 0: Production-path hardening (no intended behavior change)

Purpose: reduce blast radius before adding a second real provider.

- Add explicit env selector in worker runtime env:
  - `TENANT_RUNTIME_PROVIDER=hetzner|docker|fake`
  - compatibility fallback: if unset, preserve legacy token-based behavior for one migration window
- Centralize provider-resolution logic in one worker module.
- Keep default production outcome as Hetzner.
- Add focused tests for provider resolution matrix and fallback behavior.
- Keep provisioning step transitions unchanged.

### Files

- `apps/worker/src/runtime/lib/env.ts`
- `apps/worker/src/runtime/lib/jobs/provisioning.ts`
- `.env.example`
- worker tests under `apps/worker/src/runtime/lib/jobs/`

## Phase 1: Provider/refactor slice

Purpose: split orchestration from provider-specific host lifecycle.

- Introduce worker-owned provider contract:
  - `createHost`
  - `waitForHostAction`
  - `getHost`
  - `deleteHost`
- Wrap existing Hetzner and fake behavior behind contract adapters.
- Refactor provisioning handler to call provider interface methods instead of inline branching.
- Keep current step names (`create_server`, `wait_for_hetzner_action`, etc.) for compatibility in first pass.
- Extract shared provider-deletion routing module and use it in:
  - `delete-tenant-server` job
  - `delete-workspace` job

### Files

- New:
  - `apps/worker/src/runtime/lib/provisioning-provider/types.ts`
  - `apps/worker/src/runtime/lib/provisioning-provider/resolver.ts`
  - `apps/worker/src/runtime/lib/provisioning-provider/interface.ts`
  - `apps/worker/src/runtime/lib/provisioning-provider/providers/hetzner.ts`
  - `apps/worker/src/runtime/lib/provisioning-provider/providers/fake.ts`
  - `apps/worker/src/runtime/lib/provisioning-provider/delete.ts`
- Changed:
  - `apps/worker/src/runtime/lib/jobs/provisioning.ts`
  - `apps/worker/src/runtime/lib/jobs/delete-tenant-server.ts`
  - `apps/worker/src/runtime/lib/jobs/delete-workspace.ts`

## Phase 2: Second-provider setup (Docker-ready contracts + schema)

Purpose: add required substrate before Docker execution.

- Extend `tenant_servers` with per-tenant SSH endpoint metadata:
  - `sshHost` (or `ssh_host`)
  - `sshPort` (or `ssh_port`)
- Keep `ipv4` as compatibility fallback until full cutover.
- Update worker and API runtime connection resolution:
  - `host = sshHost ?? ipv4`
  - `port = sshPort ?? env.RUNTIME_SSH_PORT`
- Add Docker provider config schema:
  - host image
  - network name
  - SSH port allocation range / strategy
  - endpoint mode policy

### Files

- `packages/features/integrations-runtime/src/db/schema.ts`
- `drizzle/*` + `drizzle/meta/*`
- `apps/worker/src/runtime/lib/runtime/connection.ts`
- `apps/api/src/tenant-runtime/ssh.ts`
- env files and parsing in worker/api

## Phase 3: Docker provider implementation

Purpose: add real Docker host lifecycle parity for short-lived tenant labs.

- Implement `DockerProvisioningProvider`:
  - create tenant-host container + attach network + allocate SSH endpoint
  - return normalized provider host metadata
  - fetch host state and endpoint
  - delete host container/artifacts idempotently
- Provisioning parity:
  - run SSH reachability and runtime-manager bootstrap/start/verify on Docker path
- Add provider-aware host-bootstrap check strategy:
  - preserve Hetzner cloud-init checks
  - add Docker-host compatible bootstrap policy without weakening Hetzner checks
- Add tenant-lab compose profile:
  - worker configured with `TENANT_RUNTIME_PROVIDER=docker`
  - required Docker access wiring

### Files

- New:
  - `apps/worker/src/runtime/lib/provisioning-provider/providers/docker.ts`
  - optional Docker provider support files under same module
- Changed:
  - `apps/worker/src/runtime/lib/jobs/provisioning.ts`
  - `apps/worker/src/runtime/lib/runtime/manager.ts` (if provider-aware bootstrap capability is required)
  - compose/env docs and config files

## Phase 4: Observability + rollout hardening

- Add provider-tagged job events and normalized provider operation metadata.
- Add focused integration tests:
  - provision -> ready on Hetzner path (smoke/integration)
  - provision -> ready on Docker path
  - delete tenant/workspace cleans provider resources
- Add rollout policy:
  - production pinned to Hetzner mode
  - Docker mode enabled only in designated test/lab environments

## Data and contract design

### Provider ID type

- `ProvisioningProviderId = "hetzner" | "docker" | "fake"`

### Normalized host shape

- `providerServerId: string`
- `status: string`
- `host?: string` (preferred endpoint host)
- `ipv4?: string` (legacy/fallback)
- `sshPort?: number`
- `sshUsername?: string`
- `actionId?: string | null`

### Backward compatibility

- Existing payload steps remain valid.
- Existing `tenant_servers.ipv4` remains supported during migration.
- Legacy env inference remains temporarily available until Phase 1 is fully validated.

## Testing strategy

- Unit tests:
  - provider resolver/fallback policy
  - provider interface adapters (hetzner/fake/docker)
  - connection resolution precedence (`sshHost/sshPort` over fallback)
- Integration tests (focused suites only):
  - provisioning handler reaches `mark_server_ready` in each provider mode used in CI
  - teardown handlers delete provider resources idempotently
- Manual smoke:
  - tenant-lab create/provision/start/verify/delete flow in Docker mode

## Acceptance criteria

- Production Hetzner provisioning behavior remains stable after Phase 0+1 changes.
- Provider logic is isolated behind a worker-owned contract module.
- Delete handlers no longer hardcode Hetzner-only provider cleanup.
- Docker mode can provision a real SSH-reachable tenant host and complete runtime bootstrap/start/verify.
- Tenant runtime connection can use per-tenant host/port metadata.
- Status and spec tracking are updated as each phase lands.

## Status checklist

- [ ] Phase 0: explicit provider config + compatibility fallback + tests
- [ ] Phase 1: provider abstraction + provisioning refactor + shared delete routing
- [ ] Phase 2: schema + connection metadata + second-provider setup
- [ ] Phase 3: Docker provider create/get/wait/delete implementation
- [ ] Phase 3: Docker provisioning parity through runtime bootstrap/start/verify
- [ ] Phase 3: tenant-lab compose/profile wiring
- [ ] Phase 4: observability/event normalization updates
- [ ] Phase 4: integration smoke tests for Hetzner and Docker paths

## Open questions

- Should Docker host mode default to published host ports or internal Docker DNS for SSH endpoints?
- Should OpenAI key provisioning run on Docker tenant-lab hosts by default, or be gated by env for short-lived labs?
- Should provisioning step names be generalized now (`wait_for_provider_action`) or deferred until after migration?
- Should runtime connection-resolution duplication be moved to a shared package immediately or after provider migration lands?
