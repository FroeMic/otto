# Web Agent Guide

## Purpose

Keep work under `web/` aligned with the current legacy Next.js control-plane implementation while the repo migrates toward the newer frontend/API/gateway/worker split.

## Scope

These instructions apply only to `web/`.

Repo-wide rules still live in `/Users/michaelfrohlich/Repositories/otto/AGENTS.md`.

## Current role of `web/`

- `web/` is the current control-plane app.
- It still contains:
  - Next.js pages and layouts
  - route handlers
  - worker entrypoints
  - the current integration gateway implementation
  - DB and orchestration code that is being prepared for extraction

## Command expectations

- Use `bun run ...` as the default way to invoke scripts for `web/` work unless a task specifically requires `npm`.
- This applies to routine verification too:
  - prefer `bun run build`
  - prefer `bun run lint`
  - prefer `bun run test:...`

## UI expectations

- For UI work in `web/`, use official shadcn components by default unless the user explicitly asks for a custom component.
- If a needed shadcn component is not installed, install it via the shadcn CLI instead of hand-rolling a replacement.
- If you cannot install the required shadcn component cleanly, stop and ask the user to install or approve installing it before continuing.

## Local skills

- `shadcn`: `/Users/michaelfrohlich/Repositories/otto/web/.agents/skills/shadcn/SKILL.md`
- `vercel-composition-patterns`: `/Users/michaelfrohlich/Repositories/otto/web/.agents/skills/vercel-composition-patterns/SKILL.md`
- `vercel-react-best-practices`: `/Users/michaelfrohlich/Repositories/otto/web/.agents/skills/vercel-react-best-practices/SKILL.md`
- `web-design-guidelines`: `/Users/michaelfrohlich/Repositories/otto/web/.agents/skills/web-design-guidelines/SKILL.md`

## Skill trigger rules

- If working in `web/` on UI, layout, forms, navigation, settings, onboarding, or shadcn components, use `shadcn` first.
- If designing React component APIs in `web/`, use `vercel-composition-patterns`.
- If implementing React or Next.js UI behavior in `web/`, use `vercel-react-best-practices`.
- If doing visual or layout planning in `web/`, use `web-design-guidelines`.
- When working anywhere under `web/`, inspect the relevant local skill files before implementing UI changes.

## Migration posture

- Prefer extracting shared logic into repo-level packages instead of deepening `web/`-only abstractions when the work is part of the planned Hono migration.
- Keep Next.js route handlers thin.
- Do not add new long-running work inline in request handlers.
- Preserve behavior while extracting service boundaries:
  - gateway behavior should stay compatible during the Hono extraction
  - worker behavior should stay queue-driven during the worker extraction
