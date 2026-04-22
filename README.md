# Otto

Otto is a Bun-based monorepo for the workspace app, API, worker, gateway, and shared runtime packages that power managed tenant runtimes.

## Repo layout

- `apps/web`
  Browser app and SPA shell.
- `apps/api`
  Hono API, OAuth/webhook adapters, and runtime HTTP adapters.
- `apps/worker`
  Background jobs, provisioning, apply, sync, and runtime orchestration.
- `apps/gateway`
  Runtime integration execute gateway.
- `packages/features/runtime-core`
  Runtime substrate, projection, ingest, and normalization logic.
- `packages/features/integrations-runtime`
  Provider-specific runtime integration logic.
- `drizzle/`
  Active Drizzle migrations.
- `_specs/`
  Planning state, implementation order, and operational status.
- `_docs/`
  Focused reference docs.

## Architecture

Otto is split by execution surface first, with shared runtime logic extracted into packages.

```text
browser
  |
  v
apps/web
  |
  +--> apps/api -----------------------------+
  |      |                                   |
  |      +--> Postgres                       |
  |      +--> packages/features/runtime-core |
  |      +--> packages/features/integrations-runtime
  |
  +--> apps/gateway
  |      |
  |      +--> packages/features/integrations-runtime
  |
  +--> apps/worker
         |
         +--> Postgres
         +--> packages/features/runtime-core
         +--> tenant runtimes over SSH / runtime callbacks
```

Current responsibilities:

- `apps/web`
  Owns the browser app, app shell, settings shell, and feature UI under `src/features/*`.
- `apps/api`
  Owns the browser-facing Hono API, OAuth/webhook routes, and runtime-facing HTTP adapters.
- `apps/worker`
  Owns background execution: provisioning, apply, sync jobs, billing jobs, and runtime operations.
- `apps/gateway`
  Owns integration execute traffic for tenant runtimes.
- `packages/features/runtime-core`
  Owns runtime substrate that is not HTTP-specific and not provider-specific.
- `packages/features/integrations-runtime`
  Owns provider-specific runtime integration logic shared across API, gateway, and runtime flows.
- `drizzle/`
  Owns schema migrations at the repo root.

Why it is split this way:

- `apps/web` stays browser-only so UI, routing, and app-shell work do not get mixed with backend orchestration.
- `apps/api` stays request/response focused so browser-facing HTTP logic, auth, and RPC contracts remain thin and type-safe.
- `apps/worker` is isolated because provisioning, apply, sync, and billing work are long-running and failure-prone by nature; they should not block request handlers.
- `apps/gateway` is separate because tenant runtime integration execution is proxied through it; keeping that traffic in its own service reduces blast radius and avoids coupling runtime execute load to the browser/API surface.
- `packages/features/runtime-core` exists for runtime substrate that is shared across services, such as managed config, runtime files, sessions, and scheduled-task normalization.
- `packages/features/integrations-runtime` exists separately because provider-specific integration behavior is a real shared engine used by API, gateway, and runtime-facing flows.

Design rule:

- product surfaces stay local to `apps/web` and `apps/api`
- worker-only orchestration stays in `apps/worker`
- only genuinely shared runtime substrate moves into `packages/features/*`

## Start here

If you are orienting yourself in the codebase:

1. Read [`_specs/README.md`](_specs/README.md)
2. Read [`_specs/STATUS.md`](_specs/STATUS.md)
3. Read the first incomplete `_specs/TODO_*.md` in sequence unless you are working on a specific slice

If you just want to run the app locally:

1. Install dependencies
```bash
bun install
```

2. Create your env file
```bash
cp .env.example .env
```

3. Start Postgres
```bash
docker compose -f docker-compose.yml up -d
```

4. Run migrations
```bash
bun run db:migrate
```

5. Start the services
```bash
bun run dev:all
```

Docker provider lab mode (optional):

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.docker-provider.yml up -d worker
```

Default local services:
- `apps/web`: `http://localhost:3000`
- `apps/api`: `http://localhost:3002`
- `apps/gateway`: `http://localhost:3001`

## Common commands

```bash
bun run build:web
bun run build:api
bun run build:worker
bun run build:gateway

bun run test:web
bun run test:api
bun run test:worker
bun run test:gateway
```

Repo-level checks:

```bash
node --test test/production-routing-audit.test.ts
node --test test/terminology-audit.test.ts
```

## Environment

Use:
- [`.env.example`](.env.example) for local development
- [`.env.production.example`](.env.production.example) for production shape

Important local prerequisites:
- Bun
- Docker
- Postgres via `docker compose`
- WorkOS credentials
- Slack credentials
- Hetzner credentials for real provisioning

## Deployment

Production entrypoints now live at the repo root:
- [`docker-compose.prod.yml`](docker-compose.prod.yml)
- [`Caddyfile`](Caddyfile)
- [`Dockerfile.migrate`](Dockerfile.migrate)

Typical production flow:

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml --profile ops run --rm migrate
docker compose -f docker-compose.prod.yml up -d
```

## References

- Planning and status:
  - [`_specs/README.md`](_specs/README.md)
  - [`_specs/STATUS.md`](_specs/STATUS.md)
- Hetzner reference:
  - [`_docs/hetzner-cloud-reference.md`](_docs/hetzner-cloud-reference.md)
- Architecture notes:
  - [`spec_architecture.md`](spec_architecture.md)
