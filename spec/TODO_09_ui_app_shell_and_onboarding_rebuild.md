# TODO 09: UI App Shell And Onboarding Rebuild

## Goal

Rebuild the authenticated web UI around an organization-scoped app shell with gated onboarding so the product feels like a real control plane instead of a bootstrap page, while treating each organization as having exactly one Otto agent in the first product pass.

## Scope

- replace the current bootstrap dashboard with a proper authenticated app shell
- add a dedicated login page and direct WorkOS signup entry under `app.*`
- introduce organization-scoped routes under `/{orgSlug}/...`
- add a sidebar layout with:
  - organization switcher and organization settings access at the top
  - user menu and user settings access at the bottom
  - primary navigation for:
    - Agent
    - Integrations
    - Tools
    - Skills
    - Scheduled Tasks
- add a platform-admin-only route tree under `/platform` with:
  - a dedicated shell and sidebar separate from the workspace shell
  - a global organizations operations page
  - a reusable data table component that can be reused by future admin lists
- gate users into onboarding when:
  - they have no organization yet
  - or their organization does not yet have both:
    - a connected Slack workspace
    - an up and running VPS / runtime
- add a real Slack integration detail page at `/{orgSlug}/integrations/slack`
- keep the prototype visually neutral:
  - use shadcn building blocks and shadcn blocks
  - do not add custom color styling to shadcn components yet
- define a prefixed ID strategy for entities like `org_*` and `user_*`

## Dependencies

- `DONE_02_auth_and_tenant_model.md`
- `TODO_03_provisioning_workflow.md`
- `TODO_06_integrations_and_oauth.md`
- `TODO_08_signup_to_slack_onboarding_flow.md`

## Product framing

- The web app is the control plane.
- Slack remains the primary interaction surface for the agent.
- The web UI is for setup, visibility, configuration, and operational trust.
- The primary UI should avoid exposing raw infrastructure concepts unless they are needed for diagnosis.
- The existing backend `tenant` model can remain, but the product UI should speak in terms of one organization-level Otto agent for now.

## Route model

### Public routes

- `/login`
- `/auth/sign-up`

## Public auth redesign

### Design direction

- keep the public auth entry around a split-screen layout modeled after shadcn `login-02`
- do not install `login-02` wholesale, because Otto no longer needs email or password fields and the block would overwrite existing base `button`, `input`, and `separator` primitives
- use the left panel as the product intro and action area:
  - Otto avatar
  - short title
  - short subtitle
  - one or two clear auth actions depending on route
- use the right panel as a branded motion surface built with the `PixelLiquidBg` component from `ui.unlumen.com/components/pixel-liquid-bg`

### Per-route behavior

- `/login`:
  - primary action: sign in with WorkOS
  - secondary action: create account via WorkOS signup
- keep sign-in and sign-up visually aligned so they feel like one public entry system rather than two unrelated pages

### Left panel composition

- top-left Otto wordmark or compact brand mark
- centered content stack with:
  - Otto avatar image from the provided pixel-art portrait
  - title in a stronger display treatment than the rest of the app shell
  - one-sentence subtitle that explains Otto as the team agent / control plane
  - compact CTA stack using existing shadcn button variants
- keep copy intentionally short; avoid feature grids, social proof, or long marketing sections in this first pass

### Right panel composition

- desktop and large tablet only; collapse or hide on smaller screens
- full-height `PixelLiquidBg` canvas with Otto-aligned palette tuning
- keep the panel decorative rather than interactive
- allow a subtle overlay frame or status badge only if it does not compete with the left-side CTA

### Asset and implementation notes

- add the Otto avatar as a real app asset under `web/public` and render it with `next/image`
- because `PixelLiquidBg` is a heavy Three.js surface, isolate it to a client component and keep the surrounding page server-rendered
- tune the background conservatively for auth:
  - lower `resolution` on smaller viewports
  - use a moderate `pixelSize`
  - disable or simplify motion when `prefers-reduced-motion` is set
- do not introduce email inputs, password fields, separators, or third-party social login affordances
- prefer a small shared auth-shell component over duplicated page markup

### Mobile behavior

- stack into a single-column layout
- prioritize avatar, title, subtitle, and buttons above the fold
- either hide the pixel background entirely on mobile or reduce it to a shallow decorative band behind the header area
- keep interaction cost low and avoid making the auth entry feel heavier than the authenticated app

### Suggested starter copy

- title:
  - `Your Team’s Otto`
- subtitle:
  - `Invite-only access to the agent workspace, Slack setup, and runtime control plane.`

### Authenticated onboarding routes

- `/onboarding/create-organization`
- `/{orgSlug}/onboarding`

### Authenticated app routes

- `/{orgSlug}/agent`
- `/{orgSlug}/integrations`
- `/{orgSlug}/integrations/slack`
- `/{orgSlug}/integrations/whatsapp`
- `/{orgSlug}/tools`
- `/{orgSlug}/tools/{surfaceKind}/{surfaceKey}`
- `/{orgSlug}/skills`
- `/{orgSlug}/scheduled-tasks`
- `/{orgSlug}/settings`

## Settings structure

`/{orgSlug}/settings` should contain two sections:

- `User settings`
- `Organization settings`

The user settings section is org-independent in data ownership, but it can still live on the same page for product simplicity.

## Layout system

### App shell

- fixed left sidebar
- fixed bottom footer / status rail
- main content area as the only major scroll container
- no custom prototype color theme beyond default shadcn tokens
- use the shadcn sidebar block as the starting point instead of hand-rolling the shell

### Sidebar structure

- top:
  - Otto label
  - organization dropdown
  - shortcut to organization settings
- middle:
  - Agent
  - Integrations
  - Tools
  - Skills
  - Scheduled Tasks
- bottom:
  - user avatar and identity
  - user dropdown with user settings and sign out

### Main area rules

- every page gets a title, short explanatory copy, and a primary action zone when relevant
- onboarding pages use a narrow guided layout
- normal workspace pages use a broader operations layout

### Footer / status rail

- keep a persistent bottom rail in the authenticated shell
- use it for lightweight workspace context and system status, not for decorative chrome
- likely contents:
  - current organization
  - Slack connection state
  - runtime state
  - one quick action when relevant

## Information architecture

### Agent

Purpose:

- provide a focused instructions area so users can review and edit Otto's shared guidance without leaving the Agent area
- keep a lightweight readiness signal visible without turning the main workspace Agent view into an operator dashboard
- avoid exposing raw infrastructure access in the workspace-facing Agent area once the platform operator surface exists

Initial content:

- a single instructions surface with route-backed file tabs for the managed instruction files
- a small readiness badge near the page title that summarizes whether Otto is ready for the workspace
- separate system and shared instruction sections for each file
- plain-language supporting copy that explains what each file controls without exposing raw runtime details

### Integrations

Purpose:

- show configured integrations, starting with Slack and the next dedicated-number WhatsApp setup flow

Initial content:

- Slack connection state
- link to dedicated Slack integration page
- reconnect / repair path
- WhatsApp connection state
- link to a dedicated WhatsApp integration page with setup instructions, QR linking, and policy settings

### Tools

Purpose:

- show agent capabilities that Otto can project into the tenant runtime
- distinguish global read-only capabilities from future integration-backed capabilities

Initial content:

- Brave Web Search status
- link to a read-only detail page for the `web/search` surface
- placeholder list for future capability surfaces

### Slack integration detail

Route:

- `/{orgSlug}/integrations/slack`

Purpose:

- show the actual state of the Slack integration for the organization
- explain whether Slack is connected, pending, failed, or missing
- give one clear action to continue onboarding or repair the connection

Initial content:

- install / connected status
- Slack workspace name if known
- last connected timestamp if known
- onboarding dependency status
- primary action to connect or reconnect Slack
- after connection, a policy editor for:
  - answering in threads
  - one global Slack people selection list
  - a channel access mode for either selected channels or all channels Otto has been added to
  - one selected-channel list backed by synced Slack directory data when manual channel mode is active
  - one global require-mention toggle across the selected channels
- render the policy editor as a single-column settings document rather than a dashboard grid
- keep the main configuration tab focused on summaries and settings rows
- move Slack people and channel management into a dedicated searchable table tab
- let the channel table add Otto to public channels, remove Otto from joined channels, and explain when private-channel invites still need to happen in Slack

### WhatsApp integration detail

Route:

- `/{orgSlug}/integrations/whatsapp`

Purpose:

- show the actual state of the WhatsApp integration for the organization
- explain the dedicated-number requirement before QR linking starts
- provide one place for QR auth, reconnect, disconnect, and policy settings

Initial content:

- enable / connected / disconnected / failed status
- linked phone number if known
- render the page as a settings-style detail view with a constrained header and a dedicated WhatsApp logo
- use top-level tabs for Capabilities, Status, and Configuration
- keep warnings inside the Status tab and show a status indicator on the tab when attention is required
- a dedicated-number preparation checklist:
  - buy a new phone number
  - activate the SIM or eSIM on the phone
  - install WhatsApp Business
  - register and verify the number there before returning to the workspace
- QR generation plus polling states for waiting, connected, or failed
- move reconnect, disconnect, disable, and reapply actions into the Status tab
- a policy editor for:
  - DM access mode
  - allowed-number allowlist
  - group access mode
  - allowed group IDs
  - allowed group sender numbers
  - require-mention-in-groups
  - ack reaction toggle
- render the policy editor as a single-column settings document with a viewport-fixed floating save/discard bar for unsaved changes

### Skills

Purpose:

- give the team a discoverable place for shared skills without building the full editor in the first pass

Initial content:

- empty state
- simple list scaffold
- callout that skills are shared at the organization level

### Scheduled Tasks

Purpose:

- give visibility into automations and background runs

Initial content:

- task list scaffold
- status badges
- recent / next run summaries when available

### Settings

User settings:

- name
- email
- account management handoff link to WorkOS

Organization settings:

- organization name
- organization slug
- later admin settings

Implementation note:

- the first UI slice should use a dedicated settings shell instead of reusing the main app navigation
- recommended settings routes:
  - `/{orgSlug}/settings/user`
  - `/{orgSlug}/settings/workspace`
  - `/{orgSlug}/settings/workspace/members`

## Onboarding flow

### Step 1: account creation

- user logs in, or reaches the direct WorkOS signup entry
- if the user belongs to no organization, redirect to `/onboarding/create-organization`

### Step 2: organization creation

Collect:

- organization name
- unique organization slug

Then:

- create organization and membership
- redirect into `/{orgSlug}/onboarding`

### Step 3: organization setup gate

The organization remains onboarding-locked until both are true:

- Slack is connected
- VPS / runtime is provisioned and healthy

### Step 4: guided onboarding inside the org

Recommended checklist order:

1. confirm organization identity
2. connect Slack
3. initialize the org's Otto runtime
4. wait for provisioning / health
5. unlock the workspace UI

### Gate behavior

- if a user enters an org route and onboarding is incomplete, redirect to `/{orgSlug}/onboarding`
- allow access to `/{orgSlug}/settings` and `/{orgSlug}/integrations/slack` during onboarding
- once onboarding is complete, default org entry should land on `/{orgSlug}/agent`

## Data and ID strategy

### Recommendation

Because the repo is still early, move exposed core IDs to prefixed string IDs before more tables and integrations depend on raw UUIDs.

Examples:

- `user_...`
- `org_...`
- `tenant_...`
- `srv_...`
- `job_...`

### Implementation direction

- prefer application-generated text IDs for user-facing tables
- add a unique organization slug field for user-facing routes
- keep organization slug as a separate field from the stable prefixed org ID
- treat the prefixed ID as the stable relation key
- treat slug as the human-friendly identifier

### Route note

The stable database key and the user-facing route should be different concerns.

Recommendation for the first pass:

- store both
- use `orgSlug` in routes
- keep prefixed `org_*` IDs as the stable relational key in the database

## Shadcn constraints

- use shadcn CLI and shadcn blocks inside `web/`
- use Bun-oriented commands during implementation
- install the sidebar block instead of recreating the shell from scratch
- prefer `bunx shadcn@latest add sidebar-08` in `web/` for the shell starting point
- use `login-02` only as a layout reference for the public auth shell, not as a direct overwrite target
- do not customize shadcn component colors in the prototype pass
- prefer composition over custom primitive creation

Likely additions during implementation:

- sidebar block
- dropdown menus
- avatar
- form primitives
- cards
- table
- tabs
- skeleton
- badges

## Suggested implementation sequence

1. Lock route, onboarding gate, and ID decisions.
2. Introduce prefixed IDs for `users` and `organizations`, then extend as needed.
3. Split auth into a dedicated `/login` page plus direct WorkOS signup handoff.
4. Redesign the public auth shell around the Otto avatar, short copy, and `PixelLiquidBg` right panel.
5. Add the authenticated app shell and sidebar.
6. Add organization creation with unique slug.
7. Add onboarding redirect logic and org setup gate.
8. Build the `Agent` page as the first unlocked destination.
9. Add scaffold pages for Integrations, Skills, Scheduled Tasks, and Settings.
10. Add a `Tools` area for registry-backed runtime surfaces that are not vendor connection flows.
11. Wire onboarding state to real Slack and provisioning readiness.

## Status checklist

- [x] define slug-based org route map
- [x] define one-Otto-per-org product framing
- [x] define sidebar shell and fixed status rail
- [x] define the public auth entry and WorkOS signup handoff
- [x] define onboarding gate and create-organization flow
- [x] define settings split between user and organization
- [x] define a dedicated Slack integration state page
- [ ] define and implement a dedicated WhatsApp integration state page
- [x] implement a dedicated settings shell with sectioned navigation
- [x] extend workspace settings with a WorkOS-backed members view and member-management flow
- [x] implement route-backed Agent status and instruction views
- [x] implement a `Tools` section in the authenticated app shell
- [x] implement a platform-admin-only `/platform` shell and organizations table
- [ ] implement prefixed database IDs such as `org_*` and `user_*`
- [ ] replace the temporary generic WorkOS account link with a verified account-management handoff if WorkOS exposes one for this setup

## Acceptance criteria

- unauthenticated users see a dedicated login page with direct WorkOS sign-in / sign-up entry points
- public auth pages share one coherent Otto-branded split layout rather than generic centered cards
- the left panel presents Otto avatar, short copy, and only the required auth actions
- the right panel uses the requested pixelated liquid background treatment on desktop without blocking core auth actions on smaller screens
- authenticated users with no organization are forced into organization creation
- organization creation requires a unique slug
- authenticated users with incomplete org setup are routed into onboarding
- authenticated users with complete org setup land in `/{orgSlug}/agent/status`
- the sidebar contains the requested top org dropdown and bottom user dropdown
- the primary nav contains:
  - Agent
  - Integrations
  - Tools
  - Skills
  - Scheduled Tasks
- users flagged as platform admins can reach a dedicated `/platform/organizations` operations view from the workspace sidebar
- `/platform/organizations` renders a reusable TanStack-based data table listing org slug, Slack state, tenant/server status, configured runtime image, latest sync state, and operator actions
- settings uses its own sidebar with route-backed user and workspace sections
- the Agent area exposes route-backed status and instruction views
- `/{orgSlug}/integrations/slack` shows real Slack integration state rather than a placeholder
- `/{orgSlug}/tools` lists runtime capability surfaces that are not shown as integrations
- a read-only Brave Web Search detail page is reachable from the Tools section
- the Slack page can render real member and channel tables from synced Slack directory data when available
- settings includes both user and organization sections
- prototype UI uses shadcn building blocks without custom color work

## Open questions

- How aggressively should the backend `tenant` language be hidden from the first UI pass versus only translated in page copy?
- Should the Slack integration detail page also expose low-level diagnostic fields, or stay strictly product-level in the first pass?
- When the prefixed ID migration happens, should it convert primary keys directly or introduce separate stable public IDs first?
