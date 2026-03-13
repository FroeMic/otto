# TODO 02: Auth And Tenant Model

## Goal

Establish user identity, organization ownership, and the first tenant records in the control plane.

## Scope

- integrate auth
- create organization and membership tables
- create tenant creation flow
- add a minimal dashboard that shows tenant state

## Dependencies

- `TODO_01_repo_foundation.md`

## Implementation notes

- Keep the first tenant creation flow narrow:
  - create organization context
  - create tenant row
  - create initial desired-state row
  - enqueue provisioning job
- Do not mix provisioning logic into route handlers.

## Exit criteria

- signed-in user can create a tenant
- tenant appears in dashboard with initial status
- tenant creation enqueues a background job instead of provisioning inline

## Status checklist

- [ ] choose auth provider and session model
- [ ] create user and organization schema
- [ ] create tenant schema
- [ ] add tenant creation UI
- [ ] enqueue provisioning job on create

## Open questions

- Is WorkOS still required, or is simpler auth acceptable for v1?
