# TODO 28: Workspace Onboarding And Public Intake

## Goal

Build a business-first signup and onboarding flow where:

1. a visitor writes a business brief on the public landing page
2. submit requires sign-in or sign-up
3. Otto auto-creates a workspace for first-time users after auth
4. the user completes a short authenticated onboarding flow
5. Otto provisions the initial tenant server in the background once onboarding is eligible
6. the user is held on a waiting or waitlist screen until the workspace is ready
7. once unlocked, the user lands in `/{orgSlug}` with the original brief prefilled in the Agent input

This replaces the old Slack-first onboarding model as the primary setup path.

## Scope

- add a durable public intake session for landing-page prompt capture
- add a durable workspace onboarding run model for authenticated setup
- auto-create the first workspace during post-auth bootstrap
- add a short guided onboarding flow under `/{orgSlug}/onboarding`
- gate workspace unlock on onboarding + provisioning readiness, not Slack connection
- reuse the existing worker provisioning pipeline through a one-shot onboarding-owned trigger, while allowing onboarding to choose between legacy base-image provisioning and snapshot-based provisioning
- add `/{orgSlug}/waiting` and `/{orgSlug}/waitlist` holding screens
- prefill the workspace Agent input from the original public brief after unlock
- remove or replace legacy Slack-first onboarding assumptions in code and specs

## Out of scope

- do not add a new Slack-first onboarding flow
- do not require Slack before the first workspace unlock
- do not implement teammate invite delivery yet
- do not implement a full agent-led onboarding conversation yet
- do not add billing or paywall gating
- do not redesign the worker provisioning runtime itself

## Dependencies

- `DONE_02_auth_and_tenant_model.md`
- `TODO_03_provisioning_workflow.md`
- `TODO_09_ui_app_shell_and_onboarding_rebuild.md`
- `TODO_20_unified_frontend_and_hono_migration.md`

## Supersedes

- `TODO_08_signup_to_slack_onboarding_flow.md`

That older spec described a Slack-first provisioning gate. The product direction is now business-first onboarding, with Slack treated as a later integration instead of the initial workspace unlock dependency.

## Product flow

```text
Landing page
  -> enter business brief
  -> submit

Auth
  -> sign in / sign up with WorkOS

Post-auth bootstrap
  -> create workspace automatically if first-time user
  -> create onboarding run
  -> store starter prompt
  -> redirect to /{orgSlug}/onboarding

Onboarding
  -> confirm workspace identity
  -> choose business type
  -> choose team size
  -> optionally add teammate invites

Decision
  -> accepted: start provisioning if eligible
  -> waitlisted: store everything, do not provision

Provisioning
  -> create tenant + server rows
  -> enqueue provisioning job for the selected strategy

Holding state
  -> /{orgSlug}/waiting while runtime is spinning up
  -> /{orgSlug}/waitlist if gated

Unlock
  -> organizations.is_ready = true
  -> /{orgSlug}
  -> Agent input is prefilled from the original business brief
```

## Architecture

```text
apps/web
├─ public SSR landing + login handoff
├─ onboarding pages
├─ waiting / waitlist pages
└─ workspace Agent page reads starter prompt

apps/api
├─ public intake route
├─ auth callback / post-auth bootstrap
├─ onboarding routes
├─ onboarding persistence
└─ one-shot provisioning eligibility trigger

apps/worker
└─ existing provisioning job pipeline

packages/features/workspace-onboarding
├─ contracts
├─ flow definitions
├─ question definitions
├─ answer types
└─ status helpers
```

## Data model

### `public_intake_sessions`

Purpose:

- preserve the public landing prompt before auth
- store attribution and experiment state cleanly
- avoid carrying the starter prompt through long-lived query-string state

Suggested columns:

- `id`
- `prompt`
- `source`
- `utm_json`
- `experiment_json`
- `status`
- `converted_user_id`
- `converted_organization_id`
- `created_at`
- `updated_at`

### `workspace_onboarding_runs`

Purpose:

- store one durable, resumable onboarding run for the new workspace
- capture the starter prompt and structured onboarding answers
- track waitlist and provisioning state

Suggested columns:

- `id`
- `organization_id`
- `user_id`
- `flow_key`
- `flow_version`
- `status`
- `current_step_key`
- `answers_json`
- `starter_prompt`
- `starter_prompt_consumed_at`
- `waitlist_decision`
- `waitlist_reason`
- `initial_tenant_id`
- `initial_provisioning_job_id`
- `provisioning_started_at`
- `completed_at`
- `created_at`
- `updated_at`

### Existing `organizations.is_ready`

Keep `organizations.is_ready` as the final unlock boolean only.

Do not use it as the full onboarding workflow state machine.

## Question model

Store answers as JSON keyed by stable question ids.

Example:

```json
{
  "workspace_name": "Acme",
  "workspace_slug": "acme",
  "business_type": "saas",
  "team_size": "2_5",
  "invite_emails": ["a@acme.com", "b@acme.com"]
}
```

This is the required extensibility point for future questions. New questions should be added in code by stable key, not by creating a new DB column every time.

## Initial onboarding questions

### Step 1. Workspace identity

- workspace name
- workspace slug

Both should be prefilled automatically during post-auth bootstrap and remain editable before continuing.

### Step 2. Business type

Recommended categories:

- `saas`
- `ai_product`
- `agency_or_service`
- `marketplace`
- `internal_tool_or_ops`
- `other`

### Step 3. Team setup

- `solo`
- `2_5`
- `6_20`
- `21_plus`
- invite emails list

Invite capture is in scope. Invite sending is not.

## Provisioning model

Provisioning should start only once and should reuse the existing worker pipeline family.

### Eligibility rule

Provisioning may start when all are true:

- required onboarding answers are complete
- `waitlist_decision = accepted`
- `provisioning_started_at is null`
- `initial_tenant_id is null`
- no tenant exists yet for the workspace

### Trigger

Add one onboarding-owned entrypoint such as:

- `maybeStartInitialProvisioningForWorkspaceOnboarding(runId)`

Responsibilities:

1. lock the onboarding run
2. verify eligibility
3. create the initial tenant if missing
4. enqueue the correct provisioning job for the selected strategy
5. write back:
   - `initial_tenant_id`
   - `initial_provisioning_job_id`
   - `provisioning_started_at`

This must be idempotent and safe to call from:

- onboarding step completion
- operator waitlist approval
- future retry / repair flows

### Provisioning strategy selection

Onboarding should be able to queue one of two provisioning strategies:

- legacy base-image provisioning through `provision_tenant_server`
- snapshot-based provisioning through `provision_tenant_server_from_snapshot`

The onboarding waiting, waitlist, and unlock behavior should remain strategy-agnostic.

## Waitlist model

Recommended values:

- `pending`
- `accepted`
- `waitlisted`
- `manual_review`

If a user is waitlisted:

- keep the workspace and onboarding run
- keep the original prompt and onboarding answers
- do not provision
- show a dedicated waitlist page

If a user is later approved, the exact same provisioning trigger should run. Do not add a separate special-case provisioning path for “removed from waitlist”.

## Unlock rule

The workspace is unlocked when:

- required onboarding answers are complete
- `waitlist_decision = accepted`
- the initial tenant server is healthy
- required initial runtime readiness checks pass

Then:

- set `organizations.is_ready = true`

Slack should not be a required unlock dependency for this flow.

## Prompt handoff

The original business brief should survive all the way into the workspace Agent surface.

Flow:

- landing prompt is written to `public_intake_sessions.prompt`
- post-auth bootstrap copies it into `workspace_onboarding_runs.starter_prompt`
- after unlock, the workspace Agent page reads the unconsumed starter prompt
- the Agent composer is prefilled
- first send marks `starter_prompt_consumed_at`

## Code placement

### `packages/features/workspace-onboarding`

Own:

- onboarding contracts
- flow schema
- question definitions
- answer typing
- onboarding status helpers

### `apps/api/src/public-intake`

Own:

- landing prompt intake route
- intake persistence
- intake-to-auth handoff

### `apps/api/src/onboarding`

Own:

- onboarding run persistence
- post-auth workspace bootstrap
- onboarding routes
- one-shot provisioning trigger
- waitlist / waiting state reads

### `apps/web/src/features/onboarding`

Own:

- onboarding pages
- waiting page
- waitlist page
- onboarding step UI

### Existing workspace chat feature

`apps/web/src/features/workspace-chat` should remain the owner of the Agent page and prompt composer, but should read a starter prompt from the new onboarding state.

## UI shape

### Public landing

```text
Otto helps turn software into a business

[ Describe the software business you want to launch or run... ]
[ Get started ]
```

### Login handoff

```text
Sign in to continue with Otto

Your business brief
"We launched our SaaS, but onboarding and support are still manual..."

[ Sign in ]
[ Create account ]
```

### Onboarding step shell

```text
              Otto

      What kind of business are you building?

 [ SaaS ] [ AI product ]
 [ Agency / service ] [ Marketplace ]
 [ Internal tool / ops ] [ Other ]

               [ Next ]
              ● ○ ○
```

### Waiting page

```text
              Otto

      We are setting up your agent

  Workspace created
  Provisioning tenant server
  Applying initial runtime config

         [ Refresh status ]
```

### Waitlist page

```text
              Otto

         You're on the waitlist

 We saved your business brief and onboarding details.
 We'll notify you when Otto is ready for your workspace.
```

## Acceptance criteria

- landing prompt submit requires auth
- a first-time user gets a workspace automatically after auth
- the workspace gets a generated name and slug automatically
- the user lands in a short authenticated onboarding flow
- onboarding state is durable and resumable
- provisioning starts only once when the run becomes eligible
- waitlisted users do not provision
- accepted users can be held on a waiting page until runtime is ready
- unlocked users land in `/{orgSlug}`
- the original business brief is prefilled in the Agent composer
- old Slack-first onboarding unlock assumptions are removed from active code paths

## Ordered implementation plan

1. add this spec and update status / supersession notes
2. remove the dead Slack-gated onboarding remnants from readiness helpers and dashboard projection shape
3. add the shared onboarding package
4. add DB schema and migration for `public_intake_sessions` and `workspace_onboarding_runs`
5. add public intake route and landing handoff
6. add post-auth auto workspace creation + onboarding bootstrap
7. add onboarding routes and one-shot provisioning trigger
8. add onboarding, waiting, and waitlist pages
9. wire workspace route gating
10. wire starter prompt prefill into the Agent page

## Status checklist

- [ ] add the new onboarding spec and mark Slack-first onboarding superseded
- [ ] remove dead Slack-gated onboarding remnants
- [ ] add onboarding contracts package
- [ ] add DB schema and migration
- [ ] add public intake persistence and route
- [ ] add post-auth workspace bootstrap
- [ ] add onboarding API routes
- [ ] add one-shot initial provisioning trigger
- [ ] add onboarding UI routes and pages
- [ ] add waiting / waitlist states
- [ ] gate workspace routes on the new onboarding status
- [ ] prefill the Agent page from the starter prompt
- [ ] add tests for intake, onboarding, gating, and provisioning eligibility

## Open questions

- should operator waitlist approval exist in the first implementation slice, or is direct default acceptance enough while the waitlist page remains dormant?
- should teammate invite drafts be stored only in `answers_json` for now, or projected into a first-class invites table immediately?
- should post-auth bootstrap always create a workspace for a first-time user, or should there be a later workspace chooser once multi-workspace membership becomes common?
