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
- SSH and SFTP support should be treated as server-only concerns:
  - run in Node.js runtime only
  - do not import SSH code into client components
  - do not depend on Edge runtime for provisioning or config apply flows
- Add env validation for the shared SSH contract before implementing the wrappers.
- The minimum shared env contract for SSH-backed runtime management should include:
  - `RUNTIME_DEPLOY_PRIVATE_KEY`
  - `RUNTIME_DEPLOY_PUBLIC_KEY`
  - `RUNTIME_SSH_USERNAME`
  - `RUNTIME_SSH_PORT`
  - `RUNTIME_SSH_READY_TIMEOUT_MS`
  - `RUNTIME_SSH_COMMAND_TIMEOUT_MS`
- Strongly preferred security envs:
  - `RUNTIME_SSH_KNOWN_HOSTS`
- Optional future envs for a bastion model:
  - `RUNTIME_SSH_BASTION_HOST`
  - `RUNTIME_SSH_BASTION_PORT`
  - `RUNTIME_SSH_BASTION_USERNAME`
  - `RUNTIME_SSH_BASTION_PRIVATE_KEY`
- Keep tenant-specific connection data such as IPs or hostnames out of env:
  - those belong in the database on `tenant_servers`
  - env should only hold control-plane-level credentials and defaults
- Treat the Hetzner integration the same way:
  - use server-side code only
  - keep credentials and default provisioning knobs in validated env
  - keep tenant-specific Hetzner IDs and observed VPS state in the database
- The minimum shared env contract for Hetzner should include:
  - `HETZNER_API_TOKEN`
- Recommended default provisioning envs:
  - `HETZNER_DEFAULT_LOCATION`
  - `HETZNER_DEFAULT_SERVER_TYPE`
  - `HETZNER_DEFAULT_IMAGE`
  - `HETZNER_POLL_INTERVAL_MS`
  - `HETZNER_ACTION_TIMEOUT_MS`
- Optional envs if we want explicit API tuning:
  - `HETZNER_API_BASE_URL`
- Keep provider resource IDs out of env:
  - server IDs
  - action IDs
  - image IDs chosen per tenant
  - these belong in DB state and workflow payloads

## Exit criteria

- app boots with validated env
- database connection works locally
- first migration can be applied
- base module layout exists

## Status checklist

- [x] choose database library
- [x] add env validation
- [x] define SSH env contract
- [x] define Hetzner env contract
- [x] create initial schema files
- [x] create shared service directories
- [x] update local setup docs

## Open questions

- Should the worker live under `web/` or as a sibling package once the repo grows?
- Current decision: keep the worker under `web/` until repository boundaries become a real constraint.
