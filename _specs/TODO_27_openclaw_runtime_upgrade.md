# TODO 27: OpenClaw Runtime Upgrade

## Goal

Upgrade Otto's managed runtime base from OpenClaw `2026.4.12` to OpenClaw
`2026.4.15` while keeping the custom Otto runtime image, defaults, and
validation flow aligned.

## Scope

- review the OpenClaw `2026.4.15` release for Otto-relevant changes
- bump the custom runtime image base tag and related defaults, docs, and tests
- define the validation path before any shared-environment rollout

## Decision Summary

- Upgrade to OpenClaw `2026.4.15`.
- Keep the bump focused on compatibility; do not fold in `Active Memory`,
  Codex, LM Studio, or other additive upstream features as part of the same
  change.
- Keep the existing bundled runtime plugin packaging shape and move plugin
  package versions forward with the custom runtime image tag.

## Current Implementation State

- `runtime-image/Dockerfile` now defaults to
  `ghcr.io/openclaw/openclaw:2026.4.15`
- `publish-runtime-image.sh`, env examples, worker env defaults, and runtime
  image docs now align with the same `2026.4.15` baseline
- bundled runtime plugin package versions now align with the custom
  `2026.4.15.1` image tag

## Remaining Validation

- build the Otto custom runtime image locally
- boot a tenant-like runtime against the updated image
- verify bundled plugin discovery and the `openai-proxy`,
  web-search-proxy, integrations, and session-reporter paths
