# Otto Runtime Image

This directory defines the thin Otto-owned runtime image layer that extends the
upstream OpenClaw image with Otto-specific runtime plugins.

## Current contents

- bundled `otto-managed-config` plugin under `/app/dist/extensions/otto-managed-config`
- bundled `otto-integrations` plugin under `/app/dist/extensions/otto-integrations`
- bundled `otto-session-reporter` plugin under `/app/dist/extensions/otto-session-reporter`
- bundled `otto-ai-provider` plugin under `/app/dist/extensions/otto-ai-provider`
- bundled `otto-workspace-chat` plugin under `/app/dist/extensions/otto-workspace-chat`

The image also includes Otto helper processes under `/app/otto-helpers`:

- `start-runtime-with-watchers.mjs` to launch Gateway plus Otto companions
- `cron-sync-watcher.mjs` to push scheduled-task snapshots
- `runtime-bridge-reporter.mjs` to report tenant bridge liveness, gateway health, and enabled Otto plugin ids back to the control plane

OpenClaw `2026.4.8` resolves bundled plugins from `/app/dist/extensions` in the
published image. Copying Otto-owned plugins into `/app/extensions` leaves them
undiscoverable at runtime.

The image also creates `/home/node/.openclaw` with restrictive defaults, and
Otto's runtime apply path hardens the mounted runtime home to match doctor
expectations (`700` on the state dir, `600` on `openclaw.json`).

## Build

From the repo root:

```bash
docker build -f runtime-image/Dockerfile -t otto/openclaw-runtime:local .
```

Or use the publish helper:

```bash
IMAGE_REVISION=1 ./publish-runtime-image.sh
```

To pin a specific upstream OpenClaw base image:

```bash
docker build \
  -f runtime-image/Dockerfile \
  --build-arg OPENCLAW_BASE_IMAGE=ghcr.io/openclaw/openclaw:2026.4.8 \
  -t ghcr.io/froemic/otto-openclaw:2026.4.8.1 .
```

With the helper:

```bash
IMAGE_REVISION=1 \
OPENCLAW_BASE_IMAGE=ghcr.io/openclaw/openclaw:2026.4.8 \
./publish-runtime-image.sh
```

## Publish to GHCR

The helper defaults to:

- `IMAGE_REPO=ghcr.io/froemic/otto-openclaw`
- `PLATFORMS=linux/amd64`

Authenticate once with Docker, or provide:

```bash
export GHCR_USERNAME=<github-username>
export GHCR_TOKEN=<github-personal-access-token-or-actions-token>
```

Then publish:

```bash
IMAGE_REVISION=1 ./publish-runtime-image.sh
```

For a local-only build without pushing:

```bash
IMAGE_TAG=dev-local PUSH_IMAGE=0 LOAD_IMAGE=1 ./publish-runtime-image.sh
```

## Use

Point the control plane at the published custom image:

```bash
RUNTIME_OPENCLAW_IMAGE=ghcr.io/froemic/otto-openclaw:2026.4.8.1
```

Tenant provisioning and later `apply_tenant_config` runs will then pull this
image instead of the raw upstream OpenClaw image.
