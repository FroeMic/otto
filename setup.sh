#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$SCRIPT_DIR"
git pull

cd web
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
