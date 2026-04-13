# DONE 24: Web Codebase Contraction

## Goal

Retire the legacy `web/` folder completely so the repo has one active set of execution surfaces:

- `apps/web`
- `apps/api`
- `apps/worker`
- `apps/gateway`
- shared packages under `packages/`
- root-owned Drizzle migrations under `drizzle/`

## Scope completed

- reconciled spec state after the legacy workspace cutover
- moved migration ownership out of `web/` and into the repo root
- moved operational Docker and env entrypoints out of `web/` and into the repo root
- removed the obsolete `web` package scaffolding, docs, route trees, integration UI, tests, and runtime helper residue
- deleted the `web/` folder entirely

## Final ownership model

- `apps/web`
  - browser UI and SPA shell
- `apps/api`
  - browser-facing API, OAuth/webhook adapters, runtime HTTP adapters
- `apps/worker`
  - background jobs, provisioning, apply, runtime orchestration
- `apps/gateway`
  - runtime integration execute gateway
- `packages/features/runtime-core`
  - runtime substrate and projection logic
- `packages/features/integrations-runtime`
  - provider-specific runtime integration logic
- `drizzle/`
  - active migrations

## Key changes

- root `drizzle.config.ts`, `drizzle/*`, `package.json`, and `Dockerfile.migrate` now own migration generation and application
- root `docker-compose.yml`, `docker-compose.prod.yml`, `Caddyfile`, `.env.example`, and `.env.production.example` are now the operational entrypoints
- repo-root `test/production-routing-audit.test.ts` and `test/terminology-audit.test.ts` now hold the still-useful guardrails that were previously stranded in `web/`
- the remaining live runtime/provider code was either already extracted or judged unused and deleted under the user’s “delete and restore if needed” rule

## Acceptance criteria met

- no production or development workflow depends on `web/`
- `db:migrate` no longer depends on `web/`
- repo-level dev/build entrypoints point at extracted apps, not `web/`
- the legacy `web/` folder is gone

## Verification

- `bun run db:migrate`
- `bun run build:api`
- `bun run build:web`
- `docker compose -f docker-compose.prod.yml build migrate`
- `node --test test/production-routing-audit.test.ts`
- `node --test test/terminology-audit.test.ts`

## Notes

- Older historical specs may still mention `web/` paths as implementation history. Those references should be read as historical breadcrumbs, not current ownership.
