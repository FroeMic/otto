# Otto Runtime Image

This directory defines the thin Otto-owned runtime image layer that extends the
upstream OpenClaw image with Otto-specific runtime plugins.

## Current contents

- bundled `otto-managed-config` plugin under `/app/extensions/otto-managed-config`

## Build

From the repo root:

```bash
docker build -f runtime-image/Dockerfile -t otto/openclaw-runtime:local .
```

To pin a specific upstream OpenClaw base image:

```bash
docker build \
  -f runtime-image/Dockerfile \
  --build-arg OPENCLAW_BASE_IMAGE=ghcr.io/openclaw/openclaw:2026.3.14 \
  -t ghcr.io/froemic/otto-openclaw:2026.3.14-1 .
```

## Use

Point the control plane at the published custom image:

```bash
RUNTIME_OPENCLAW_IMAGE=ghcr.io/froemic/otto-openclaw:2026.3.14-1
```

Tenant provisioning and later `apply_tenant_config` runs will then pull this
image instead of the raw upstream OpenClaw image.
