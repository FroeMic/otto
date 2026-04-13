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
