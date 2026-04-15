#!/usr/bin/env bash
set -euo pipefail

required_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required env: ${name}" >&2
    exit 1
  fi
}

required_env HETZNER_API_TOKEN
required_env HETZNER_DEFAULT_LOCATION
required_env HETZNER_DEFAULT_SERVER_TYPE
required_env HETZNER_SSH_KEY_NAMES
required_env RUNTIME_OPENCLAW_IMAGE

GENERATION="${1:-$(date -u +%Y-%m-%d.%H%M%S)}"
BASE_IMAGE="${HETZNER_BASE_IMAGE:-ubuntu-24.04}"
SNAPSHOT_METADATA_PATH="/opt/openclaw/runtime/snapshot-metadata.json"

cat <<EOF
Snapshot bake plan
  generation: ${GENERATION}
  base image: ${BASE_IMAGE}
  location: ${HETZNER_DEFAULT_LOCATION}
  server type: ${HETZNER_DEFAULT_SERVER_TYPE}
  runtime image: ${RUNTIME_OPENCLAW_IMAGE}

Manual steps:
1. Create a temporary host from ${BASE_IMAGE}.
2. Bootstrap Docker and /opt/openclaw on that host.
3. Pull ${RUNTIME_OPENCLAW_IMAGE}.
4. Write ${SNAPSHOT_METADATA_PATH} with generation/runtime metadata.
5. Power off the host.
6. Create the Hetzner snapshot and set:
   HETZNER_DEFAULT_SNAPSHOT_IMAGE=<snapshot-id>
   HETZNER_SNAPSHOT_EXPECTED_RUNTIME_IMAGE=${RUNTIME_OPENCLAW_IMAGE}
   HETZNER_SNAPSHOT_GENERATION=${GENERATION}
EOF
