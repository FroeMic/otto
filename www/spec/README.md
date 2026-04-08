# Otto Marketing Site Spec Workflow

This folder is the source of truth for the public website plan.

## Purpose

- keep the marketing site work separate from the workspace app plan in `/spec`
- preserve decisions about content, experimentation, and design direction
- sequence landing-page work in small increments that can ship independently

## Conventions

- `TODO_XX_name.md` means planned or in progress work
- `DONE_XX_name.md` means the spec has been implemented and verified enough to retire from the active queue
- lower numbers should usually be completed first unless a spec explicitly says otherwise
- every spec should include:
  - goal
  - scope
  - dependencies
  - implementation notes
  - acceptance criteria
  - status checklist
  - open questions

## Session state

- `STATUS.md` is the short operational memory for the next session
- update `STATUS.md` whenever priorities, blockers, or the next recommended step change
- when a spec starts, note that in `STATUS.md`
- when a spec is finished, rename it from `TODO_` to `DONE_` and update `STATUS.md`

## Initial implementation order

1. `TODO_00_www_foundation_and_theme.md`
2. `TODO_01_homepage_information_architecture.md`
3. `TODO_02_posthog_measurement_and_experiments.md`
4. `TODO_03_growth_pages_and_content_expansion.md`

## Working assumptions

- `www/` is the current legacy home of the public website, but the long-term direction is now a unified browser-facing frontend captured in `/Users/michaelfrohlich/Repositories/otto/spec/TODO_20_unified_frontend_and_hono_migration.md`
- `web/` remains the current legacy workspace app during that migration
- the public site should reuse Otto's warm, rounded visual language without coupling itself to workspace-only code
- shadcn is the default component base
- Magic UI can be used for fast marketing-site prototyping, but only via local env setup and never by committing registry credentials
- the first ship target is a minimal public site with clear positioning and measurable CTA flow, not a large content machine
