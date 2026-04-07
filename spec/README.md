# Otto Spec Workflow

This folder is the source of truth for implementation planning and session-to-session state.

## Conventions

- `TODO_XX_name.md` means planned or in progress work.
- `DONE_XX_name.md` means the spec has been implemented and verified enough to retire from the active queue.
- Lower numbers should usually be completed first unless a spec explicitly says otherwise.
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
15. `TODO_14_session_history_visibility.md`
16. `TODO_15_billing_and_credit_metering.md`
17. `TODO_16_runtime_ai_provider_proxy.md`
18. `TODO_17_managed_integrations_architecture.md`

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
