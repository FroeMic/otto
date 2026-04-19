# Otto Agent Guide

## Purpose

Keep implementation aligned with the repo plan, preserve state across sessions, and guide work across the extracted apps, shared packages, and runtime concerns.

## Naming and audience

- `Otto` means the product/brand and the team's assistant.
- `workspace` means the user-facing web UI, org-scoped area, and link into the app.
- `control plane` remains the internal technical term for backend orchestration, APIs, worker logic, and DB-backed management.
- `tenant runtime` and `tenant server` remain internal/operator-facing technical terms.
- In internal engineering discussion, refer to backend services, APIs, routes, workers, orchestration logic, DB-backed management, and runtime callback handling that belong to the internal backend layer as `control-plane`, `control-plane service`, or `control-plane API`, not `Otto API`.
- Do not use `control plane`, `control-plane`, or `Otto link` in user-facing or agent-facing copy.
- Prefer `workspace`, `workspace URL`, `workspace settings`, and `workspace app` when referring to the web UI.
- Prefer `Otto`, `Otto instructions`, and `Otto settings` when referring to the assistant itself.
- If copy mentions both the web UI and the assistant, split the nouns explicitly, for example: "manage this in your workspace" and "Otto will use it".
- Do not rename stable internal identifiers such as `db/control-plane.ts`, `CONTROL_PLANE_*`, or `OTTO_CONTROL_PLANE_BASE_URL` just to hide the technical term from users.
- NEVER introduce explicit `otto` or `Otto` naming in new source code, skill files, reference files, generated skill content, or new identifiers. Use neutral names such as `assistant`, `workspace`, `managed`, or domain-specific names instead.

## Start here every session

1. Read `_specs/README.md`.
2. Read `_specs/STATUS.md`.
3. Read `_specs/FIRST_INCREMENT_PLAN.md` if the work is still aimed at the first shipping slice.
4. Read the first incomplete `_specs/TODO_*.md` in sequence unless the user explicitly redirects the priority.
5. If the task touches the migration track, read `_specs/TODO_20_unified_frontend_and_hono_migration.md`.
6. Skim the related code before proposing architecture changes.

## Planning rules

- Treat `_specs/` as the authoritative plan.
- When implementation order changes, update `_specs/STATUS.md` and the affected spec files.
- When a spec is completed, rename it from `TODO_` to `DONE_` and update any references.
- Do not create side plans in random markdown files unless the user explicitly asks for that.

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
- For `apps/api` to `apps/web` communication, use Hono RPC as the default:
  - export route or app `AppType` types from `apps/api`
  - use `hc<AppType>()` clients in `apps/web`
  - keep request/response contracts type-safe across the stack
  - keep both sides on strict TypeScript so RPC inference works correctly
- Prefer explicit `c.json(..., status)` responses on RPC routes so response types remain inferable.
- Do not use Hono RPC as a requirement for routes primarily called by tenant servers or runtime plugins; those routes may remain plain HTTP interfaces.

## Code organization philosophy

- Organize code by bounded context first, then by execution surface.
- Prefer domain-first homes such as `billing`, `workspace`, `integrations`, `runtime`, `auth`, and `platform` over repo-wide catch-all buckets like `db`, `lib`, or `utils`.
- Keep `apps/*` thin:
  - `apps/api` should primarily own HTTP handlers and API-specific adapters
  - `apps/worker` should primarily own worker jobs and worker-only orchestration
  - `apps/web` should primarily own browser UI, route loaders, and client behavior
- Put shared domain logic in `packages/features/<domain>` only when that logic is genuinely used by more than one execution surface.
- Keep worker-only logic inside `apps/worker`; do not move worker-owned code into `packages/` unless it becomes truly shared.
- Keep browser-only UI code inside `apps/web`; do not leave React components or page-specific UI in backend/runtime packages.
- For runtime-related backend code, keep a three-way split:
  - `packages/features/runtime-core` owns runtime substrate and projection logic such as managed config, managed skills, scheduled-task normalization, runtime session ingest, and other runtime state that is not HTTP-specific and not provider-specific
  - `packages/features/integrations-runtime` owns integration/provider runtime logic such as integration registry, provider settings, command discovery/execution, OAuth-connected integration state, and other provider-specific runtime behavior
  - `apps/api/src/runtime` owns runtime HTTP adapters only, such as Hono route registration, runtime auth, request parsing, HTTP error mapping, and bridge/proxy endpoint composition
- For workspace-facing product surfaces that project into runtime, keep the authoring surface in the product feature and only keep the projected substrate in `runtime-core`:
  - `agent`, `workspace`, `skills`, `sessions`, and `scheduled-tasks` stay as feature folders in `apps/web` and `apps/api`
  - only the runtime-consumed projection, ingest, and normalization logic moves into `packages/features/runtime-core`
- Give a domain its own shared package only when it is a real cross-surface engine with meaningful shared logic across multiple services or runtimes:
  - `integrations-runtime` qualifies because it is shared by `api`, `gateway`, and tenant runtime/plugin behavior
  - `skills` do not automatically qualify; keep workspace-managed skills local to `apps/web` and `apps/api` unless a true shared skill catalog/library emerges
- If Otto ships a reusable default skill set or a real skill library/catalog, that catalog should become its own shared domain package while workspace-managed skills UI/API stay in the app features and runtime projection stays in `runtime-core`
- Within a domain package, split by capability and role, for example `contracts`, `data`, `services`, `policies`, and `types`, rather than allowing a single `index.ts`, `db.ts`, or `lib.ts` file to become a monolith.
- Treat `lib` as a last resort name, not the default home for unrelated code.
- Before creating a new file, decide explicitly:
  - which bounded context owns this behavior
  - which execution surface runs it
  - whether it is truly shared or surface-specific
- If related code for one domain is spread across multiple apps/packages, favor pulling shared domain logic into one coherent `packages/features/<domain>` home and leaving only thin adapters in the apps.
- For the SPA in `apps/web`:
  - keep route registration centralized in a dedicated routing module such as `src/client/app/route-tree.tsx`
  - keep global shell code such as app shell, sidebar, header, settings shell, and index-route helpers under a dedicated app-shell area such as `src/client/app/app-shell/`
  - organize feature code under `src/features/<feature>/`
  - treat `settings` as a shell and navigation area, not as a bounded context for domain logic
  - current preferred feature grouping is `workspace`, `usage`, and `billing`
  - keep one page component per file
- For React component files:
  - define props in the same file near the top
  - use an exported `interface` for props definitions
  - export components as named exports only
  - do not use default exports for components
  - prefer named imports over namespace imports for local application code

## Repository shape

- `_specs/` stores planning state and implementation sequencing.
- `apps/web`, `apps/api`, `apps/worker`, and `apps/gateway` are the active execution surfaces.
- `drizzle/` at the repo root owns the active Drizzle migrations.
- `runtime-image/` and `runtime-plugins/` are separate runtime concerns and should not be conflated with the browser-app migration.
- The planned long-term direction is captured in `_specs/TODO_20_unified_frontend_and_hono_migration.md`:
  - unified frontend
  - extracted API
  - extracted gateway
  - extracted worker
  - shared packages under a repo-level app/package layout

## Package manager and command expectations

- Bun is the preferred package manager and local task runner for new repo-level work, especially the planned `apps/` and `packages/` layout.
- During migration, do not treat Bun package-manager adoption and Bun runtime adoption as the same decision:
  - Bun should be the default tooling choice
  - runtime selection can remain service-specific until compatibility is proven

## Useful skills

Highlight these skills when relevant:

- `shadcn`
  - use for shadcn CLI usage, component selection, forms, navigation, and UI composition in `apps/web`
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

- If working in `apps/web` on UI, layout, forms, navigation, settings, onboarding, or shadcn components, use `shadcn` first.
- If designing React component APIs anywhere in the repo, use `vercel-composition-patterns`.
- If implementing React or Next.js UI behavior anywhere in the repo, use `vercel-react-best-practices`.
- If doing visual or layout planning for browser-facing UI, use `web-design-guidelines`.
- If the task centers on advanced TypeScript modeling, use `typescript-advanced-types`.
- If the task centers on TanStack Router route structure, typed navigation, loaders, or search-param design, use `tanstack-router`.
- If the task is explicitly test-led or should be driven by executable tests first, use `test-driven-development`.

## Repo expectations

- Placeholder docs should be replaced when they become misleading.
- Update the relevant spec checklist as work progresses.
- Update `_specs/STATUS.md` if the next recommended step, architecture decision, or blockers change.
- Audit new UI copy, prompt text, and tool descriptions for the terminology split above before finishing.
- Prefer small, reviewable increments that satisfy one spec at a time.
- Prefer focused commits that land one complete sub-package or command slice at a time.
- For object-by-object integration work, finish one command end to end, verify it, commit it, and only then move to the next command.
- Do not add env vars, config contracts, or service scaffolding until there is a code path in the current increment that uses them.
- Prefer the smallest testable slice over speculative setup for later phases.
- Regularly create small commits as meaningful milestones are reached.
- Push committed work to `origin` regularly so progress is not stranded only in the local workspace.
- When adding or changing a Drizzle migration under `drizzle/`, always update the corresponding Drizzle metadata in `drizzle/meta/` in the same change set so production `drizzle-kit migrate` can actually see and apply it.
- Before creating a PR, review the branch against the spec and the code-organization philosophy above:
  - confirm code is placed in the correct bounded context
  - confirm shared code is actually shared and surface-specific code stayed in the app
  - confirm new files did not introduce fresh catch-all `lib` or cross-domain sprawl
  - confirm new `apps/api` to `apps/web` routes use Hono RPC unless they fall under the tenant/runtime/plugin exception
  - confirm SPA routes are still centralized and new pages live under the correct feature group
  - confirm component files use local exported props interfaces, named exports, and named imports
  - note any intentional deviations explicitly in the PR description

## GitHub workflow expectation

- For GitHub PR creation and merge in this repo, do not rely on the GitHub connector as the first-class path.
- If branch push to `origin` succeeds, treat `gh pr create` and `gh pr merge` as the correct fallback path before concluding GitHub is blocked.
- Do not stop only because `gh auth status` looks stale or the connector cannot see the repo; try the direct `gh pr ...` command against the already-pushed branch and only escalate if that also fails.

## Decision rule for Trigger.dev

Only introduce `trigger.dev` after documenting a concrete failure of the in-repo job system, such as:

- worker reliability problems that are expensive to fix internally
- workflow fan-out or retry behavior becoming materially complex
- operational burden clearly exceeding the cost of the dependency
