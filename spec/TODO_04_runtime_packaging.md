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
- The initial container should bind only to loopback on the VPS.

## Exit criteria

- runtime image and compose definition are pinned
- runtime starts on a provisioned VPS
- restart path is deterministic

## Status checklist

- [ ] choose image build strategy
- [ ] define compose file
- [ ] validate loopback-only binding
- [ ] verify non-root runtime

## Open questions

- Should image build and publish happen inside this repo or from an upstream runtime repo?
