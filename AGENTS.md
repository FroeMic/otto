# Otto Agent Guide

## Purpose

Keep implementation aligned with the control-plane plan and preserve state across sessions.

## Naming and audience

- `Otto` means the product/brand and the team's assistant.
- `workspace` means the user-facing web UI, org-scoped area, and link into the app.
- `control plane` remains the internal technical term for `web/`, API routes, worker, orchestration logic, and DB-backed management.
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
5. Skim any related code before proposing architecture changes.

## Planning rules

- Treat `spec/` as the authoritative plan.
- When implementation order changes, update `spec/STATUS.md` and the affected spec files.
- When a spec is completed, rename it from `TODO_` to `DONE_` and update any references.
- Do not create side plans in random markdown files unless the user explicitly asks for that.

## Architecture guardrails

- Default to a durable Postgres-backed job system inside the repo before adding `trigger.dev`.
- Keep Next.js route handlers thin.
- Do not perform provisioning, SSH, or long polling inline in request handlers.
- Keep provider-specific code behind small service interfaces.
- Design workflows to be idempotent and resumable.

## Repo expectations

- `web/` is the control plane app.
- `spec/` stores planning state and implementation sequencing.
- Placeholder docs should be replaced when they become misleading.
- Use `bun run ...` as the default way to invoke scripts for `web/` work unless a task specifically requires `npm`.
- This applies to routine verification too: prefer `bun run build`, `bun run lint`, `bun run test:...`, and other `web/` package scripts over `npm run ...`.
- For UI work in `web/`, use official shadcn components by default unless the user explicitly asks for a custom component.
- If a needed shadcn component is not installed, install it via the shadcn CLI instead of hand-rolling a replacement.
- If you cannot install the required shadcn component cleanly, stop and ask the user to install or approve installing it before continuing.
- For GitHub PR creation and merge in this repo, do not rely on the GitHub connector as the first-class path. The connector may not have the `FroeMic/otto` installation even when local git push works, which shows up as connector `404`/repo-not-found failures.
- If branch push to `origin` succeeds, treat `gh pr create` / `gh pr merge` as the correct fallback path for this repo before concluding GitHub is blocked.
- Do not stop only because `gh auth status` looks stale or the connector cannot see the repo; try the direct `gh pr ...` command against the already-pushed branch and only escalate if that also fails.

## Available skills

- shadcn: Manages shadcn components and blocks for the web app. Use for shadcn CLI usage, component selection, sidebar blocks, forms, and UI composition in `web/`. (file: /Users/michaelfrohlich/Repositories/otto/web/.agents/skills/shadcn/SKILL.md)
- vercel-composition-patterns: Use for React component API and composition decisions in `web/`. (file: /Users/michaelfrohlich/Repositories/otto/web/.agents/skills/vercel-composition-patterns/SKILL.md)
- vercel-react-best-practices: Use for React and Next.js implementation decisions in `web/`. (file: /Users/michaelfrohlich/Repositories/otto/web/.agents/skills/vercel-react-best-practices/SKILL.md)
- web-design-guidelines: Use for layout and UI structure work in `web/`. (file: /Users/michaelfrohlich/Repositories/otto/web/.agents/skills/web-design-guidelines/SKILL.md)

## Skill trigger rules

- If working in `web/` on UI, layout, forms, navigation, settings, onboarding, or shadcn components, use the `shadcn` skill first.
- If designing React component APIs in `web/`, use `vercel-composition-patterns`.
- If implementing React or Next.js UI behavior in `web/`, use `vercel-react-best-practices`.
- If doing visual or layout planning in `web/`, use `web-design-guidelines`.
- When working anywhere under `web/`, inspect relevant skills under `/Users/michaelfrohlich/Repositories/otto/web/.agents/skills/` before implementing UI changes.

## When making changes

- Update the relevant spec checklist as work progresses.
- Update `spec/STATUS.md` if the next recommended step, architecture decision, or blockers change.
- Audit new UI copy, prompt text, and tool descriptions for the terminology split above before finishing.
- Prefer small, reviewable increments that satisfy one spec at a time.
- Do not add env vars, config contracts, or service scaffolding until there is a code path in the current increment that uses them.
- Prefer the smallest testable slice over speculative setup for later phases.
- Regularly create small commits as meaningful milestones are reached.
- Push committed work to `origin` regularly so progress is not stranded only in the local workspace.

## Decision rule for Trigger.dev

Only introduce `trigger.dev` after documenting a concrete failure of the in-repo job system, such as:

- worker reliability problems that are expensive to fix internally
- workflow fan-out or retry behavior becoming materially complex
- operational burden clearly exceeding the cost of the dependency
