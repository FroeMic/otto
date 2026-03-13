# TODO 05: Config Apply And Reconciliation

## Goal

Compile tenant desired state into runtime files, write them safely to the VPS, and reconcile runtime state with retries.

## Scope

- define desired-state schema
- implement config renderers
- implement SSH primitives
- implement apply workflow and audit trail

## Dependencies

- `TODO_00_architecture_and_job_runtime.md`
- `TODO_01_repo_foundation.md`
- `TODO_03_provisioning_workflow.md`
- `TODO_04_runtime_packaging.md`

## Implementation notes

- Desired state should be versioned.
- Apply jobs should always operate against a specific desired-state version.
- Use atomic remote writes and explicit restart steps.
- Record every apply attempt for diagnosis.
- Keep all host-mutation logic behind `web/src/lib/ssh` and `web/src/lib/runtime`.
- Use `ssh2` as the default low-level Node library for both SSH exec and SFTP.
- Do not plan on using SSH libraries from client components or Edge runtime code paths.
- Split the SSH and runtime layer into:
  - `ssh/client.ts` for connection setup
  - `ssh/exec.ts` for remote command execution
  - `ssh/write-file-atomic.ts` for safe config uploads
  - `ssh/wait-until-reachable.ts` for post-provisioning readiness checks
  - `runtime/restart-gateway.ts` for container restart behavior
  - `runtime/apply-gateway-config.ts` for the higher-level apply sequence
- The critical SSH-backed functions for v1 are:
  - `ssh.exec(conn, command, opts)`
  - `ssh.writeFileAtomic(conn, remotePath, content, opts)`
  - `ssh.waitUntilReachable(conn, opts)`
  - `runtime.restartGateway(conn)`
  - `runtime.applyGatewayConfig(input)`
- Library choice notes:
  - primary choice: `ssh2`
  - acceptable wrapper later if needed: `node-ssh`
  - do not split exec and SFTP across unrelated libraries unless `ssh2` proves insufficient
- `ssh.exec` should:
  - open one SSH session
  - run a single command
  - return `stdout`, `stderr`, and `exitCode`
  - enforce a timeout
  - never mix shell command construction into workflow code outside the runtime layer
- `ssh.writeFileAtomic` should:
  - create a temp file in the same remote directory
  - write file contents via SFTP
  - chmod the temp file
  - rename the temp file over the target path
  - be used for `openclaw.json`, env files, and any generated runtime manifests
- `ssh.waitUntilReachable` should:
  - retry a trivial command such as `echo ok`
  - be used after Hetzner provisioning succeeds but before config apply begins
  - use bounded retry intervals and a hard timeout
- `ssh/client.ts` should read its defaults from validated env:
  - `RUNTIME_SSH_USERNAME`
  - `RUNTIME_SSH_PORT`
  - `RUNTIME_DEPLOY_PRIVATE_KEY`
  - `RUNTIME_SSH_KNOWN_HOSTS` when host verification is enabled
- The connection object passed into SSH helpers should still allow per-tenant values from DB:
  - `host`
  - optional `port`
  - optional override `username`
- `runtime.restartGateway` should:
  - be the only place that knows the Docker restart command
  - initially run a blunt restart or recreate step such as `docker compose up -d --force-recreate openclaw-gateway`
  - remain swappable later if a tenant agent replaces SSH
- `runtime.applyGatewayConfig` should:
  - load the target desired-state version
  - render `openclaw.json`
  - render the runtime env file if needed
  - upload files atomically
  - optionally run a validation step
  - restart the gateway
  - record outputs and final status on the apply run
- Recommended apply job step states:
  - `queued`
  - `loading_desired_state`
  - `rendering_files`
  - `writing_files`
  - `restarting_runtime`
  - `verifying_runtime`
  - `succeeded`
  - `failed`
- Recommended persisted apply data:
  - `tenant_apply_runs.status`
  - `desired_state_version`
  - `started_at`
  - `finished_at`
  - `error`
  - `validate_stdout`
  - `validate_stderr`
  - `restart_stdout`
  - `restart_stderr`
- Runtime assumptions for v1:
  - OpenClaw runs in a container on the tenant VPS
  - the host has an `openclaw` user and runtime directories under `/home/openclaw`
  - the gateway binds only to `127.0.0.1`
  - the control plane applies tenant-specific state over SSH
  - the control plane authenticates with one deploy key pair managed by env, not an operator laptop key
- Security constraints:
  - no tenant secrets baked into cloud-init
  - no partial writes to runtime config
  - no host root requirement for the OpenClaw process
  - no Docker socket mounted into the runtime container
  - prefer host key verification through `RUNTIME_SSH_KNOWN_HOSTS` instead of blindly trusting first use
- Keep the interface job-runner agnostic:
  - a Postgres worker can call these wrappers now
  - a Trigger.dev adapter can call the same wrappers later

## Exit criteria

- desired state compiles into runtime files
- files are uploaded atomically
- runtime can be restarted over SSH
- apply status is visible in UI

## Status checklist

- [ ] define desired-state tables
- [ ] implement config renderers
- [ ] implement SSH client wrapper
- [ ] implement atomic remote file writes over SFTP
- [ ] define runtime apply step states
- [ ] implement runtime wrapper
- [ ] record apply runs and logs

## Open questions

- Do we need drift detection in v1, or only push-based apply?
