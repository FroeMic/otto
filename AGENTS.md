# Otto Agent Guide

## Purpose

Keep implementation aligned with the control-plane plan and preserve state across sessions.

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

## When making changes

- Update the relevant spec checklist as work progresses.
- Update `spec/STATUS.md` if the next recommended step, architecture decision, or blockers change.
- Prefer small, reviewable increments that satisfy one spec at a time.
- Regularly create small commits as meaningful milestones are reached.
- Push committed work to `origin` regularly so progress is not stranded only in the local workspace.

## Decision rule for Trigger.dev

Only introduce `trigger.dev` after documenting a concrete failure of the in-repo job system, such as:

- worker reliability problems that are expensive to fix internally
- workflow fan-out or retry behavior becoming materially complex
- operational burden clearly exceeding the cost of the dependency
