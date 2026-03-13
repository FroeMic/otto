# TODO 05: Config Apply And Reconciliation

## Goal

Compile tenant desired state into runtime files, write them safely to the VPS, and reconcile runtime state with retries.

## Scope

- define desired-state schema
- implement config renderers
- implement SSH primitives
- implement apply workflow and audit trail

## Dependencies

- `TODO_00_architecture_and_job_runtime.md`
- `TODO_01_repo_foundation.md`
- `TODO_03_provisioning_workflow.md`
- `TODO_04_runtime_packaging.md`

## Implementation notes

- Desired state should be versioned.
- Apply jobs should always operate against a specific desired-state version.
- Use atomic remote writes and explicit restart steps.
- Record every apply attempt for diagnosis.

## Exit criteria

- desired state compiles into runtime files
- files are uploaded atomically
- runtime can be restarted over SSH
- apply status is visible in UI

## Status checklist

- [ ] define desired-state tables
- [ ] implement config renderers
- [ ] implement SSH client wrapper
- [ ] implement runtime wrapper
- [ ] record apply runs and logs

## Open questions

- Do we need drift detection in v1, or only push-based apply?
