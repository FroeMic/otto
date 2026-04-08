# TODO 04: Runtime Packaging

## Goal

Define and validate the reproducible OpenClaw runtime that will be placed on each tenant VPS.

## Scope

- choose base runtime image strategy
- define docker compose layout
- harden runtime defaults
- verify local and remote startup path

## Dependencies

- `TODO_03_provisioning_workflow.md`

## Implementation notes

- Treat runtime packaging as a separate concern from provisioning.
- Pin OpenClaw version and any system dependencies.
- The monorepo should own Otto-specific OpenClaw plugins and build a thin
  custom runtime image layer on top of upstream OpenClaw instead of forking the
  whole runtime repo.
- Keep Otto-owned runtime plugins under `runtime-plugins/` and copy them into
  `/app/extensions` in the custom runtime image so OpenClaw discovers them as
  bundled plugins.
- Pin the upstream OpenClaw base image to an actual published container tag
  such as `ghcr.io/openclaw/openclaw:2026.4.8`, not only a Git release name.
- The initial container should listen on all container interfaces, but publish only the required host port and prefer host-loopback binding unless a public ingress is explicitly required.

## Exit criteria

- runtime image and compose definition are pinned
- runtime starts on a provisioned VPS
- restart path is deterministic

## Status checklist

- [x] choose image build strategy
- [x] define monorepo-owned custom runtime image layering for Otto plugins
- [x] document a repeatable GHCR publish path for the custom runtime image
- [ ] define compose file
- [x] validate host-loopback-only publish with container-wide binding
- [x] verify non-root runtime

## Open questions

- Should v1 keep the current direct `docker run` start path, or should the control plane install Docker Compose on tenant hosts before calling runtime apply complete?
