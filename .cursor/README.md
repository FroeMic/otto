# Cursor Workspace Guide

This directory is the quick-start layer for cloud agents and local Cursor sessions.

## Source of truth

- `AGENTS.md` is the canonical policy and architecture guide.
- `_specs/` is the canonical planning and sequencing guide.
- Files in `.cursor/` are execution runbooks and checklists only.

## Start here

1. Read `AGENTS.md`.
2. Read `_specs/README.md` and `_specs/STATUS.md`.
3. Run `.cursor/checklists/preflight.md`.
4. Use a runbook in `.cursor/runbooks/` for the task type.

## Directory map

- `.cursor/checklists/preflight.md`
  - baseline commands before coding/testing
- `.cursor/runbooks/dev-cloud.md`
  - cloud VM environment setup and fallback flows
- `.cursor/runbooks/tenant-runtime-testing.md`
  - provider-mode testing strategy for tenant runtime work
- `.cursor/context/links.md`
  - pointers to key specs and code areas
