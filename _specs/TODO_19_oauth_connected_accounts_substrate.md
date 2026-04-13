# TODO 19: OAuth Connected Accounts Substrate

## Executive Summary

This spec defines a Postgres-backed OAuth substrate for workspace-managed integrations inside Otto.

The key decisions are:

- Otto should own OAuth session state, connected-account state, encrypted credentials, refresh state, and audit history in Postgres.
- Provider-specific integration code should plug into a shared OAuth lifecycle instead of each integration inventing its own auth flow.
- `tenant_integrations` remains the canonical workspace-visible integration record.
- OAuth providers should be modeled through a small definition interface that captures provider quirks such as PKCE, custom authorize params, token endpoint behavior, and scope formatting.
- Credentials must stay encrypted at rest in the control plane and must never be projected into the tenant runtime.
- Refresh and recovery should use the in-repo worker and job system before introducing any hosted workflow or auth broker dependency.
- Hosted auth services remain optional fallbacks for long-tail integrations, but first-party high-value integrations should default to the Otto-owned substrate.

This spec does not replace `TODO_17_managed_integrations_architecture.md`. It supplies the missing OAuth and connected-accounts layer that `TODO_17` can build on for workspace-managed outbound integrations.

## Goal

The purpose of this substrate is to let Otto connect third-party applications through a reusable, reliable OAuth layer without pushing provider auth lifecycle into Nango, Pipedream, or any other external broker by default.

The system must let Otto:

1. start and complete OAuth connects for multiple providers through one shared lifecycle
2. store and rotate provider credentials securely
3. refresh access tokens safely and durably
4. surface reconnect and failure state clearly to the workspace UI
5. feed canonical connection state back into `tenant_integrations` and desired-state projection

## Scope

This spec covers:

- OAuth 2.0 authorization-code providers
- optional PKCE
- custom authorize params such as Linear `actor=app`
- encrypted access and refresh token storage
- refresh lifecycle, retry state, and durable failure state
- workspace-scoped connected-account ownership
- audit events for connect, refresh, failure, reconnect, revoke, and disconnect

This spec does not cover in the first implementation:

- OAuth 1.0a
- API key-only connectors
- client-credentials-only connectors
- webhook ingestion as part of the auth substrate itself
- the long-tail custom integration marketplace model from `TODO_17`

## Relationship To TODO 17

`TODO_17_managed_integrations_architecture.md` remains the source of truth for:

- workspace-visible integration UX
- runtime capability injection
- integration-gateway extraction
- provider capability surfaces
- managed integration settings and policy

This spec adds the reusable auth layer that should sit beneath workspace-managed outbound integrations such as Linear, GitHub, and Notion.

The important boundary is:

- `TODO_17` owns the integration product model
- `TODO_19` owns the OAuth connected-account substrate

## Architecture

The substrate has five core parts:

- provider definitions in code
- short-lived OAuth session records
- durable connected-account records
- encrypted credential storage
- worker-driven refresh and recovery

The high-level topology should be:

```text
Workspace UI
  -> OAuth start route
  -> provider authorize URL
  -> OAuth callback route
  -> connected-account persistence
  -> tenant integration projection

web / worker
  -> integration_oauth_sessions
  -> integration_oauth_connections
  -> integration_oauth_credentials
  -> integration_oauth_events
  -> tenant_integrations

tenant runtime
  -> never receives provider OAuth credentials
  -> only receives managed integration capability projection
```

## Data Model

The substrate should add four generic tables:

### `integration_oauth_sessions`

Short-lived auth attempts.

- `tenant_id`
- `organization_id`
- `tenant_integration_id` nullable
- `provider_key`
- `user_id`
- `mode`
- `state_nonce`
- `pkce_code_verifier`
- `requested_scopes_csv`
- `authorize_params_json`
- `expires_at`
- `consumed_at`

### `integration_oauth_connections`

One durable OAuth connection record per tenant integration.

- `tenant_integration_id` unique
- `provider_key`
- `external_account_id`
- `external_account_label`
- `auth_mode`
- `actor_type`
- `status`
- `requested_scopes_csv`
- `granted_scopes_csv`
- `credentials_expires_at`
- `refresh_token_expires_at`
- `last_refresh_started_at`
- `last_refresh_succeeded_at`
- `last_refresh_failed_at`
- `refresh_attempt_count`
- `refresh_retry_after`
- `token_version`
- `last_error`
- `last_error_at`

### `integration_oauth_credentials`

Current encrypted credential material for a connection.

- `connection_id` unique
- `access_token_ciphertext`
- `refresh_token_ciphertext`
- `id_token_ciphertext`
- `token_type`
- `raw_token_response_json`
- `rotated_at`

### `integration_oauth_events`

Append-only lifecycle and audit history.

- `connection_id`
- `tenant_integration_id`
- `provider_key`
- `event_type`
- `status_before`
- `status_after`
- `details_json`
- `error_message`

Provider-specific installation tables remain valid on top of this substrate. For example, Linear should still keep a dedicated installation row with workspace metadata needed by the integration itself.

## Provider Definition Interface

Each provider should implement a small definition interface.

Required responsibilities:

- authorize URL
- token URL
- client credential loading
- default requested scopes
- scope formatting
- PKCE requirement
- custom authorize params
- token exchange request builder
- refresh request builder
- token response parser
- refresh error classification
- optional post-connect identity fetch

This keeps the shared lifecycle generic while leaving provider quirks isolated.

## Reliability Requirements

The substrate must directly address these concerns:

- `State safety`
  Signed state plus single-use DB-backed session rows bound to workspace, provider, and user.
- `Idempotent callbacks`
  Session consumption and connection upsert must be safe against duplicate callbacks.
- `Token rotation`
  Refresh writes must replace credential material atomically and increment a version.
- `Concurrent refresh`
  Refresh paths must serialize per connection with row locking.
- `Expiry handling`
  Refresh before expiry with a safety buffer and support providers with weak expiry metadata.
- `Revocation detection`
  Terminal refresh failures must move connections into `needs_attention`.
- `Reconnect semantics`
  Reconnect must repair the existing workspace connection instead of creating duplicates.
- `Scope drift`
  Persist both requested and granted scopes.
- `Provider quirks`
  Provider definitions must support custom authorize params, PKCE, varying scope formatting, and token endpoint auth styles.
- `Secret storage`
  Tokens are encrypted at rest and never projected into tenant runtime config.
- `Background recovery`
  Worker jobs should retry transient refresh failures with backoff and durable state.
- `Observability`
  Connect, refresh, failure, reconnect, revoke, and disconnect events must be queryable.
- `Clock and race issues`
  Token updates and refresh state transitions must be transactional.
- `Provider outages and rate limits`
  Temporary failures should not permanently disconnect healthy connections.
- `Disconnect cleanup`
  Disconnected integrations must stop refreshing and must be removed from runtime projection.

## First Implementation Slice

The first shipping slice for this spec should:

1. add the four generic OAuth tables
2. add a shared provider-definition registry
3. add a shared OAuth session and state helper
4. add shared start and callback routes for managed integration providers
5. migrate Linear from hosted Nango to the new substrate
6. store Linear credentials directly in Otto with encryption
7. persist requested and granted scopes plus actor type for Linear
8. enqueue desired-state recompilation and runtime apply after successful Linear connect or reconnect
9. add the first worker-side refresh job for expiring OAuth connections
10. add a shared managed-integration disconnect route that clears stored credentials, records a disconnect event, and removes the integration from runtime projection

## Implementation Notes

- Keep Next.js route handlers thin.
- Use the existing in-repo worker and DB-backed job queue.
- Keep provider-specific installation updates behind small service functions.
- Reuse the existing control-plane encryption secret and OAuth state secret.
- Prefer additive migrations over refactoring old integration tables in place.
- Preserve the current Linear workspace page and status model while swapping the backing auth flow.

## Acceptance Criteria

- Otto can start a Linear OAuth connect without Nango.
- Linear can be installed with provider-specific authorize params such as `actor=app`.
- Successful Linear callback creates or repairs one durable OAuth connection row plus encrypted credentials.
- `tenant_integrations` remains the canonical workspace connection state.
- Duplicate or repeated callback attempts do not create duplicate connected-account rows.
- The worker can refresh an expiring Linear OAuth connection and rotate tokens safely.
- Failed refreshes move the Linear connection into `needs_attention` with a durable error message.
- The runtime manifest still only includes `linear` after a successful connect.

## Status Checklist

- [x] add generic OAuth tables
- [x] add shared provider-definition registry
- [x] add shared OAuth start route
- [x] add shared OAuth callback route
- [x] add shared encrypted credential persistence
- [x] add shared refresh job and retry path
- [x] migrate Linear onto the shared substrate
- [x] remove Linear's Nango dependency from the active path
- [x] update `TODO_17_managed_integrations_architecture.md`
- [x] update `_specs/STATUS.md`

## Open Questions

- Should provider tokens be stored only in `integration_oauth_credentials`, or should some integrations also mirror limited derived metadata into provider-specific tables for operator support?
- How quickly do we need proactive reconnect UX beyond the initial `needs_attention` state on the workspace integration page?
- When `integration-gateway` is extracted from `web`, should request-time refresh live in the gateway or stay in control-plane APIs called by the gateway?
