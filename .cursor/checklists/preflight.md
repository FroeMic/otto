# Preflight Checklist

Run these checks before starting implementation or debugging.

## 1) Confirm branch and workspace state

- `git rev-parse --abbrev-ref HEAD`
- `git status --short --branch`

## 2) Ensure toolchain is available

- `command -v bun`
- `bun --version`
- `command -v psql`

Optional:

- `command -v docker`

If Docker is missing, continue with the local Postgres service fallback in
`.cursor/runbooks/dev-cloud.md`.

## 3) Ensure environment file exists

- `test -f .env || cp .env.example .env`

## 4) Ensure database is available

Preferred:

- `docker compose -f docker-compose.yml up -d`

Fallback:

- `sudo service postgresql start`
- `sudo -u postgres createdb otto` (only if missing)
- `sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';"`
- set `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/otto`

## 5) Install dependencies and migrate

- `bun install`
- `bun run db:migrate`

## 6) Start or reuse dev services in tmux

Session name convention:

- `workspace-dev-all` (preferred)
- `otto-dev-all` (legacy session name that may already exist)

Startup:

- `bun run dev:all`

## 7) Verify service health

- web: `curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4100/`
- api: `curl -sS http://127.0.0.1:3002/healthz`
- gateway: `curl -sS http://127.0.0.1:3001/healthz`

## 8) Runtime worker sanity check

- confirm worker logs are active in tmux
- verify jobs can be claimed without immediate fatal env errors

