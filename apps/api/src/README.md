# API Structure

Use `apps/api/src` as the adapter layer for the extracted backend. Keep request handlers thin and place deeper domain logic in the right bounded context.

## Runtime split

Use this three-way split for runtime-related code:

- `apps/api/src/runtime`
  - Hono route registration
  - runtime auth
  - request parsing
  - HTTP error mapping
  - bridge and proxy endpoint composition
- `packages/features/runtime-core`
  - runtime substrate and projection logic
  - managed config
  - managed skills
  - scheduled-task normalization and persistence helpers
  - runtime session ingest/state helpers
- `packages/features/integrations-runtime`
  - provider-specific integration runtime logic
  - integration registry
  - integration settings
  - command discovery and execution
  - OAuth-connected integration state

Rule of thumb:

- If the file knows about Hono, `Request`, `Context`, or HTTP status shaping, keep it in `apps/api`.
- If the file is generic runtime substrate logic and not provider-specific, move it to `runtime-core`.
- If the file is integration/provider runtime logic, move it to `integrations-runtime`.

## Product features vs runtime projection

A workspace-facing feature does not become a `runtime` feature just because the tenant runtime consumes its output.

Keep the authoring/product surface in the product feature:

- `apps/web/src/features/agent` and `apps/api/src/agent`
- `apps/web/src/features/workspace` and `apps/api/src/workspace`
- `apps/web/src/features/skills` and `apps/api/src/skills`
- `apps/web/src/features/scheduled-tasks` and `apps/api/src/scheduled-tasks`
- `apps/web/src/features/sessions` and `apps/api/src/sessions`

Move only the runtime-consumed projection or ingest logic into `runtime-core`.

Examples:

- Agent personalization UI lives in `features/agent`, while managed config projection lives in `runtime-core`.
- Workspace settings UI lives in `features/workspace`, while the subset projected into runtime belongs in `runtime-core`.
- Managed skills UI/API live in `features/skills`, while runtime projection of installed skills belongs in `runtime-core`.

## When to create a shared package

Do not create a new shared package for every small feature.

Create a shared package only when the domain is a real cross-surface engine with meaningful shared logic across multiple services or runtimes.

Examples:

- `integrations-runtime` deserves a package because the domain is shared by `api`, `gateway`, and tenant runtime/plugin execution.
- `skills` do not automatically deserve a package just because there is a workspace UI. Keep workspace-managed skills local to the apps unless a true reusable skill catalog/library emerges.

If Otto ships a reusable default skill set or a real skill library/catalog, that catalog can become its own shared package. The workspace-managed skills UI/API should still stay in the app features, and runtime projection should still stay in `runtime-core`.
