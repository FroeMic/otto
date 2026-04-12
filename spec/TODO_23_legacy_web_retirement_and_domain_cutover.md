# TODO 23: Legacy Web Retirement And Domain Cutover

## Goal

Retire the legacy `web/` workspace app after feature parity is complete, remove the remaining legacy-only onboarding database state, and collapse the temporary dual-domain env model down to one primary Otto workspace origin.

## Scope

- stop serving the org-scoped workspace UI from `legacy-web`
- remove legacy-only workspace route compatibility that is no longer needed
- delete legacy onboarding UI and backend code once no runtime or OAuth path depends on it
- remove legacy-only onboarding tables and related schema/model code
- collapse the remaining split-domain and split-auth env model down to one public workspace/app origin

## Non-goals

- reintroducing the legacy onboarding UX in `apps/web`
- keeping compatibility redirects for old legacy workspace URLs that Otto itself no longer injects
- removing platform/operator surfaces that still legitimately exist in the extracted app stack

## Dependencies

- `TODO_06_integrations_and_oauth.md`
- `TODO_08_signup_to_slack_onboarding_flow.md`
- `TODO_20_unified_frontend_and_hono_migration.md`

## Current state

- the new extracted workspace shell in `apps/web` now owns the main org-scoped surfaces:
  - agent personalization
  - integrations
  - files
  - sessions
  - scheduled tasks
  - skills
- runtime-projected workspace links now need to point only at extracted workspace routes
- the old onboarding UI still exists only in legacy `web/`
- the onboarding persistence model still exists and is still referenced by Slack OAuth / provisioning code
- deployment still carries follow-on env and docs cleanup from the parallel-launch phase:
  - `CONTROL_PLANE_DOMAIN`
  - `WORKOS_BASE_URL_BETA`
  - `WORKOS_REDIRECT_URI_BETA`

## Why this work exists

- `legacy-web` is now mostly carrying historical workspace UI and onboarding baggage
- keeping the split browser origin and split auth envs increases operational and cognitive overhead
- keeping onboarding tables after the onboarding UX is dead creates permanent schema debt
- keeping runtime/projected links pointed at old paths makes the retirement unsafe

## Implementation notes

### Sequence

Do this in three PRs.

### PR 1: Discontinue `legacy-web`

Goal:
- stop depending on `legacy-web` for the workspace app

Work:
- verify every runtime-injected workspace URL points at extracted `apps/web` routes
- remove any remaining runtime/projected references to legacy workspace URLs
- remove `legacy-web` from production compose and Caddy routing
- route the workspace app only through the extracted origin
- delete org-scoped legacy workspace UI pages under `web/src/app/[orgSlug]/(app)` once cutover is verified
- retain only code in `web/` that is still needed temporarily for OAuth/provisioning callbacks if those have not yet moved

Acceptance criteria:
- no org-scoped user workspace traffic depends on `legacy-web`
- `legacy-web` is no longer part of production compose or Caddy
- all Otto-injected workspace URLs point at extracted `apps/web`
- no feature parity regressions for workspace users

### PR 2: Remove legacy onboarding tables and code

Goal:
- delete the remaining legacy-only onboarding persistence model

Work:
- replace the old Slack onboarding/provisioning flow with the extracted equivalent or remove it entirely if no longer needed
- remove all remaining reads/writes of `tenant_onboarding_sessions`
- remove onboarding session helpers from worker/control-plane DB code
- add a migration dropping the onboarding table and related indexes/constraints
- remove legacy onboarding UI and callback branches that depended on onboarding session state

Known table to remove:
- `tenant_onboarding_sessions`

Acceptance criteria:
- no runtime, OAuth, worker, or API code references onboarding session rows
- schema migration drops the onboarding table safely
- no live code path requires onboarding session IDs or onboarding-state redirects

### PR 3: Collapse the domain/env split

Goal:
- remove the temporary dual-origin parallel-launch configuration

Work:
- make one public workspace/app origin authoritative
- remove the `*_BETA` WorkOS URL vars
- remove `CONTROL_PLANE_DOMAIN` fallback behavior where it only existed for the parallel-launch phase
- simplify env parsing in:
  - `apps/api`
  - `apps/worker`
  - shared runtime env helpers
- update compose, Caddy, docs, and env examples
- keep `OTTO_CONTROL_PLANE_BASE_URL` only as the tenant-runtime callback base URL if it is still the correct internal/public name; otherwise rename it in a dedicated follow-up with migration care

Acceptance criteria:
- one public origin is used for workspace UI and browser auth redirects
- env examples no longer document the temporary split-domain setup
- Caddy and compose no longer mention `legacy-web`

## File-system ownership

### `apps/web`

Owns:
- the extracted workspace UI that replaces legacy `web/src/app/[orgSlug]/(app)`
- route registration
- shell/navigation

### `apps/api`

Owns:
- browser-facing Hono RPC routes
- auth callback routes if they are part of the extracted surface

### `apps/worker`

Owns:
- any remaining provisioning or reconciliation logic that still must run in the background

### `packages/features/integrations-runtime`

Owns:
- shared integration definitions and projected workspace settings paths used by runtime-facing surfaces

### `web/`

Should only remain until the above PRs eliminate the last legitimate dependency.

## Open questions

- whether any Slack OAuth callback behavior still needs a temporary home in `web/` before full retirement
- whether `OTTO_CONTROL_PLANE_BASE_URL` should keep its current name after cutover or be renamed in a separate migration
- whether any other legacy-only tables remain after `tenant_onboarding_sessions` is removed

## Acceptance criteria

- `legacy-web` is no longer needed in production
- onboarding tables and code are removed
- runtime-injected workspace URLs all point at extracted routes
- the workspace/app domain model is reduced to one public origin

## Status checklist

- [x] PR 1 planned
- [x] PR 1 implemented
- [ ] PR 1 deployed and verified
- [x] PR 2 planned
- [x] PR 2 implemented
- [ ] PR 2 deployed and verified
- [x] PR 3 planned
- [ ] PR 3 implemented
- [ ] PR 3 deployed and verified
