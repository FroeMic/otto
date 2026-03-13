# Otto Status

## Current state

- Repository state is still mostly bootstrap.
- `web/` now has initial env, schema, worker, and service scaffolding.
- WorkOS auth, workspace creation, tenant creation, and queued provisioning job inserts are implemented in `web/`.
- The local fake provisioning slice now works end to end:
  - queued `provision_tenant_server` jobs are claimed by the worker
  - job steps are persisted and resumable across claims
  - tenant and server rows advance to `ready`
  - fake provider metadata and IPs are written back to the dashboard
- Real Hetzner provisioning, SSH readiness checks, and config apply are still not implemented.
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

- Finish the real-provider half of Step 4 from `FIRST_INCREMENT_PLAN.md`.
- Treat `TODO_03_provisioning_workflow.md` as the active checklist, but start with:
  - a real Hetzner client
  - persisted Hetzner metadata on `tenant_servers`
  - replacement of the fake provider in the provisioning handler

## Open questions

- Will the control plane be self-hosted as a long-running Node process or deployed onto a serverless platform with strict execution limits?
- Is WorkOS still the preferred auth provider, or should auth be deferred until core provisioning is proven?
- Should the runtime image be built and published before provisioning starts, or is a temporary bootstrap image acceptable for the first internal alpha?
