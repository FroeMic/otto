# TODO 06: Integrations And OAuth

## Goal

Connect integrations like Slack through the control plane and project the resulting secrets and config into tenant desired state.

## Scope

- implement OAuth callback flow
- store integration metadata and secrets
- trigger config apply on relevant changes

## Dependencies

- `TODO_02_auth_and_tenant_model.md`
- `TODO_05_config_apply_and_reconciliation.md`

## Implementation notes

- OAuth callbacks terminate in the control plane.
- Integration tokens are stored centrally and encrypted at rest.
- Only tenant-specific runtime material should be written to the VPS.

## Exit criteria

- Slack or first integration can be connected
- integration state is stored centrally
- tenant config apply can be triggered from integration changes

## Status checklist

- [ ] create integration schema
- [ ] implement OAuth entry and callback routes
- [ ] encrypt stored secrets
- [ ] trigger apply after connection

## Open questions

- Which integration is the first must-have for launch?
