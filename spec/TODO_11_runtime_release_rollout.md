# TODO 11: Runtime Release Rollout

## Goal

Replace env-driven tenant runtime image selection with a control-plane-managed runtime release model, and provide a manual operator rollout that forces ready tenant VPSes to pull and restart on the active release.

## Scope

- remove `RUNTIME_OPENCLAW_IMAGE` as a runtime source of truth
- add DB-backed runtime release records
- add the required DB migration for runtime releases and tenant applied-state tracking
- make provisioning and apply use the active runtime release
- add manual operator-triggered rollout for ready tenants
- ensure runtime image rollout does not silently apply newer tenant config

## Dependencies

- `TODO_03_provisioning_workflow.md`
- `TODO_04_runtime_packaging.md`
- `TODO_05_config_apply_and_reconciliation.md`
- `TODO_09_ui_app_shell_and_onboarding_rebuild.md`
- `DONE_12_runtime_dashboard_access.md`

## Implementation notes

- Runtime image selection should move fully into the database.
- The control plane should own exactly one active runtime release at a time.
- Add a schema migration alongside the Drizzle schema update.
- The migration should introduce:
  - `runtime_releases`
  - `tenant_servers.applied_desired_state_version`
  - any new apply-run fields needed for runtime release audit data
- v1 should require digest refs only, not floating tags.
- `publish-runtime-image.sh` should output the pushed digest that operators will paste into the control plane.
- Provisioning and restart flows should fail clearly if no active runtime release exists.
- Keep using the existing `apply_tenant_config` job type instead of introducing a second rollout-specific job type.
- Extend apply job payloads and persisted apply-run metadata with:
  - `runtimeReleaseId`
  - `runtimeImageRef`
  - `triggerType`
- Supported trigger types for v1:
  - `provision_bootstrap`
  - `config_change`
  - `runtime_rollout`
- Do not let image rollout use a tenant's latest desired state automatically.
- Add `appliedDesiredStateVersion` to tenant runtime state and update it only after successful provisioning/apply.
- Manual runtime rollout should reuse each tenant's `appliedDesiredStateVersion`, not the latest desired-state version.
- If a ready tenant is missing `appliedDesiredStateVersion`, skip it and surface that in preview/results.
- v1 does not need tenant current-image tracking.
- v1 rollout should be a forced restart/recreate of all eligible ready tenants.
- Skip tenants with queued or running applies instead of trying to merge concurrent work.
- Image-only rollout must not mutate Slack integration status or surface rollout failures as Slack reconnect/apply failures.
- The recent app-shell work now has:
  - a dedicated settings shell with route-backed sections
  - an authenticated Agent status / deployment view
  - a gateway-access card on that Agent status view
- Do not add rollout controls to `settings/page.tsx`; that route now redirects to `/settings/workspace`.
- For v1, place release activation and rollout controls on the authenticated Agent status / deployment view so runtime operations live next to gateway access and recent deployment activity.
- The workspace settings area may link users toward the Agent deployment surface, but should not own the rollout action itself.
- Gate that control with an explicit operator allowlist such as `CONTROL_PLANE_OPERATOR_EMAILS`.
- Until the DB-backed runtime release model lands, keep the existing platform operator surfaces consistent:
  - `/platform/organizations`
  - `/platform/organizations/[orgSlug]`
  - both should expose separate actions for config-only apply, image-only refresh, and one-click image pull plus config apply

## Exit criteria

- `RUNTIME_OPENCLAW_IMAGE` is removed from env contracts and runtime code paths
- one active runtime release can be created and viewed in the control plane
- provisioning uses the active runtime release
- manual rollout queues applies for eligible ready tenants
- rollout applies use each tenant's last successfully applied desired-state version
- rollout failures and progress are visible without polluting Slack integration state
- a migration exists for the new runtime release and applied-state schema changes

## Status checklist

- [ ] add `runtime_releases` persistence and one-active-release invariant
- [ ] add and apply the matching DB migration
- [ ] remove `RUNTIME_OPENCLAW_IMAGE` from env, docs, and runtime code paths
- [ ] track `appliedDesiredStateVersion` on tenant runtime state
- [ ] extend apply payloads and apply-run records with runtime release metadata
- [ ] make provisioning resolve the active runtime release from DB
- [ ] implement rollout preview and rollout enqueue service logic
- [ ] add operator-only release / rollout controls to the Agent status / deployment UI
- [ ] verify image rollout does not advance tenant config unexpectedly
- [ ] verify image rollout does not mutate Slack integration status

## Open questions

- Should rollout enqueue all eligible tenants at once, or batch them intentionally in v1?
- Should a release record keep optional notes such as changelog / operator summary, or is the image digest enough for the first slice?
- Should a later slice move release activation and rollout off the Agent deployment view into a dedicated operator surface?
