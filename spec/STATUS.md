# Otto Status

## Terminology

- `Otto` means the product/brand and the user-facing agent experience.
- `control plane` means the backend system: `web/`, API routes, worker, orchestration logic, and DB-backed management.
- `tenant runtime` means the provisioned runtime running on a tenant server.
- `tenant server` means the provisioned VPS/host.

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
- The control plane can now:
  - execute remote SSH commands
  - upload runtime files to `/opt/openclaw`
  - write `openclaw.json`, `.env`, and bootstrap metadata
  - verify those files on the tenant server before marking the tenant ready
- The control plane can also start the official OpenClaw container on the tenant server and verify it with `openclaw health`.
- The first runtime start path currently uses direct `docker run` with host networking and loopback binding; Docker Compose is still deferred.
- Runtime bootstrap can now preconfigure the tenant gateway with `OPENAI_API_KEY` and a default model via `RUNTIME_OPENAI_API_KEY` and `RUNTIME_MODEL_PRIMARY`.
- Slack runtime projection now uses the shared app token from control-plane env plus the tenant-specific bot token captured during Slack OAuth onboarding.
- The next major product flow change is now captured in `TODO_08_signup_to_slack_onboarding_flow.md`: first-time users should complete Slack installation in the UI before tenant provisioning starts.
- The first onboarding-flow slice is now implemented:
  - tenant onboarding drafts are persisted in Postgres
  - signed-in users with no provisioned tenants now land in an onboarding UI instead of immediate provisioning
  - workspace creation now creates an onboarding draft instead of provisioning a tenant immediately
  - provisioning remains intentionally blocked until the Slack OAuth step exists
- Slack OAuth routes now exist under `/oauth/start/slack` and `/oauth/callback/slack`, and the callback can complete onboarding by storing the tenant bot token and starting provisioning.
- The provisioning path can now project a tenant-specific Slack bot token from the onboarding record into the tenant runtime instead of relying only on the global fallback env var.
- Slack control-plane state is now more durable:
  - `tenant_integrations`, `slack_installations`, and `integration_secrets` now persist the canonical Slack installation state
  - generic `messaging_workspaces`, `messaging_workspace_members`, and `messaging_conversations` tables now cache connected workspace directories in provider-agnostic naming
  - Slack OAuth failures are now recorded on the onboarding session and surfaced back in the onboarding and Slack integration pages
  - reconnect / retry is now supported while an organization is still in setup
  - reconnect after the tenant runtime is already ready is now supported through desired-state versioning plus `apply_tenant_config`
- The config-apply slice is now implemented:
  - `tenant_desired_states` versions are now unique per tenant and Slack reconnects create new desired-state versions instead of mutating prior state
  - `tenant_runtime_secrets` now persist runtime-only secrets such as the OpenClaw gateway token under control-plane encryption
  - `tenant_apply_runs` now record queued, running, succeeded, and failed apply attempts per desired-state version
  - the worker now handles `apply_tenant_config` by writing runtime files atomically, restarting the tenant runtime, and verifying health
  - Slack reconnect on an already-ready tenant now queues a runtime apply and the Slack integration page shows queued, applying, and failed runtime update states
- `spec/TODO_03_provisioning_workflow.md` and `spec/TODO_05_config_apply_and_reconciliation.md` now include concrete wrapper boundaries for Hetzner and SSH/runtime work.
- `spec/TODO_06_integrations_and_oauth.md` now captures a Slack-first integration plan built around one shared Slack app, centralized OAuth/token storage, and a shared ingress router.
- `spec/TODO_09_ui_app_shell_and_onboarding_rebuild.md` now captures the broader app-shell rebuild plan around org-scoped routes, gated onboarding, shadcn sidebar composition, and prefixed IDs.
- The first app-shell rebuild slice is now implemented in `web/`:
  - a dedicated `/login` page exists and public signup now hands off directly to WorkOS
  - organizations now carry a unique slug for user-facing routes
  - root now redirects into slug-based workspace routes
  - the authenticated shell now uses a shadcn sidebar with org switcher, requested nav items, and a bottom user menu
  - slug-scoped pages now exist for Agent, Integrations, Slack integration detail, Skills, Scheduled Tasks, Settings, and Onboarding
  - the Slack OAuth routes now return users to the slug-scoped Slack integration page
- The public-auth redesign is now implemented:
  - the public auth entry uses an Otto-branded split shell inspired by `login-02` without importing the full block
  - the left panel now focuses on Otto avatar, short copy, and minimal route-specific actions
  - the desktop panel uses the requested `PixelLiquidBg` treatment with lighter mobile / reduced-motion behavior
- WorkOS public signup is now re-enabled while workspace activation stays gated internally:
  - `/auth/sign-up` now starts the real WorkOS signup flow again
  - `/register` has been removed in favor of direct signup handoff to `/auth/sign-up`
  - organizations now carry an internal `is_ready` flag that defaults to `false`
  - users with a newly created workspace are held on a non-shell waiting page until the org is marked ready
  - Slack OAuth, provisioning, and the org-scoped shell are blocked until `organizations.is_ready = true`
- The prefixed ID strategy is still planned but not yet implemented in the schema; the current UI slice hides raw IDs by using organization slugs in user-facing routes instead.
- The plan now assumes `ssh2` on the Node.js server side for SSH exec and SFTP, with a shared validated env contract for deploy keys and SSH defaults.
- The plan also assumes a thin Hetzner client built on server-side `fetch`, with validated env for the API token and default provisioning settings instead of a JS-specific Hetzner SDK.
- The control plane deployment target is now more explicit:
  - self-host one public control-plane VPS on Hetzner
  - run `web`, `worker`, `postgres`, and `caddy` via Docker Compose
  - keep the web UI public over HTTPS but keep operator SSH access private over Tailscale only
  - expose a `/healthz` route for container and reverse-proxy readiness checks
- WorkOS auth configuration is now moving to explicit server-side runtime settings:
  - use `WORKOS_REDIRECT_URI` for the callback URL
  - use `WORKOS_BASE_URL` for the externally visible app origin in Docker / reverse-proxy deployments
  - keep `NEXT_PUBLIC_WORKOS_REDIRECT_URI` only as a backward-compatibility fallback if older environments still set it

## Active architectural decision

- Prefer a database-backed workflow engine inside the Next.js repo before adopting `trigger.dev`.
- Keep the code structured so `trigger.dev` can be introduced later behind a job interface if the simpler approach stops being sufficient.
- Prefer a containerized OpenClaw runtime on each tenant VPS, with v1 config apply and restart performed over SSH through isolated service wrappers.
- If the control plane uses one shared Slack app, do not route Slack directly to each tenant VPS with Socket Mode; use HTTP mode plus control-plane-owned shared ingress.
- Prefer a public HTTPS control-plane endpoint for the admin UI and shared integrations ingress, while keeping host-level admin access on a private Tailscale path.

## Current product target

- Build the first internal alpha defined in `FIRST_INCREMENT_PLAN.md`.
- Scope that alpha to tenant creation, durable provisioning jobs, and dashboard visibility.
- In parallel, prepare the authenticated app-shell rebuild so the product can move to org-scoped workspace UI after the current bootstrap slice.

## Next recommended implementation step

- Continue `TODO_06_integrations_and_oauth.md` by:
  - implementing the shared Slack ingress router so one shared Slack app can deliver events, commands, and interactivity to the correct tenant runtime
  - deciding whether the control plane should verify Slack signatures centrally and forward authenticated internal requests, or raw-proxy Slack payloads to tenant runtimes in v1
  - adding disconnect handling and revoked-token recovery now that reconnect and apply are in place
- In parallel, continue `TODO_09_ui_app_shell_and_onboarding_rebuild.md` by:
  - running the new slug migration in active environments
  - replacing the temporary WorkOS account link with a verified account-management handoff if available
  - implementing the prefixed ID strategy or explicitly deferring it
  - consuming the synced `messaging_*` directory tables in the UI so Slack channel selection uses real workspace data instead of freeform config
  - deciding how operators will flip `organizations.is_ready` without using direct SQL

## Open questions

- Is WorkOS still the preferred auth provider, or should auth be deferred until core provisioning is proven?
- Should the runtime image be built and published before provisioning starts, or is a temporary bootstrap image acceptable for the first internal alpha?
- When the prefixed ID strategy is implemented, should primary keys be migrated directly or should stable public IDs be added alongside the existing UUIDs first?
