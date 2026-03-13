# TODO 03: Provisioning Workflow

## Goal

Provision one dedicated Hetzner VPS per tenant through resumable background jobs.

## Scope

- implement Hetzner wrapper
- create cloud-init template
- create provisioning workflow
- persist server metadata and transitions

## Dependencies

- `TODO_00_architecture_and_job_runtime.md`
- `TODO_01_repo_foundation.md`
- `TODO_02_auth_and_tenant_model.md`

## Implementation notes

- Provisioning steps should be explicit and restart-safe:
  - create server
  - poll server action
  - fetch IP
  - wait for SSH
  - mark server reachable
  - enqueue config apply
- Persist each step boundary so retries resume cleanly.

## Exit criteria

- tenant provisioning can run asynchronously
- Hetzner metadata is stored in DB
- worker can recover after interruption
- successful provisioning enqueues apply

## Status checklist

- [ ] implement Hetzner API client
- [ ] implement cloud-init renderer
- [ ] define provisioning workflow states
- [ ] persist server metadata
- [ ] enqueue config apply on success

## Open questions

- Do we need server deletion and rebuild flows in the first pass?
- Decision: no, not for v1.
- No, not for the first version
