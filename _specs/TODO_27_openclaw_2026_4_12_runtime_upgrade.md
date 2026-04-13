# TODO 27: OpenClaw 2026.4.12 Runtime Upgrade

## Goal

Upgrade Otto's managed runtime base from OpenClaw `2026.4.8` to OpenClaw
`2026.4.12` with plugin packaging normalized first and the custom Otto runtime
image, defaults, and validation flow moved forward together.

## Scope

- review the OpenClaw `2026.4.12` release for Otto-relevant changes
- normalize Otto runtime plugin packaging to match newer OpenClaw expectations
- bump the custom runtime image base tag and related defaults, docs, and tests
- define the validation path before any shared-environment rollout

## Decision Summary

- Upgrade to OpenClaw `2026.4.12`.
- Keep the bump focused on compatibility; do not fold in `Active Memory`,
  Codex, LM Studio, or other additive upstream features as part of the same
  change.
- Normalize bundled runtime plugin packaging first:
  - add `package.json` to `runtime-plugins/otto-web-provider`
  - add `openclaw.extensions` to `otto-integrations`
  - add `openclaw.extensions` to `otto-session-reporter`
  - keep `otto-workspace-chat` aligned with the same packaged shape
- Move repo defaults and custom-image examples to `2026.4.12` after that
  metadata normalization.

## Current Implementation State

- `runtime-image/Dockerfile` now defaults to
  `ghcr.io/openclaw/openclaw:2026.4.12`
- `publish-runtime-image.sh`, env examples, worker env defaults, and runtime
  image docs now align with the same `2026.4.12` baseline
- bundled runtime plugin package metadata is normalized around
  `package.json` `openclaw.extensions`

## Remaining Validation

- build the Otto custom runtime image locally
- boot a tenant-like runtime against the updated image
- verify bundled plugin discovery and the `openai-proxy`,
  web-search-proxy, integrations, and session-reporter paths
