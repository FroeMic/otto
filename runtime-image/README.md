# Otto Runtime Image

This directory defines the thin Otto-owned runtime image layer that extends the
upstream OpenClaw image with Otto-specific runtime plugins.

## Current contents

- bundled `otto-managed-config` plugin under `/app/extensions/otto-managed-config`
- bundled `otto-runtime-config` plugin under `/app/extensions/otto-runtime-config`
- bundled `otto-integrations` plugin under `/app/extensions/otto-integrations`
- bundled `otto-session-reporter` plugin under `/app/extensions/otto-session-reporter`
- bundled `otto-ai-provider` plugin under `/app/extensions/otto-ai-provider`
- Otto-owned WhatsApp QR helper under `/app/otto-helpers/whatsapp-qr-login.mjs`

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
