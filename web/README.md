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
6. Install dependencies.
7. Generate migrations with `npm run db:generate`.
8. Apply migrations with `npm run db:migrate`.

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
