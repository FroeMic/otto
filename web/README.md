# Otto Web

Otto `web` is the control-plane application for tenant onboarding, provisioning, and operations.

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
6. To use real Hetzner provisioning instead of the fake local path, set:
   - `HETZNER_API_TOKEN`
   - optionally `HETZNER_DEFAULT_LOCATION`, `HETZNER_DEFAULT_SERVER_TYPE`, `HETZNER_DEFAULT_IMAGE`, and `HETZNER_SSH_KEY_NAMES`
   - make sure the chosen `server_type` is still available in the chosen `location`
   - set one of `RUNTIME_DEPLOY_PRIVATE_KEY`, `RUNTIME_DEPLOY_PRIVATE_KEY_PATH`, or rely on a loaded local SSH agent
   - optionally override `RUNTIME_OPENCLAW_IMAGE` if you need a non-default OpenClaw runtime image
   - to preconfigure the default OpenAI model, set `RUNTIME_OPENAI_API_KEY` and optionally override `RUNTIME_MODEL_PRIMARY` (defaults to `openai/gpt-5.4`)
   - to test Slack OAuth onboarding, set `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, and `SLACK_REDIRECT_URI`
   - in the Slack app config, add the same redirect URI, for example `http://localhost:3000/oauth/callback/slack`
   - Slack directory sync now also expects `users:read`, `channels:read`, and `groups:read` in the app scopes so Otto can cache workspace members and channels
   - set `RUNTIME_SLACK_APP_TOKEN` for the shared app-level Socket Mode token
   - tenant Slack bot tokens now come from the Slack OAuth onboarding flow and are no longer read from control-plane env
   - `CONTROL_PLANE_ENCRYPTION_SECRET` and `CONTROL_PLANE_OAUTH_STATE_SECRET` are optional; if omitted, Otto falls back to `WORKOS_COOKIE_PASSWORD`
   - optionally tune `RUNTIME_SSH_USERNAME`, `RUNTIME_SSH_PORT`, `RUNTIME_SSH_CONNECT_TIMEOUT_MS`, `RUNTIME_SSH_COMMAND_TIMEOUT_MS`, and `RUNTIME_SSH_READY_TIMEOUT_MS` for SSH checks and remote command execution
7. Install dependencies.
8. Generate migrations with `npm run db:generate`.
9. Apply migrations with `npm run db:migrate`.

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
npm run dev
```

Run the worker:

```bash
npm run worker
```

From the repo root, run both together:

```bash
npm run dev:all
```

Test the configured OpenAI runtime key directly:

```bash
bun run test:openai-token
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

- repository foundation and architecture scaffolding are in progress
- provisioning and runtime logic are not implemented yet

## Notes

- route handlers should stay thin
- long-running work must go through the worker
- `trigger.dev` is intentionally deferred for the first increment
