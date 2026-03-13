# TODO 01: Repo Foundation

## Goal

Turn the scaffold into a workable control-plane foundation with env management, database access, and internal module boundaries.

## Scope

- add Postgres access
- add schema and migrations
- create base library directories
- define env validation
- replace placeholder docs with repo-specific setup instructions

## Dependencies

- `TODO_00_architecture_and_job_runtime.md`

## Implementation notes

- Add a schema tool such as Drizzle if that remains the preferred fit.
- Create initial directories:
  - `web/src/app`
  - `web/src/db`
  - `web/src/lib/jobs`
  - `web/src/lib/hetzner`
  - `web/src/lib/ssh`
  - `web/src/lib/runtime`
  - `web/src/lib/openclaw`
- Centralize env parsing so worker and web paths share the same config contract.

## Exit criteria

- app boots with validated env
- database connection works locally
- first migration can be applied
- base module layout exists

## Status checklist

- [ ] choose database library
- [ ] add env validation
- [ ] create initial schema files
- [ ] create shared service directories
- [ ] update local setup docs

## Open questions

- Should the worker live under `web/` or as a sibling package once the repo grows?
