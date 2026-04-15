# TODO 34: Snapshot-Based Tenant Provisioning

## Goal

Reduce first-time tenant server onboarding latency by provisioning new Hetzner tenant servers from an Otto-prepared snapshot instead of rebuilding the host from a base OS image on every tenant.

This slice must preserve the existing provisioning job path unchanged. Snapshot-based provisioning should land as a second strategy that can be selected explicitly, rolled out gradually, and reverted cleanly.

## Scope

- add a snapshot-based tenant provisioning strategy alongside the current Hetzner base-image strategy
- keep the current `provision_tenant_server` job behavior unchanged
- add a second provisioning job type and worker handler for snapshot-backed provisioning
- add Hetzner snapshot/image support to the Hetzner client
- add onboarding-side job selection so new onboarding runs can choose the snapshot path
- keep tenant-specific secret and config bootstrap after server creation
- add snapshot-host verification and metadata so operators can diagnose which image generation provisioned a tenant
- define a repeatable snapshot bake workflow for each new runtime image release

## Out of scope

- do not rewrite the existing `provision_tenant_server` implementation
- do not migrate old tenants automatically to snapshot-backed hosts
- do not bake tenant-specific secrets into the snapshot
- do not fully automate snapshot lifecycle management in the first slice
- do not change the runtime apply job shape beyond what is needed to support the snapshot provisioning path

## Dependencies

- `TODO_03_provisioning_workflow.md`
- `TODO_04_runtime_packaging.md`
- `TODO_11_runtime_release_rollout.md`
- `TODO_28_workspace_onboarding_and_public_intake.md`

## Why this exists

The current onboarding path pays for three cold-start costs on every tenant:

1. Hetzner server creation and initial boot
2. cloud-init host bootstrap including Docker installation
3. first runtime image pull and cold runtime start

The current worker flow in `apps/worker/src/runtime/lib/jobs/provisioning.ts` shows this directly:

- create server
- wait for SSH
- wait for host bootstrap
- write runtime files
- start runtime
- verify runtime

The snapshot strategy removes the repeated host bootstrap work and can also avoid the cold runtime image pull when the Otto runtime image is preloaded into the baked host image.

## Design

### Provisioning strategies

Provisioning should support two explicit strategies:

- `legacy_base_image`
- `hetzner_snapshot`

The current strategy remains the default-safe fallback until the snapshot strategy is validated in staging and then production.

### Worker shape

Keep the existing job type and handler unchanged:

- `provision_tenant_server`

Add a separate job type and handler for the new strategy:

- `provision_tenant_server_from_snapshot`

This new job should reuse proven shared runtime bootstrap helpers where that makes sense, but it must not silently change the old code path.

### Snapshot job steps

Recommended first-pass step model:

- `create_server_from_snapshot`
- `wait_for_hetzner_action`
- `fetch_server_ip`
- `wait_for_ssh`
- `verify_snapshot_host`
- `bootstrap_tenant_runtime`
- `start_runtime`
- `verify_runtime`
- `mark_server_ready`

The key difference from the legacy path is that snapshot provisioning should not include a `wait_for_host_bootstrap` phase that waits for Docker installation and first-boot setup.

### What the snapshot should contain

The baked snapshot should include non-secret, reusable host preparation only:

- supported Ubuntu base image state
- Docker installed and active
- `openclaw` user
- expected runtime directories such as `/opt/openclaw`
- Otto helper scripts and host prerequisites
- the target Otto runtime image already pulled
- a marker file that records snapshot metadata such as generation, base image, and runtime image ref

### What must still be provisioned per tenant

The following must remain tenant-specific and happen after the new server is created:

- initial tenant-specific OpenAI credential creation
- tenant token generation
- gateway token generation
- tenant-specific `openclaw.json`
- tenant-specific `.env`
- projected managed bootstrap files
- projected managed skill files
- runtime start/restart and health verification

### Snapshot host contract

Snapshot-backed provisioning should verify a host contract instead of waiting for cloud-init:

- Docker is installed and active
- the expected `openclaw` user exists
- required runtime directories exist with sane ownership
- the expected Otto runtime image is already available locally, or the host explicitly reports which image generation it was baked with
- snapshot metadata file exists and is readable

If the verification fails, the job should fail clearly rather than falling back implicitly to legacy bootstrap logic.

## Data and configuration

### Env and control-plane settings

Do not overload the existing `HETZNER_DEFAULT_IMAGE` setting, which belongs to the legacy path.

Add dedicated configuration for snapshot provisioning, for example:

- `HETZNER_ONBOARDING_PROVISIONING_MODE`
- `HETZNER_DEFAULT_SNAPSHOT_IMAGE`
- `HETZNER_SNAPSHOT_EXPECTED_RUNTIME_IMAGE`
- `HETZNER_SNAPSHOT_GENERATION`

The first slice may keep these as env-backed settings. A later slice may move them into the control-plane-owned runtime release model.

### Tenant server metadata

Add metadata to `tenant_servers` so operators can tell how a tenant host was created, for example:

- `provisioning_strategy`
- `source_image`
- `source_snapshot_id`
- `snapshot_generation`

This should support operator diagnostics and rollout safety without changing the meaning of `ready` or other existing tenant status fields.

## Onboarding integration

Workspace onboarding currently creates the initial tenant and queues `provision_tenant_server`.

That should change to:

- read the selected provisioning strategy
- keep the current job path for `legacy_base_image`
- queue `provision_tenant_server_from_snapshot` for `hetzner_snapshot`

The rest of the onboarding waiting/unlock flow should not need to care which provisioning strategy produced the tenant host.

## Snapshot bake workflow

Each new runtime image release should produce one fresh onboarding snapshot.

Recommended bake flow:

1. create a temporary server from the supported official base image
2. perform one-time host bootstrap and prerequisite installation
3. pull the target Otto runtime image onto the host
4. write a snapshot metadata marker file with generation and runtime image ref
5. shut down the temporary server cleanly
6. create a Hetzner snapshot from that powered-off server
7. update onboarding config to use the new snapshot id

The first slice can make this a manual or operator-scripted workflow. Full control-plane automation can come later.

## Estimated impact

Based on the current observed onboarding timeline, the best candidate savings are:

- almost all of `Waiting For Host Bootstrap`
- some of `Starting Runtime` if the Otto runtime image is already present on the host

The likely first-pass outcome is roughly:

- current: about 3 minutes 19 seconds
- target after snapshot path: about 1 to 2 minutes

This is not a guaranteed constant, but it is a realistic planning target and should be validated with before/after job timing.

## Implementation task list

### Spec and wiring

- [ ] update `TODO_03_provisioning_workflow.md` to recognize snapshot-based provisioning as a second supported Hetzner strategy
- [ ] update `TODO_28_workspace_onboarding_and_public_intake.md` so onboarding can queue either the legacy or snapshot job
- [ ] update `TODO_11_runtime_release_rollout.md` to note that each active runtime image release should also produce a fresh onboarding snapshot

### Worker and job model

- [ ] add `provision_tenant_server_from_snapshot` to the shared job type definitions
- [ ] add snapshot-specific job payload and step types
- [ ] add a new worker handler file for snapshot provisioning
- [ ] register the new job type in worker dispatch and lane selection
- [ ] keep the current `provision_tenant_server` handler behavior untouched

### Hetzner client

- [ ] extend the Hetzner client with snapshot-aware image lookup helpers
- [ ] add a method to create a server from a configured snapshot image
- [ ] normalize enough image metadata to validate architecture and snapshot identity
- [ ] keep the existing base-image `createServer(...)` path unchanged

### Runtime manager

- [ ] add a `verifySnapshotHostReady(...)` check to the runtime manager
- [ ] keep `waitForHostBootstrap(...)` for the legacy flow
- [ ] reuse the existing runtime bootstrap helpers for tenant-specific config projection
- [ ] ensure snapshot provisioning still creates tenant-specific secrets before runtime bootstrap

### Onboarding and API

- [ ] add provisioning-mode selection in onboarding trigger code
- [ ] queue the new snapshot job type when configured
- [ ] preserve the current onboarding waiting-screen and unlock semantics
- [ ] record the selected strategy on `tenant_servers`

### Schema and observability

- [ ] add tenant-server metadata columns for provisioning strategy and snapshot provenance
- [ ] add the corresponding Drizzle migration and metadata snapshot update
- [ ] surface snapshot provenance in operator diagnostics where tenant server details are already shown
- [ ] record before/after duration measurements for legacy vs snapshot provisioning

### Snapshot bake workflow

- [ ] define the exact host preparation script or worker action used to build a golden server
- [ ] define the marker file format written into the baked host
- [ ] add a documented operator runbook or script for baking a fresh snapshot from the new runtime image
- [ ] define rollback instructions for switching onboarding back to the previous snapshot or legacy path

## Exit criteria

- a new onboarding run can queue snapshot-based tenant provisioning without changing the old provisioning handler
- snapshot-backed hosts skip the legacy host-bootstrap wait step
- tenant-specific secrets and runtime config are still written after server creation
- operators can identify which snapshot generation created a tenant server
- a repeatable snapshot bake workflow exists for each new Otto runtime image release
- the measured provisioning latency is materially better than the legacy base-image path

## Open questions

- Should snapshot selection remain env-backed in the first slice, or should it be attached immediately to the active runtime release record?
- Should the first bake workflow be a CLI/operator script or a worker-backed platform action?
- Should the snapshot host contain a stopped `openclaw-gateway` container already created from the baked image, or only the pulled image plus directories?
- Should we keep one snapshot per active runtime release only, or retain older snapshots for rollback windows?
