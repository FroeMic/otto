# Cloud Dev Runbook

Use this runbook when starting or resuming work in a cloud agent VM.

## 1) Verify toolchain

Run:

- `command -v bun`
- `command -v psql`
- `command -v docker` (optional in cloud VMs; may be missing)

If Bun is missing:

- `curl -fsSL https://bun.sh/install | bash`
- `export PATH="$HOME/.bun/bin:$PATH"`

## 2) Prepare repo env

Run from repo root:

- `cp .env.example .env` (if `.env` is missing)
- `bun install`

## 3) Start Postgres

Preferred path (when Docker is available):

- `docker compose -f docker-compose.yml up -d`

Fallback path (when Docker is unavailable):

- install system Postgres
- start service
- ensure database `otto` exists
- ensure `postgres` user has local password expected by env

## 4) Migrate schema

Run:

- `bun run db:migrate`

If local Postgres port differs from `.env`, override `DATABASE_URL` for this command.

## 5) Start dev services in tmux

Use a named tmux session (recommended `workspace-dev-all`):

- `bun run dev:all`

Default service ports in this repo:

- web: `4100`
- api: `3002`
- gateway: `3001`

## 6) Health checks

Run:

- `curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4100/`
- `curl -sS http://127.0.0.1:3002/healthz`
- `curl -sS http://127.0.0.1:3001/healthz`

## 7) Known cloud caveat

Some cloud VMs do not include Docker. In those environments:

- continue control-plane/API/web/worker work with local Postgres
- use `fake` provisioning mode for non-infra runtime tests
- reserve Docker-backed tenant-host integration tests for environments with Docker available
