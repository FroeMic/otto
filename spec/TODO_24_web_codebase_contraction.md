# TODO 24: Web Codebase Contraction

## Goal

Shrink `web/` from a former product app into either:

- a small temporary home for migrations and operator scripts
- or nothing at all once migration ownership moves elsewhere

Do that by reconciling the spec state, inventorying what is still truly required, and deleting or quarantining duplicated backend/runtime logic that should no longer live in `web/`.

## Scope

- refresh `spec/STATUS.md` so it reflects the post-cutover repo state
- close the legacy workspace retirement track and move the remaining `web/` cleanup into its own explicit follow-up
- classify remaining `web/` code into:
  - required now
  - required temporarily
  - duplicate and removable
  - dead
- delete clearly dead legacy workspace/product code
- quarantine or re-home duplicated backend/runtime logic before deleting it
- plan migration ownership out of `web/`

## Non-goals

- reintroducing any legacy workspace UI
- deleting runtime auth or tenant gateway token plumbing that is still used by extracted services
- doing opportunistic refactors unrelated to `web/` contraction
- collapsing everything in one giant unsafe PR

## Dependencies

- `DONE_23_legacy_web_retirement_and_domain_cutover.md`
- `TODO_20_unified_frontend_and_hono_migration.md`
- `TODO_11_runtime_release_rollout.md`
- `TODO_14_session_history_visibility.md`

## Why this work exists

- the workspace app cutover is done, but `web/` still looks more alive than it should
- spec state is now behind the actual implementation state
- duplicated backend/runtime code in `web/` increases confusion and future regression risk
- migration ownership still lives under `web/`, which blocks full retirement

## Current assessment

### Required now

- `web/drizzle/*`
  - migration ownership still lives here
- `web/package.json`
  - still owns `db:migrate` and `db:generate`
- selected operator scripts
  - for example `web/src/scripts/tenant-runtime.ts`
  - these should eventually move, but they are not dead just because the workspace UI moved
- `web/src/app/api/internal/runtime/integrations/[integrationKey]/settings/route.ts`
  - this still looks like a runtime-facing compatibility seam and must be verified before deletion
- `web/src/lib/hetzner/*`
  - this still appears to be the main Hetzner provisioning home and does not yet have an extracted owner
- `web/src/lib/ssh/*`
  - this still appears to back host mutation and runtime access primitives
- `web/src/lib/providers/*`
  - OpenAI tenant provisioning still appears to live here
- `web/src/scripts/*`
  - these are operational scripts, not workspace UI
- `web/src/worker/*`
  - legacy worker entrypoint still exists as fallback and should be explicitly retired, not implicitly deleted

### Likely required temporarily

- selected DB/schema access code that still exists only to support migration tooling or remaining scripts
- selected backend/runtime helpers that have not yet been re-homed into `apps/api`, `apps/worker`, `packages/features/runtime-core`, or `packages/features/integrations-runtime`
- `web/src/db/*` outside migrations
  - much of this is duplicated or transitional, but some parts may still support scripts and remaining operator flows
- `web/src/lib/billing/*`
  - needs explicit ownership verification before deletion because billing state and Stripe handling still exist
- `web/src/lib/oauth/*`
  - likely transitional after the OAuth route extraction, but still needs proof before removal
- `web/src/lib/posthog/*`
  - likely no longer central, but should be confirmed before deletion
- `web/src/lib/runtime-ai/*`
  - runtime AI proxy planning and canary work still point at `web/` in parts of the spec
- `web/src/lib/runtime-integrations/*`
  - likely transitional runtime integration substrate
- `web/src/lib/runtime-web-search/*`
  - likely transitional Brave/web-search substrate
- `web/src/tools/*`
  - appears to be legacy runtime-surface ownership that may now be partly superseded but should be explicitly audited

### Duplicate and removable after verification

- legacy workspace routes and UI under `web/src/app/[orgSlug]/**`
- legacy workspace-only components under `web/src/components/*`
- duplicated runtime/job/control-plane code where extracted owners now exist, for example:
  - `web/src/db/control-plane.ts`
  - `web/src/lib/jobs/*`
  - `web/src/lib/runtime/*`
  - `web/src/lib/openclaw/*`
  - `web/src/integrations/framework/*`
- `web/src/integrations/library/*/ui/*`
  - new workspace-facing integrations UI now lives in `apps/web`
- `web/src/lib/managed-integrations/*`
  - new extracted integrations surfaces and packages should become the owners
- `web/src/lib/managed-skills/*`
  - new extracted skills ownership now lives in `apps/web`, `apps/api`, and `packages/features/runtime-core`
- `web/src/lib/scheduled-tasks/*`
  - scheduled-task product surface now lives in extracted apps and runtime-core
- `web/src/lib/runtime/workspace-files.ts`
- `web/src/lib/runtime/skill-files.ts`
- `web/src/lib/runtime/file-download.ts`
  - file-browser ownership is now in extracted apps plus runtime-core

### Dead or near-dead

- legacy workspace UI pages that no longer serve production traffic
- compatibility docs and tests that still describe `web/` as the live workspace boundary
- `web/src/app/[orgSlug]/**`
  - old org-scoped workspace UI
- `web/src/app/onboarding/**`
  - old onboarding UI was intentionally discontinued
- `web/src/components/app-sidebar.tsx`
- `web/src/components/organization-shell.tsx`
- `web/src/components/runtime-file-browser.tsx`
  - these are replaced by extracted shell and file-browser code

## Progress so far

- the legacy org-scoped route entrypoints under `web/src/app/[orgSlug]/**` have been removed
- the dead onboarding wait-state page under `web/src/app/onboarding/**` has been removed
- orphaned route-only support files were also removed, including:
  - legacy workspace shell components
  - legacy runtime file browser UI
  - route-local scheduled-task, sessions, skills, agent, and settings support files that no longer had entrypoints
- the remaining notable keepers inside `web/src/app/[orgSlug]` are now mostly shared helper files still imported by:
  - legacy platform pages
  - legacy integration UI
- the legacy `web/src/app/platform/**` operator route tree has also been removed
- after removing both the legacy workspace and legacy platform route trees, `bun run --cwd web build` still passes

## Directory inventory

### Keep for now

- `web/drizzle/*`
- `web/src/lib/hetzner/*`
- `web/src/lib/ssh/*`
- `web/src/lib/providers/*`
- `web/src/scripts/*`
- `web/src/worker/*`

### Quarantine and re-home deliberately

- `web/src/db/*`
- `web/src/lib/jobs/*`
- `web/src/lib/runtime/*`
- `web/src/lib/openclaw/*`
- `web/src/lib/billing/*`
- `web/src/lib/oauth/*`
- `web/src/lib/runtime-ai/*`
- `web/src/lib/runtime-integrations/*`
- `web/src/lib/runtime-web-search/*`
- `web/src/tools/*`
- `web/src/integrations/framework/*`
- `web/src/integrations/library/*` excluding any still-live ingress/runtime seams that are not yet extracted

### Delete first

- `web/src/app/[orgSlug]/**`
- `web/src/app/onboarding/**`
- `web/src/components/*` that only supported the legacy workspace shell
- legacy integration UI files under `web/src/integrations/library/*/ui/*`
- stale boundary/status docs and tests that still treat `web/` as the live workspace app

## Implementation notes

### Sequence

Do this in five small PRs.

### PR A: Reconcile spec state

Goal:
- make the plan reflect reality before deleting code

Work:
- update `spec/STATUS.md` to remove stale post-cutover wording
- point the next recommended step at this `TODO_24` cleanup track
- make sure `DONE_23` is the source of truth for completed legacy retirement
- update `spec/README.md` ordering and references

Acceptance criteria:
- no active spec still claims the domain/env cutover is in progress
- `STATUS.md` points at `TODO_24` as the next cleanup track

### PR B: Inventory and quarantine

Goal:
- classify the remaining `web/` code before deleting anything substantial

Work:
- add a `web/README.md` section or replacement note stating `web/` is no longer the live workspace app
- produce a concrete file-group inventory:
  - required now
  - required temporarily
  - duplicate and removable
  - dead
- identify the exact owners for any duplicated code:
  - `apps/api`
  - `apps/worker`
  - `packages/features/runtime-core`
  - `packages/features/integrations-runtime`
  - or a future dedicated DB/migrations home

Acceptance criteria:
- every major `web/` directory is classified
- no future deletion work depends on guesswork

### PR C: Delete dead legacy workspace/product code

Goal:
- remove the most obviously obsolete code first

Work:
- delete legacy workspace routes under `web/src/app/[orgSlug]/**`
- delete legacy workspace-only components no longer used anywhere
- delete legacy integration UI files that were replaced by `apps/web`
- remove or rewrite stale legacy-boundary docs/tests that no longer describe the live app shape

Acceptance criteria:
- `web/` no longer contains the old workspace product UI
- no production workspace surface is implemented twice

### PR D: Move migration ownership out of `web/`

Goal:
- unblock eventual full retirement of `web/`

Work:
- decide the durable home for schema and migrations
- preferred target: a dedicated DB/migrations package, for example `packages/control-plane-db`
- move:
  - Drizzle config
  - schema ownership
  - migration files
  - migrate/generate commands
- update deployment and ops docs accordingly

Acceptance criteria:
- `db:migrate` no longer depends on `web/`
- `web/` is no longer the schema/migration owner

### PR E: Delete duplicated backend/runtime logic

Goal:
- remove shadow copies in `web/` once extracted owners are proven

Work:
- audit and delete duplicated code in:
  - `web/src/db/*`
  - `web/src/lib/jobs/*`
  - `web/src/lib/runtime/*`
  - `web/src/lib/openclaw/*`
  - `web/src/integrations/framework/*`
- only delete a group when:
  - the extracted owner exists
  - no production or operator path imports the `web/` copy
  - tests/builds pass without it

Acceptance criteria:
- no production service depends on `web/src/*`
- `web/` contains only explicitly temporary or intentionally retained code

## File-system ownership target

### `apps/web`

Owns:
- browser-facing workspace and platform UI

### `apps/api`

Owns:
- browser-facing Hono RPC routes
- API-side adapters and data shaping

### `apps/worker`

Owns:
- worker-only orchestration
- job execution
- runtime mutation flows that are truly worker-owned

### `packages/features/runtime-core`

Owns:
- runtime substrate and normalization logic that is not HTTP-specific and not provider-specific

### `packages/features/integrations-runtime`

Owns:
- provider-specific integration runtime logic

### Future dedicated DB/migrations home

Should own:
- Drizzle schema
- migrations
- migration commands

### `web/`

Should become:
- either a small temporary migrations-and-scripts area
- or fully removable after ownership moves

## Acceptance criteria

- `STATUS.md` matches the actual post-cutover state
- `DONE_23` is closed and no longer treated as in progress
- every major `web/` area is classified as keep, quarantine, or delete
- dead legacy workspace UI is removed
- migration ownership no longer lives in `web/`
- no production service depends on `web/src/*`

## Status checklist

- [x] follow-up spec created
- [x] spec/state reconciliation complete
- [x] `web/` inventory completed
- [ ] dead legacy workspace/product code removed
- [ ] migration ownership moved out of `web/`
- [ ] duplicated backend/runtime logic removed or re-homed

## Open questions

- should schema/migration ownership move into a dedicated package or into one of the extracted apps
- which operator scripts still justify living outside `apps/worker`
- whether any platform-only legacy routes remain that should be ported before final `web/` deletion
