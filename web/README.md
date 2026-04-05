# Otto Control Plane (`web`)

`web/` is the control-plane application for Otto tenant onboarding, provisioning, and operations.

## Responsibilities

- Next.js request-response UI and API work
- WorkOS authentication and tenant management
- durable job state stored in Postgres
- a dedicated worker process for provisioning and later runtime apply flows

## Local setup

1. Copy `.env.example` to `.env`.
2. Start local Postgres with Docker:

```bash
docker compose up -d
```

3. Set `DATABASE_URL` to the local database if you changed it from the default.
4. If you are testing WorkOS auth locally, generate a `WORKOS_COOKIE_PASSWORD` with `openssl rand -base64 24` and keep it at 32+ characters.
5. In the WorkOS dashboard, set:
   - Redirect URI: `http://localhost:3000/auth/callback`
   - App homepage URL: `http://localhost:3000`
   - Sign-in endpoint: `http://localhost:3000/auth/sign-in`
6. Set the WorkOS runtime env vars:
   - `WORKOS_CLIENT_ID`
   - `WORKOS_API_KEY`
   - `WORKOS_COOKIE_PASSWORD`
   - `WORKOS_REDIRECT_URI`
   - optionally `WORKOS_BASE_URL` when running behind Docker or another reverse proxy
   - optionally `CONTROL_PLANE_DOMAIN` to derive the public app origin for absolute redirects
7. To use real Hetzner provisioning instead of the fake local path, set:
   - `HETZNER_API_TOKEN`
   - optionally `HETZNER_DEFAULT_LOCATION`, `HETZNER_DEFAULT_SERVER_TYPE`, `HETZNER_DEFAULT_IMAGE`, and `HETZNER_SSH_KEY_NAMES`
   - make sure the chosen `server_type` is still available in the chosen `location`
   - set one of `RUNTIME_DEPLOY_PRIVATE_KEY`, `RUNTIME_DEPLOY_PRIVATE_KEY_PATH`, or rely on a loaded local SSH agent
   - optionally override `RUNTIME_OPENCLAW_IMAGE` if you need a non-default OpenClaw runtime image
   - to include Otto-owned runtime plugins such as `otto-managed-config`, build and publish the custom image defined in `/Users/michaelfrohlich/Repositories/otto/runtime-image/Dockerfile` and point `RUNTIME_OPENCLAW_IMAGE` at that published image
   - to preconfigure the default OpenAI model, set `RUNTIME_OPENAI_API_KEY` and optionally override `RUNTIME_MODEL_PRIMARY` (defaults to `openai/gpt-5.4`)
   - to let the control plane provision tenant-specific OpenAI projects and service-account keys, set `CONTROL_PLANE_OPENAI_ADMIN_API_KEY`
   - to test Slack OAuth onboarding, set `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, and `SLACK_REDIRECT_URI`
   - in the Slack app config, add the same redirect URI, for example `http://localhost:3000/oauth/callback/slack`
   - Slack directory sync now also expects `users:read`, `channels:read`, and `groups:read` in the app scopes so the control plane can cache workspace members and channels
   - set `RUNTIME_SLACK_APP_TOKEN` for the shared app-level Socket Mode token
   - tenant Slack bot tokens now come from the Slack OAuth onboarding flow and are no longer read from control-plane env
   - `CONTROL_PLANE_ENCRYPTION_SECRET` and `CONTROL_PLANE_OAUTH_STATE_SECRET` are optional; if omitted, the control plane falls back to `WORKOS_COOKIE_PASSWORD`
   - optionally tune `RUNTIME_SSH_USERNAME`, `RUNTIME_SSH_PORT`, `RUNTIME_SSH_CONNECT_TIMEOUT_MS`, `RUNTIME_SSH_COMMAND_TIMEOUT_MS`, and `RUNTIME_SSH_READY_TIMEOUT_MS` for SSH checks and remote command execution
   - optional PostHog browser analytics env vars:
    - `NEXT_PUBLIC_POSTHOG_ENABLED=true` only in the real production environment
    - `NEXT_PUBLIC_POSTHOG_HOST=/ingest` to proxy browser capture through the app domain
    - `NEXT_PUBLIC_POSTHOG_TOKEN=<ph_project_token>`
8. Install dependencies.
9. Generate migrations with `npm run db:generate`.
10. Apply migrations with `npm run db:migrate`.

Default local database URL:

```bash
postgres://postgres:postgres@127.0.0.1:5433/otto
```

Stop the local database:

```bash
docker compose down
```

Remove the database volume too:

```bash
docker compose down -v
```

## Local development

Run the web app:

```bash
bun run dev
```

Run the worker:

```bash
bun run worker
```

From the repo root, run both together:

```bash
bun run dev:all
```

Test the configured OpenAI runtime key directly:

```bash
bun run test:openai-token
```

Queue a tenant runtime apply against the latest desired state for an org:

```bash
bun run tenant:runtime:apply -- --orgslug <org-slug>
```

This uses the normal `apply_tenant_config` worker path, which already pulls the
configured `RUNTIME_OPENCLAW_IMAGE` before recreating the runtime container.

Force a ready tenant to pull `RUNTIME_OPENCLAW_IMAGE` and recreate the runtime
container without changing config:

```bash
bun run tenant:runtime:refresh-image -- --orgslug <org-slug>
```

## Directory highlights

- `src/app`: Next.js routes and layouts
- `src/db`: schema and database client
- `src/lib/jobs`: durable job model and worker logic
- `src/lib/hetzner`: infrastructure provider wrapper
- `src/lib/ssh`: SSH primitives
- `src/lib/runtime`: tenant runtime management
- `src/lib/openclaw`: OpenClaw-specific config rendering
- `src/worker`: worker process entrypoint

## Current status

- the control plane can provision Hetzner tenant servers through the worker
- runtime bootstrap and config apply now execute over SSH
- production deployment artifacts now exist for one public control-plane VPS with local Postgres and a dedicated worker

## Notes

- route handlers should stay thin
- long-running work must go through the worker
- `trigger.dev` is intentionally deferred for the first increment
- PostHog browser analytics is wired through `src/instrumentation-client.ts` and stays off unless `NEXT_PUBLIC_POSTHOG_ENABLED=true` and the build runs with `NODE_ENV=production`
- PostHog browser capture now uses `/ingest` rewrites in `next.config.ts`, so the browser talks to the workspace domain and Next.js forwards requests to PostHog EU Cloud
- the default integration is intentionally cheap: SPA pageviews only, no autocapture, no session replay, no surveys, and no heatmaps

## Production deployment

The production stack now lives in:

- `Dockerfile`
- `docker-compose.prod.yml`
- `Caddyfile`
- `.env.production.example`

On the server, copy `.env.production.example` to `.env`, fill in the secrets, then build and deploy the stack:

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml --profile ops run --rm migrate
docker compose -f docker-compose.prod.yml up -d
```

The production layout is:

- `caddy` terminates public HTTPS for `CONTROL_PLANE_DOMAIN`
- `web` serves the Next.js control plane on the internal Docker network
- `worker` runs the durable job loop as a separate container
- `postgres` stores control-plane state on a persistent Docker volume
- `postgres` is also bound to `127.0.0.1:5433` on the host for operator access over SSH / Tailscale

The web container exposes `/healthz` for readiness checks.
Set `WORKOS_REDIRECT_URI` to the public callback URL and `WORKOS_BASE_URL` to the public app origin so AuthKit callbacks and Docker-hosted redirects stay on the production hostname.
Set `CONTROL_PLANE_DOMAIN` to the same public hostname so Slack OAuth and other absolute redirects do not fall back to an internal proxy host.
The hosted `*.authkit.app` domain itself still follows the configured `WORKOS_CLIENT_ID` / `WORKOS_API_KEY`, so production must use the production WorkOS environment credentials.

From a laptop on the tailnet, connect through an SSH tunnel:

```bash
ssh -L 5433:127.0.0.1:5433 root@otto-control-plane
psql 'postgres://otto:<password>@127.0.0.1:5433/otto'
```

## Hetzner host hardening

For the control-plane host, keep the UI public but keep operator access private:

1. Install Tailscale on the VPS and verify admin access over the tailnet first.
2. Expose only `80` and `443` publicly in the Hetzner firewall.
3. Remove any public firewall rule for `22`.
4. Disable password auth in `sshd`.
5. Keep Hetzner console access as the recovery path if Tailscale is misconfigured.
