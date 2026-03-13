# Otto Status

## Current state

- Repository state is still mostly bootstrap.
- `web/` now has initial env, schema, worker, and service scaffolding.
- Agents should use `bun run ...` by default for `web/` scripts.
- WorkOS auth, workspace creation, tenant creation, and queued provisioning job inserts are implemented in `web/`.
- The local fake provisioning slice now works end to end:
  - queued `provision_tenant_server` jobs are claimed by the worker
  - job steps are persisted and resumable across claims
  - tenant and server rows advance to `ready`
  - fake provider metadata and IPs are written back to the dashboard
- The Hetzner client and minimal cloud-init renderer now exist in `web/`, and the worker will use the real provider when `HETZNER_API_TOKEN` is configured.
- The real Hetzner path now waits for an SSH banner before finishing provisioning.
- The real Hetzner path now performs an initial runtime bootstrap over SSH before marking the tenant ready.
- Otto can now:
  - execute remote SSH commands
  - upload runtime files to `/opt/openclaw`
  - write `openclaw.json`, `.env`, and bootstrap metadata
  - verify those files on the host before marking the tenant ready
- Otto can also start the official OpenClaw container on the tenant VPS and verify it with `openclaw health`.
- The first runtime start path currently uses direct `docker run` with host networking and loopback binding; Docker Compose is still deferred.
- Runtime bootstrap can now preconfigure the tenant gateway with `OPENAI_API_KEY` and a default model via `RUNTIME_OPENAI_API_KEY` and `RUNTIME_MODEL_PRIMARY`.
- Slack runtime projection can now be preconfigured from control-plane env via `RUNTIME_SLACK_APP_TOKEN` and `RUNTIME_SLACK_BOT_TOKEN` before the OAuth/install flow exists.
- `spec/TODO_03_provisioning_workflow.md` and `spec/TODO_05_config_apply_and_reconciliation.md` now include concrete wrapper boundaries for Hetzner and SSH/runtime work.
- `spec/TODO_06_integrations_and_oauth.md` now captures a Slack-first integration plan built around one shared Slack app, centralized OAuth/token storage, and a shared ingress router.
- The plan now assumes `ssh2` on the Node.js server side for SSH exec and SFTP, with a shared validated env contract for deploy keys and SSH defaults.
- The plan also assumes a thin Hetzner client built on server-side `fetch`, with validated env for the API token and default provisioning settings instead of a JS-specific Hetzner SDK.

## Active architectural decision

- Prefer a database-backed workflow engine inside the Next.js repo before adopting `trigger.dev`.
- Keep the code structured so `trigger.dev` can be introduced later behind a job interface if the simpler approach stops being sufficient.
- Prefer a containerized OpenClaw runtime on each tenant VPS, with v1 config apply and restart performed over SSH through isolated service wrappers.
- If Otto ships one shared Slack app, do not route Slack directly to each tenant VPS with Socket Mode; use HTTP mode plus Otto-owned shared ingress.

## Current product target

- Build the first internal alpha defined in `FIRST_INCREMENT_PLAN.md`.
- Scope that alpha to tenant creation, durable provisioning jobs, and dashboard visibility.

## Next recommended implementation step

- Extend the runtime bootstrap into a first real runtime apply:
  - verify the full create-tenant -> worker -> runtime-start path on a fresh tenant with a real model provider key configured
  - surface runtime/container health in the dashboard
  - decide whether to keep direct `docker run` for v1 or install Docker Compose explicitly on tenant hosts
  - persist any runtime access metadata the control plane will need later

## Open questions

- Will the control plane be self-hosted as a long-running Node process or deployed onto a serverless platform with strict execution limits?
- Is WorkOS still the preferred auth provider, or should auth be deferred until core provisioning is proven?
- Should the runtime image be built and published before provisioning starts, or is a temporary bootstrap image acceptable for the first internal alpha?
