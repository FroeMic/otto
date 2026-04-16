# TODO 33: PostHog Integration

## Goal

Add PostHog as a workspace-managed analytics integration so Otto can inspect product analytics, query events, review dashboards and insights, and safely manage selected product-operations objects such as feature flags, experiments, and annotations.

The integration must use a generic API-key credential substrate instead of fitting PostHog into the OAuth connected-accounts model.

## Scope

Included:

- Generic encrypted API-key credential substrate for workspace-managed integrations.
- Generic non-secret tenant integration state for provider configuration.
- PostHog workspace setup with host, declared scopes, and multiple project/environment targets.
- PostHog runtime commands exposed through the existing `otto-integrations` metatool.
- Read commands for project discovery, taxonomy, HogQL queries, insights, dashboards, feature flags, experiments, annotations, persons, and session recordings.
- Write commands for selected PostHog resources with explicit confirmation and change reason requirements.
- Scope gating and clear `needs_attention` behavior for missing, invalid, revoked, or under-scoped credentials.
- Workspace UI for connecting, reconnecting, target management, capabilities, and disconnect.

Not included:

- PostHog OAuth.
- PostHog event capture, identify, or public project-token flows.
- Large data exports or batch ingestion.
- PostHog webhook ingestion.
- Direct project create/update/delete commands.
- Raw unbounded PostHog API proxying.

## Dependencies

- `TODO_17_managed_integrations_architecture.md`
- `TODO_19_oauth_connected_accounts_substrate.md`
- Existing integration registry, runtime execution, capability policy, and execution audit paths.
- Existing control-plane encryption helpers.

## Architecture

PostHog should follow the current managed integration architecture:

- `packages/features/integrations-runtime` owns provider definition, client, command implementations, auth helpers, and shared schemas.
- `apps/api` owns workspace API adapters and runtime HTTP adapters.
- `apps/web` owns workspace UI only.
- Tenant runtimes never receive PostHog API keys.

The high-level flow:

```text
Workspace setup
  -> validate PostHog host and API key
  -> upsert tenant_integrations
  -> store encrypted integration_api_credentials row
  -> store non-secret tenant_integration_state row

Runtime command
  -> otto-integrations metatool
  -> apps/api runtime integration route
  -> integration gateway execution
  -> resolve tenant integration, policy, scopes, and API credential
  -> execute PostHog client command
  -> record integration_execution_audits
```

## Data Model

Add a generic API-key credential table:

```text
integration_api_credentials
- id uuid primary key
- tenant_integration_id uuid unique references tenant_integrations(id)
- provider_key varchar(64)
- credential_type varchar(64)
- secret_ciphertext text
- status varchar(64)
- declared_scopes_csv text
- external_account_label text null
- metadata_json jsonb default {}
- last_validated_at timestamptz null
- last_error text null
- last_error_at timestamptz null
- created_at timestamptz
- updated_at timestamptz
```

Add generic non-secret provider state:

```text
tenant_integration_state
- id uuid primary key
- tenant_integration_id uuid unique references tenant_integrations(id)
- provider_key varchar(64)
- state_json jsonb default {}
- state_version integer
- created_at timestamptz
- updated_at timestamptz
```

PostHog state shape:

```json
{
  "host": "https://us.posthog.com",
  "defaultTargetKey": "production",
  "targets": [
    {
      "key": "production",
      "label": "Production",
      "organizationId": "org-id",
      "projectId": "123",
      "environmentId": "456"
    }
  ]
}
```

## Command Groups

### `workspace`

- `workspace.list_projects`
- `workspace.get_project`

Purpose: project and environment discovery.

### `taxonomy`

- `taxonomy.event_definition.list`
- `taxonomy.property_definition.list`
- `taxonomy.action.list`

Purpose: help Otto understand event names, properties, and product-defined actions before writing HogQL.

### `query`

- `query.hogql`

Purpose: bounded read-only HogQL query escape hatch.

Guardrails:

- allow only `select` and `with`
- reject multiple statements
- require or inject a `limit`
- cap results at 500 rows
- timeout provider requests
- return compact rows and metadata

### `insight`

- `insight.list`
- `insight.get`
- `insight.create`
- `insight.update`

### `dashboard`

- `dashboard.list`
- `dashboard.get`
- `dashboard.run_insights`

### `feature_flag`

- `feature_flag.list`
- `feature_flag.get`
- `feature_flag.activity`
- `feature_flag.create`
- `feature_flag.update`
- `feature_flag.archive`

`feature_flag.archive` should use PostHog's soft-delete/archive model rather than a hard delete.

### `experiment`

- `experiment.list`
- `experiment.get`
- `experiment.create`
- `experiment.update`
- `experiment.archive`

### `annotation`

- `annotation.list`
- `annotation.create`

### `person`

- `person.list`

Keep person mutation out of the first pass.

### `session_recording`

- `session_recording.list`

Keep session recording mutation out of the first pass.

## Write Safety

Write commands must require:

- `changeReason: string`
- `confirm?: boolean`

When `confirm` is not true, commands return a plan:

```json
{
  "planned": true,
  "requiresConfirmation": true,
  "summary": "...",
  "nextArguments": {}
}
```

Destructive or archive-like commands must require stronger identifiers such as id/key/status and should be marked with `safety: "destructive"`.

## Required Provider Scopes

Recommended read/write setup:

```text
project:read
query:read
insight:read
insight:write
dashboard:read
dashboard:write
feature_flag:read
feature_flag:write
activity_log:read
experiment:read
experiment:write
annotation:read
annotation:write
event_definition:read
property_definition:read
action:read
person:read
session_recording:read
```

Workspace setup should support a read-only mode by accepting a smaller declared scope set and marking write commands unavailable before execution.

## Implementation Notes

- Keep the generic API-key substrate narrow: no marketplace abstraction and no generic secret JSON blob.
- Normalize PostHog hosts to origins and reject paths, query strings, and fragments.
- Support `https://us.posthog.com`, `https://eu.posthog.com`, and self-hosted origins.
- Keep project, environment, and organization endpoint builders explicit.
- Return shaped, compact command responses instead of raw provider payloads by default.
- Do not add a runtime `validate_connection` command; validation belongs to workspace setup.
- Existing OAuth integrations must continue working.
- Workspace-facing API should use the existing Hono RPC pattern.
- User-facing copy must use `workspace` and `Otto`, not internal backend terminology.

## Acceptance Criteria

- PostHog appears in the workspace integration catalog.
- A workspace user can connect PostHog with host, API key, declared scopes, and multiple targets.
- PostHog API keys are encrypted at rest and never projected into tenant runtime config.
- Otto can discover PostHog commands through `list_integrations`, `find_integration_commands`, and `get_integration_details`.
- Otto can execute the first read command set through `execute_integration_command`.
- Otto can execute selected write commands only after explicit confirmation.
- HogQL commands are bounded and read-only.
- Commands select organization, project, or environment endpoints correctly.
- Missing scopes disable or block affected commands before provider calls.
- Invalid or revoked credentials move the integration to `needs_attention`.
- Disconnect removes usable credential material and disables runtime commands.
- Execution audits are recorded for successful and failed PostHog command calls.
- Existing Slack, Linear, Gandi, and Brave behavior remains unchanged.

## Status Checklist

- [x] Spec accepted.
- [x] Generic API-key credential schema and helpers added.
- [x] Integration execution supports API-key auth.
- [ ] PostHog client and target resolution added.
- [ ] PostHog read commands added.
- [ ] PostHog write commands and confirmation behavior added.
- [ ] Workspace API and UI added.
- [ ] Tests and build gates pass.

## Open Questions

- Should PostHog writes initially support only feature flags, experiments, insights, and annotations, or should dashboard writes be included in the first write slice?
- Should target management support editing existing targets in the first UI, or start with full replacement of the target list?
- Should command responses expose `includeRaw` for debugging, or should raw provider payloads stay unavailable until a later diagnostics spec?
