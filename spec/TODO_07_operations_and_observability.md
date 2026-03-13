# TODO 07: Operations And Observability

## Goal

Add the minimum operational tooling needed to support pilot tenants safely.

## Scope

- job and tenant status views
- apply run history
- error surfaces and alerts
- admin actions for retry and rebuild

## Dependencies

- `TODO_03_provisioning_workflow.md`
- `TODO_05_config_apply_and_reconciliation.md`
- `TODO_06_integrations_and_oauth.md`

## Implementation notes

- Build operations around the DB state model first.
- Every retry or operator action should be auditable.
- Prefer narrow admin actions over a broad remote shell.

## Exit criteria

- dashboard exposes tenant, server, and apply status
- failures can be retried intentionally
- operators have enough logs to diagnose common issues

## Status checklist

- [ ] add tenant status dashboard
- [ ] add apply history view
- [ ] add retry controls
- [ ] add basic alerting or error reporting

## Open questions

- What level of admin tooling is needed before the first customer?
