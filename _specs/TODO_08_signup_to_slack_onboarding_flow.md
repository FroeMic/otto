# TODO 08: Signup To Slack Onboarding Flow

## Superseded

This spec is now superseded by `TODO_28_workspace_onboarding_and_public_intake.md`.

Reason:

- the product onboarding flow is now business-first, not Slack-first
- workspace creation should happen automatically during post-auth bootstrap
- tenant provisioning should be gated by the new onboarding run and waitlist decision, not by Slack installation
- Slack remains an integration feature, but it should no longer be the primary unlock dependency for first workspace access

Keep this file only as historical context for the older Slack-specific provisioning assumptions.

## Goal

Replace the current "sign in -> create tenant -> provision immediately" flow with a guided onboarding flow where the user:

1. signs in
2. creates or selects a workspace
3. installs the shared Otto Slack app into their Slack workspace
4. returns through OAuth with a tenant-specific Slack bot token stored in the control plane
5. only then starts Hetzner provisioning for that tenant runtime

This makes the first tenant boot materially closer to the real product:

- the tenant runtime starts with the correct Slack bot token already present
- the control plane owns the canonical Slack installation state
- provisioning no longer depends on temporary global Slack env vars

## Important clarification

There are two different Slack token types in this architecture:

- shared app-level token
  - owned by Otto
  - configured once in the control plane
  - not tenant-specific
- tenant/workspace bot token
  - returned by Slack OAuth for the installing workspace
  - unique per customer installation
  - must be stored per tenant integration and projected to the tenant runtime

So the provisioning gate should be:

- do not provision until the tenant-specific Slack bot token is available

not:

- wait for a new app token per tenant

## Product flow

### Current flow

- user signs in
- user creates tenant
- provisioning starts immediately
- Slack is injected from shared control-plane env only

### Target flow

- user signs in
- user enters onboarding instead of the plain dashboard
- user creates a workspace or selects one
- user enters tenant name
- user clicks `Install Slack`
- browser is redirected to Slack OAuth with tenant-bound state
- callback returns to the control plane
- the control plane stores the Slack installation and bot token
- the control plane shows onboarding completion state
- user clicks `Provision tenant`
- tenant creation finalizes and the provisioning job starts with tenant-specific Slack config

## UX plan

### Step 1. Signed-in empty state becomes onboarding

If the signed-in user has no tenants yet, `/` should render an onboarding flow instead of the generic dashboard.

Suggested onboarding steps:

1. `Workspace`
   - create workspace name if none exists
2. `Tenant`
   - enter tenant name
3. `Slack`
   - install Slack app
   - show connected workspace name after callback
4. `Provision`
   - confirm and start provisioning

### Step 2. Provisioning is explicitly gated

The UI should not enqueue `provision_tenant_server` until:

- organization is internally marked ready
- workspace exists
- tenant draft exists
- Slack installation is connected for that tenant

### Step 2a. Workspace activation is separate from signup

- WorkOS signup can stay publicly enabled
- creating a workspace must not immediately unlock the org-scoped shell
- the control plane needs an internal `organizations.is_ready` gate before users can:
  - enter the main org shell
  - connect Slack
  - provision the tenant runtime
- until then, users should land on a waiting / review state outside the main shell

### Step 3. Onboarding status is resumable

The user should be able to refresh or leave during OAuth and come back without losing progress.

That requires a persisted onboarding draft state in the DB.

## Control-plane data model plan

Add onboarding and Slack integration records that exist before provisioning.

### Suggested tables

- `tenant_onboarding_sessions`
  - `id`
  - `organization_id`
  - `user_id`
  - `tenant_name`
  - `status`
  - `slack_connected_at`
  - `completed_at`
  - `created_at`
  - `updated_at`

- `tenant_integrations`
  - `id`
  - `tenant_id`
  - `provider_key`
  - `status`
  - `connected_at`
  - `disconnected_at`

- `integration_slack_installations`
  - `id`
  - `tenant_integration_id`
  - `slack_team_id`
  - `slack_team_name`
  - `slack_enterprise_id`
  - `slack_bot_user_id`
  - `installer_user_id`
  - `scope_csv`
  - `installed_at`
  - `last_webhook_at`

- `integration_credentials`
  - `id`
  - `tenant_integration_id`
  - `secret_type`
  - `ciphertext`
  - `key_version`
  - `created_at`
  - `rotated_at`

### Secret material

Store centrally:

- Slack bot token
- Slack refresh token if Slack rotation is enabled later

Do not store only on the tenant VPS.

The control plane must remain the source of truth.

## OAuth flow plan

### Step 1. Start install

Add a Slack install start route:

- `GET /api/integrations/slack/start`

Responsibilities:

- require authenticated user
- require onboarding session or draft tenant context
- sign OAuth state containing:
  - onboarding session id
  - organization id
  - user id
  - post-install return path
- redirect to Slack OAuth

### Step 2. Callback

Add a Slack callback route:

- `GET /api/integrations/slack/callback`

Responsibilities:

- validate state
- exchange code with Slack
- persist installation metadata
- encrypt and store returned bot token
- mark onboarding session `slack_connected`
- redirect back to the onboarding UI

### Step 3. Provision trigger

When onboarding reaches `slack_connected`:

- create the real tenant row if it is still draft-only
- create tenant desired state including Slack channel config
- enqueue `provision_tenant_server`

Provisioning should fail fast if the Slack integration record is missing.

## Runtime projection plan

Stop using shared per-process Slack runtime env for tenant provisioning.

Instead:

- keep Otto-owned shared Slack app credentials in control-plane env only
- project the tenant-specific Slack bot token from DB into the tenant runtime `.env`
- render tenant-specific Slack config into `openclaw.json`

Temporary acceptable v1 split:

- keep shared app token in control-plane env
- project tenant bot token from DB

That preserves the current OpenClaw Socket Mode startup path while moving the tenant-specific secret to the correct source of truth.

## Ordered implementation steps

### Step 1. Introduce onboarding draft state

Deliverables:

- onboarding session table
- onboarding status model
- UI flow replacing the current empty-state tenant creation form

Exit check:

- signed-in user can create an onboarding draft and resume it after refresh

### Step 2. Add Slack OAuth routes

Deliverables:

- Slack start route
- Slack callback route
- signed state payload
- Slack installation persistence

Exit check:

- user can install the shared Otto Slack app and return to onboarding

### Step 3. Gate provisioning on Slack completion

Deliverables:

- tenant provisioning starts only after Slack callback succeeds
- bot token is present in the DB before provisioning begins

Exit check:

- no new tenant is provisioned without a Slack installation
- no organization can reach Slack install or provisioning until it is internally marked ready

### Step 4. Project per-tenant Slack credentials to runtime

Deliverables:

- remove dependence on `RUNTIME_SLACK_BOT_TOKEN` for tenant installs
- runtime bootstrap reads bot token from the tenant integration record
- tenant `openclaw.json` and `.env` include the correct tenant-specific Slack values

Exit check:

- two tenants can provision with different Slack bot tokens

### Step 5. Add onboarding completion and recovery UX

Deliverables:

- onboarding success state
- recover from cancelled OAuth
- reconnect Slack action if install is revoked or stale

Exit check:

- user can retry OAuth without creating duplicate tenants or orphaned installs

## Acceptance criteria

- after sign-in, first-time users land in onboarding instead of the generic dashboard
- Slack install is completed before provisioning starts
- the Slack bot token is stored centrally and encrypted
- provisioning uses tenant-specific Slack credentials
- the tenant runtime comes up already connected to the correct Slack workspace
- onboarding is resumable across refreshes and OAuth redirects

## Non-goals for this slice

- shared Slack HTTP ingress routing
- Slack slash commands and interactive payload routing
- multi-tenant install management UI
- OAuth token rotation lifecycle
- Slack uninstall webhooks

Those stay covered by `TODO_06_integrations_and_oauth.md` as later follow-on work.
