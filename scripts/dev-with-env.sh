#!/usr/bin/env sh

set -eu

if [ "$#" -eq 0 ]; then
  echo "Usage: scripts/dev-with-env.sh <command...>" >&2
  exit 1
fi

if [ ! -f ".env" ]; then
  echo "Missing .env in repo root. Copy .env.example or .env.example.docker first." >&2
  exit 1
fi

set -a
. ./.env
set +a

exec "$@"
