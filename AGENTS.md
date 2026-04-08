# Otto Agent Guide

## Purpose

Keep implementation aligned with the repo plan, preserve state across sessions, and guide work across both the legacy apps and the planned Hono/Bun migration.

## Naming and audience

- `Otto` means the product/brand and the team's assistant.
- `workspace` means the user-facing web UI, org-scoped area, and link into the app.
- `control plane` remains the internal technical term for backend orchestration, APIs, worker logic, and DB-backed management.
- `tenant runtime` and `tenant server` remain internal/operator-facing technical terms.
- Do not use `control plane`, `control-plane`, or `Otto link` in user-facing or agent-facing copy.
- Prefer `workspace`, `workspace URL`, `workspace settings`, and `workspace app` when referring to the web UI.
- Prefer `Otto`, `Otto instructions`, and `Otto settings` when referring to the assistant itself.
- If copy mentions both the web UI and the assistant, split the nouns explicitly, for example: "manage this in your workspace" and "Otto will use it".
- Do not rename stable internal identifiers such as `db/control-plane.ts`, `CONTROL_PLANE_*`, or `OTTO_CONTROL_PLANE_BASE_URL` just to hide the technical term from users.

## Start here every session

1. Read `spec/README.md`.
2. Read `spec/STATUS.md`.
3. Read `spec/FIRST_INCREMENT_PLAN.md` if the work is still aimed at the first shipping slice.
4. Read the first incomplete `spec/TODO_*.md` in sequence unless the user explicitly redirects the priority.
5. If the task touches the migration track, read `spec/TODO_20_unified_frontend_and_hono_migration.md`.
6. Skim the related code before proposing architecture changes.

## Planning rules

- Treat `spec/` as the authoritative plan.
- When implementation order changes, update `spec/STATUS.md` and the affected spec files.
- When a spec is completed, rename it from `TODO_` to `DONE_` and update any references.
- Do not create side plans in random markdown files unless the user explicitly asks for that.
- Keep `www/spec/` aligned with the main repo plan until the unified frontend fully replaces the legacy website boundary.

## Architecture guardrails

- Default to a durable Postgres-backed job system inside the repo before adding `trigger.dev`.
- Keep request handlers thin.
- Do not perform provisioning, SSH, or long polling inline in request handlers.
- Keep provider-specific code behind small service interfaces.
- Design workflows to be idempotent and resumable.
- Keep the worker as a background worker process:
  - polling and executing queue work is its primary job
  - a small health or metrics HTTP surface is acceptable
  - do not redesign job execution around inbound HTTP requests
- Keep the application architecture independent of Cloudflare-specific runtime features unless a later spec explicitly adopts them.

## Repository shape

- `spec/` stores planning state and implementation sequencing.
- `web/` is the current legacy control-plane app and worker/gateway home.
- `www/` is the current legacy public site.
- `runtime-image/` and `runtime-plugins/` are separate runtime concerns and should not be conflated with the browser-app migration.
- The planned long-term direction is captured in `spec/TODO_20_unified_frontend_and_hono_migration.md`:
  - unified frontend
  - extracted API
  - extracted gateway
  - extracted worker
  - shared packages under a repo-level app/package layout

## Package manager and command expectations

- Bun is the preferred package manager and local task runner for new repo-level work, especially the planned `apps/` and `packages/` layout.
- For existing `web/` work, use `bun run ...` inside `web/` by default unless a task specifically requires `npm`.
- For existing `www/` work, use Bun-based commands.
- During migration, do not treat Bun package-manager adoption and Bun runtime adoption as the same decision:
  - Bun should be the default tooling choice
  - runtime selection can remain service-specific until compatibility is proven

## Useful skills

Highlight these skills when relevant:

- `shadcn`
  - use for shadcn CLI usage, component selection, forms, navigation, and UI composition in `web/`
- `test-driven-development`
  - use when implementing behavior with a test-first or test-led workflow
- `typescript-advanced-types`
  - use for complex TypeScript type design, inference, utility types, and API typing
- `tanstack-router`
  - use for TanStack Router route design, typed search params, loaders, preloading, and app-shell route structure
- `vercel-composition-patterns`
  - use for React component API and composition decisions
- `vercel-react-best-practices`
  - use for React and Next.js implementation decisions
- `web-design-guidelines`
  - use for layout, visual structure, and browser-facing UI decisions

## Skill trigger rules

- If working in `web/` on UI, layout, forms, navigation, settings, onboarding, or shadcn components, use `shadcn` first.
- If designing React component APIs anywhere in the repo, use `vercel-composition-patterns`.
- If implementing React or Next.js UI behavior anywhere in the repo, use `vercel-react-best-practices`.
- If doing visual or layout planning for browser-facing UI, use `web-design-guidelines`.
- If the task centers on advanced TypeScript modeling, use `typescript-advanced-types`.
- If the task centers on TanStack Router route structure, typed navigation, loaders, or search-param design, use `tanstack-router`.
- If the task is explicitly test-led or should be driven by executable tests first, use `test-driven-development`.
- When working in `web/`, also inspect the local skill files under `web/.agents/skills/` before implementing UI changes.

## Repo expectations

- Placeholder docs should be replaced when they become misleading.
- Update the relevant spec checklist as work progresses.
- Update `spec/STATUS.md` if the next recommended step, architecture decision, or blockers change.
- Audit new UI copy, prompt text, and tool descriptions for the terminology split above before finishing.
- Prefer small, reviewable increments that satisfy one spec at a time.
- Prefer focused commits that land one complete sub-package or command slice at a time.
- For object-by-object integration work, finish one command end to end, verify it, commit it, and only then move to the next command.
- Do not add env vars, config contracts, or service scaffolding until there is a code path in the current increment that uses them.
- Prefer the smallest testable slice over speculative setup for later phases.
- Regularly create small commits as meaningful milestones are reached.
- Push committed work to `origin` regularly so progress is not stranded only in the local workspace.

## GitHub workflow expectation

- For GitHub PR creation and merge in this repo, do not rely on the GitHub connector as the first-class path.
- If branch push to `origin` succeeds, treat `gh pr create` and `gh pr merge` as the correct fallback path before concluding GitHub is blocked.
- Do not stop only because `gh auth status` looks stale or the connector cannot see the repo; try the direct `gh pr ...` command against the already-pushed branch and only escalate if that also fails.

## Decision rule for Trigger.dev

Only introduce `trigger.dev` after documenting a concrete failure of the in-repo job system, such as:

- worker reliability problems that are expensive to fix internally
- workflow fan-out or retry behavior becoming materially complex
- operational burden clearly exceeding the cost of the dependency
