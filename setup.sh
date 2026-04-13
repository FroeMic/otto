#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$SCRIPT_DIR"
git pull origin main

docker compose -f docker-compose.prod.yml build api web worker integration-gateway caddy migrate
docker compose -f docker-compose.prod.yml --profile ops run --rm migrate
docker compose -f docker-compose.prod.yml up -d api web worker integration-gateway caddy
docker compose -f docker-compose.prod.yml logs --tail=200 api web worker integration-gateway caddy
