# Otto Spec Workflow

This folder is the source of truth for implementation planning and session-to-session state.

## Conventions

- `TODO_XX_name.md` means planned or in progress work.
- `DONE_XX_name.md` means the spec has been implemented and verified enough to retire from the active queue.
- Lower numbers should usually be completed first unless a spec explicitly says otherwise.
- Code organization should follow a domain-first model:
  - organize by bounded context first, then by execution surface
  - keep `apps/*` thin and surface-specific
  - keep genuinely shared domain logic in `packages/features/<domain>`
  - avoid catch-all growth in repo-wide `lib`, `db`, or utility buckets
  - for runtime-related backend code, use this split:
    - `packages/features/runtime-core` for runtime substrate and projection logic that is not HTTP-specific and not provider-specific
    - `packages/features/integrations-runtime` for provider-specific integration runtime logic
    - `apps/api/src/runtime` for runtime HTTP adapters only
  - for workspace-facing product surfaces that project into runtime, keep the authoring/product surface in `apps/web` and `apps/api`, and move only the runtime-consumed projection or ingest logic into `runtime-core`
  - create a dedicated shared package only when the domain is a true cross-surface engine with meaningful shared logic across multiple services or runtimes; otherwise keep the feature local to the apps and share only the substrate that is actually runtime-wide
- For the SPA in `apps/web`:
  - keep route registration centralized in a dedicated routing module
  - keep shell code in a dedicated app-shell area
  - organize domain code under feature groups
  - current preferred feature groups are `workspace`, `usage`, and `billing`
  - treat `settings` as shell/navigation structure, not as a domain feature group
  - keep one page component per file
- For React component files in the SPA:
  - define props in the same file
  - place an exported props `interface` near the top of the file
  - use named component exports only
  - avoid default component exports
  - prefer named imports over namespace imports for local application code
- For browser-facing app communication, `apps/api` to `apps/web` should use Hono RPC by default so route inputs and outputs stay type-safe across the stack.
- Exception: routes primarily called by tenant servers or runtime plugins do not need to use Hono RPC and may remain plain HTTP interfaces.
- Every spec should include:
  - goal
  - scope
  - dependencies
  - implementation notes
  - acceptance criteria
  - status checklist
  - open questions

## Session state

- `STATUS.md` is the short operational memory for the next session.
- Update `STATUS.md` whenever priorities, blockers, or the next recommended step change.
- When work on a spec starts, note that in `STATUS.md`.
- When a spec is finished, rename it from `TODO_` to `DONE_` and update `STATUS.md`.
- Before opening a PR, review the branch against the relevant spec and confirm the implementation still follows the repo's domain-first code organization model.
- That pre-PR review should also confirm that new `apps/api` to `apps/web` routes use Hono RPC unless they fall under the tenant/runtime/plugin exception.
- For SPA work, that pre-PR review should also confirm that routes are still centralized, shell code stays in the app-shell area, feature pages live under the correct feature group, and React files follow the props/export/import conventions above.

## Current implementation order

1. `TODO_00_architecture_and_job_runtime.md`
2. `TODO_01_repo_foundation.md`
3. `DONE_02_auth_and_tenant_model.md`
4. `TODO_03_provisioning_workflow.md`
5. `TODO_04_runtime_packaging.md`
6. `TODO_05_config_apply_and_reconciliation.md`
7. `TODO_06_integrations_and_oauth.md`
8. `TODO_07_operations_and_observability.md`
9. `TODO_08_signup_to_slack_onboarding_flow.md`
10. `TODO_09_ui_app_shell_and_onboarding_rebuild.md`
11. `DONE_10_voice_note_understanding.md`
12. `TODO_11_runtime_release_rollout.md`
13. `DONE_12_runtime_dashboard_access.md`
14. `TODO_13_scheduled_tasks_visibility.md`
15. `TODO_14_session_history_visibility.md`
16. `TODO_15_billing_and_credit_metering.md`
17. `TODO_16_runtime_ai_provider_proxy.md`
18. `TODO_17_managed_integrations_architecture.md`
19. `TODO_18_managed_skills.md`
20. `TODO_19_oauth_connected_accounts_substrate.md`
21. `TODO_20_unified_frontend_and_hono_migration.md`
22. `TODO_21_workspace_multiplayer_chat_and_web_channel.md`
23. `DONE_22_workspace_chat_activity_events_and_transparency.md`
24. `DONE_23_legacy_web_retirement_and_domain_cutover.md`
25. `DONE_24_web_codebase_contraction.md`
26. `TODO_25_app_shell_layout_and_notifications.md`
27. `TODO_26_managed_runtime_memory.md`
28. `TODO_27_openclaw_2026_4_12_runtime_upgrade.md`

## Trigger.dev decision

Current default: do not add `trigger.dev` in the first pass.

Reason:

- the repo is still at scaffold stage
- the first missing capability is durable workflow state, not a hosted workflow vendor
- a database-backed job runner can live in the same Next.js codebase and keep architecture simpler while the product shape is still moving

Revisit this only after:

- provisioning and apply jobs are proven to need more advanced orchestration
- retry and concurrency needs become painful
- self-hosting or operating the worker becomes a larger burden than the dependency
