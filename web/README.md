# Otto Web

Otto `web` is the control-plane application for tenant onboarding, provisioning, and operations.

## Responsibilities

- Next.js request-response UI and API work
- WorkOS authentication and tenant management
- durable job state stored in Postgres
- a dedicated worker process for provisioning and later runtime apply flows

## Local setup

1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL` to a local Postgres instance.
3. Install dependencies.
4. Generate migrations with `npm run db:generate`.
5. Apply migrations with `npm run db:migrate`.

## Local development

Run the web app:

```bash
npm run dev
```

Run the worker:

```bash
npm run worker
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
