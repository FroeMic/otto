# TODO 20: Unified Frontend And Hono Migration

## Goal

Replace the current split `www/` marketing site and `web/` Next.js control-plane UI with a unified browser-facing frontend plus extracted backend services, while allowing the existing product to keep shipping throughout the migration.

## Scope

- define the target runtime architecture for:
  - unified frontend
  - API service
  - integration gateway
  - worker
- define the target repo layout for new apps and shared packages
- define the production routing model for one primary Otto origin
- sequence the migration so existing `www/` and `web/` can continue to evolve during the transition
- define state tracking for migration phases, cutover readiness, and retirement of legacy services

## Dependencies

- `TODO_01_repo_foundation.md`
- `TODO_06_integrations_and_oauth.md`
- `TODO_07_operations_and_observability.md`
- `TODO_09_ui_app_shell_and_onboarding_rebuild.md`
- `TODO_11_runtime_release_rollout.md`
- `TODO_17_managed_integrations_architecture.md`
- `TODO_19_oauth_connected_accounts_substrate.md`

## Why this migration exists

- current browser-facing surfaces are split across `www/` and `web/`
- `web/` mixes:
  - page rendering
  - API routes
  - auth callbacks
  - webhooks
  - internal runtime endpoints
  - shared domain logic
- the production stack already runs separate service boundaries for:
  - `www`
  - `web`
  - `integration-gateway`
  - `worker`
  - `caddy`
- the desired future product shape is one Otto frontend where:
  - the landing page and workspace live together
  - SSR marketing pages and SPA workspace routes can coexist
  - backend services are intentionally separated from UI rendering

## Target architecture

### Runtime services

- `frontend`
  - serves the primary Otto origin
  - renders landing and marketing pages on the server
  - serves or mounts the workspace SPA shell
  - owns browser assets and browser-facing route composition
- `api`
  - owns auth callbacks, session handling, JSON APIs, webhooks, and internal runtime endpoints
  - acts as the backend-for-frontend for the workspace SPA
- `gateway`
  - owns managed integration execution and other runtime-execute paths that benefit from an isolated service boundary
- `worker`
  - remains a long-running background process
  - claims queued jobs, performs retries, and executes orchestration work
  - may expose a tiny health or metrics HTTP surface, but must not be redesigned around request-response job execution
- `caddy`
  - remains the stable front door and cutover point during migration
- `postgres`
  - remains the durable state store for app, worker, and migration state

### Framework direction

- frontend:
  - Hono-hosted frontend with server-rendered landing pages plus a Vite-built React workspace SPA
  - Bun should be the default package manager and local task runner for the new frontend work
- API:
  - Hono on Node.js first, while keeping Bun as the preferred package manager and local script runner
- gateway:
  - Hono on Node.js or Bun, depending on package compatibility and operational results
- worker:
  - plain Node.js or Bun process using shared packages
- deployment:
  - containerized services behind Caddy
  - no Cloudflare-specific runtime dependency in the application architecture

### Product framework choices

- main workspace app:
  - React
  - Vite
  - TanStack Router
  - shadcn UI
  - SPA architecture
- landing page:
  - React
  - Vite-built frontend assets
  - server-rendered through the frontend service where practical
  - initial landing page can remain intentionally lightweight or placeholder while the main app shell matures
- backend services:
  - Hono
  - Zod for validation and typed contracts
  - Hono RPC for typed client/server integration where it meaningfully reduces drift

### Router decision

- prefer TanStack Router for the workspace SPA
- do not use TanStack Start as the default foundation for this migration
- React Router remains an acceptable fallback, but is not the preferred path for the Otto rebuild

Reasoning:

- Otto has heavy route-driven state:
  - tabs
  - filters
  - sorting
  - pagination
  - nested detail views
  - organization-scoped navigation
- TanStack Router is the better fit for:
  - strongly typed search params
  - typed navigation
  - nested layout routes
  - loader and prefetch coordination
  - clean integration with query-cache-driven data loading
- TanStack Start is intentionally not the default because this migration already plans a separate Hono backend and service boundaries
- React Router Data Mode is the closest acceptable fallback if TanStack Router proves mismatched during implementation

### Typing and type-safety requirements

- everything in the new stack should be typed intentionally and end to end
- avoid `any` and loosely typed request or response boundaries unless there is a documented migration exception
- request and response contracts should be modeled once and reused across:
  - Hono handlers
  - Hono RPC clients
  - frontend data hooks
  - tests
- Zod should be the primary validation and parsing layer at service boundaries
- type safety is a product requirement, not just a cleanup task for later

### Testing direction

- use Vitest for frontend and shared TypeScript package tests
- use Hono's testing support for API and gateway route testing
- keep tests close to the code they protect
- bias toward fast, local, deterministic tests that can run repeatedly during slice-by-slice migration

### Quality gates

The new stack should keep four routine gates that are run regularly during implementation:

- format
- lint
- test
- build

Implementation rule:

- run these gates incrementally as slices land, not only at the end of a large migration batch
- every migration phase should document the expected commands for those four gates
- the final app/package layout should make those four checks easy to run at:
  - repo level
  - app level
  - affected-package level

### Tooling direction

- Bun is the preferred package manager for the new `apps/` and `packages/` workspace
- use `bun`, `bunx --bun`, and Bun workspace tooling by default for:
  - install
  - local dev
  - build
  - test
- Node.js remains acceptable as the runtime target for Hono services when package compatibility is stronger there
- do not treat Bun runtime adoption and Bun package-manager adoption as the same decision:
  - package management should default to Bun
  - runtime selection can remain service-specific until compatibility is proven

### Frontend bootstrap requirement

The initial workspace SPA bootstrap should use the exact command below unless later constraints force a documented exception:

```bash
bunx --bun shadcn@latest init --preset b3lnoLp2Z --base base --template vite
```

This requirement exists to:

- start from the desired shadcn/Vite composition baseline
- keep the new workspace UI aligned with the design-system direction already used in the repo
- avoid ad hoc Vite SPA bootstraps that drift from the intended component foundation

### Frontend app-shell requirement

The first serious frontend milestone should be a strong app shell rather than a collection of disconnected screens.

The app shell should prioritize:

- persistent navigation
- stable layout regions
- low-jitter route transitions
- partial data refresh instead of full-page reloading patterns
- clear ownership of server state versus local UI state

The goal is to avoid a workspace that constantly blocks, reloads, or remounts large parts of the UI for ordinary actions.

### Frontend state-management direction

Recommended baseline:

- TanStack Router for route-driven data ownership
- route loaders or equivalent route-scoped data boundaries for navigation-critical data
- a dedicated server-state cache layer for asynchronous data and mutation flows
- local component state for ephemeral UI only
- optimistic or transition-aware mutation patterns where appropriate

Recommended concept split:

- route and URL state:
  - TanStack Router
- server state:
  - query-style cache and invalidation layer
- local transient UI state:
  - component state or narrowly scoped context providers
- cross-shell client state:
  - minimal shared providers with explicit interfaces

Anti-goals:

- one giant global client store as the default answer
- full-page blocking spinners for ordinary mutations
- broad shell remounts on every navigation
- duplicating server data into multiple client stores without a clear ownership model

Open implementation question to resolve in Phase 4:

- whether the server-state layer should be TanStack Query or a narrower RPC-aware cache approach built on top of TanStack Router and Hono RPC

### Otto-specific frontend split

Use three persistent browser-facing shells:

- public shell for landing and auth-entry routes
- workspace shell for `/{orgSlug}/...`
- platform shell for `/platform/...`

The workspace and platform shells should stay mounted during ordinary navigation and own only thin shell data such as:

- viewer identity
- organization switcher data
- current organization summary
- compact readiness or status rail state
- platform-admin capability flags where needed

Page routes should own their own data and mutations. In practice:

- shell queries stay small and stable
- route data is fetched per page or per nested route
- settings remains a nested shell inside the workspace shell instead of forcing a full app remount

Recommended state ownership:

- TanStack Router:
  - route params
  - search params
  - redirects
  - route-level preloading
- server-state cache layer:
  - lists
  - details
  - polling views
  - invalidation and optimistic updates
- local component state:
  - ephemeral UI state
  - open panels
  - draft inputs
- narrow shared providers only for true cross-shell client concerns

Anti-goals:

- a giant global store for server data
- shell remounts on normal navigation
- full-page blocking spinners for ordinary mutations
- broad invalidation that reloads unrelated surfaces after every save

### Style-token migration requirement

When the new frontend is created:

- transfer the relevant style variables from the current browser-facing apps into the new frontend
- preserve the Otto visual identity instead of accepting the raw scaffold defaults
- explicitly port the color variables and other shared theme tokens from the legacy app styles before broader UI migration starts

The transfer should at minimum audit and intentionally carry over:

- semantic color variables
- background and foreground tokens
- border, input, ring, and muted tokens
- chart or accent tokens if they are part of the established Otto surface language
- typography-related CSS variables where they materially affect the brand feel

Implementation note:

- do not blindly merge all legacy CSS
- audit `web/` and `www/` style roots, decide which token set is authoritative, and port the final chosen variables into the new frontend's theme layer
- document the chosen source of truth during Phase 4 once the frontend foundation starts

## Target routing model

### Public routing

- `/`
- `/pricing`
- `/about`
- `/docs/...`
- `/login`

These routes go to `frontend`.

### Reserved workspace slug namespaces

Workspace slugs must not collide with top-level public or system routes once the landing page and workspace share one primary origin.

The reserved-slug source of truth should live in a shared package and be enforced at:

- workspace onboarding creation
- workspace slug updates
- automatic slug generation from external organization names

Reference list:

- [Reserved workspace slugs](./RESERVED_WORKSPACE_SLUGS.md)

### Workspace routing

- `/{orgSlug}/...`
- `/platform/...`

These routes are browser-facing and go to `frontend`, which serves SSR or SPA entrypoints as appropriate.

Routing rule:

- reserved public and system paths stay server-owned
- non-reserved top-level paths should be treated as workspace slug candidates
- if a request does not match a reserved namespace and matches the workspace slug rules, `frontend` should return the workspace shell
- `/app/...` is acceptable only as a temporary migration prefix if it is intentionally reintroduced later

### Backend routing

- `/api/v1/*`
- `/api/internal/*`
- `/auth/*`
- `/oauth/*`
- `/webhooks/*`

These routes live on the same primary Otto origin and go to `api`, except for
execution paths intentionally held in `gateway`.

Route contract:

- `/api/v1/*` is the future public product API surface:
  - versioned
  - stable
  - suitable for external developer use once exposed
- `/api/internal/*` is Otto-internal:
  - workspace app backend-for-frontend routes
  - tenant runtime control surfaces
  - migration-period compatibility routes
  - other internal product and operator flows that should not be presented as a
    public developer contract

### Gateway routing

- `/api/internal/runtime/integrations/execute*`

This route continues to go to `gateway` unless later evidence shows it should be
merged into `api`.

Gateway URL rule:

- keep gateway behavior on the primary Otto origin
- do not expose a separate public `/gateway/*` namespace
- do not introduce a separate public gateway hostname
- the service boundary is internal; the browser and runtime contract stays under
  `/api/internal/*`

## Target repository layout

The long-term target layout should be:

- `apps/frontend`
- `apps/api`
- `apps/gateway`
- `apps/worker`
- `packages/db`
- `packages/auth`
- `packages/features/<feature-name>`
- `infra/caddy`
- `runtime-image`
- `runtime-plugins`

### Layout rules

- new shared business logic must not be added only inside legacy `web/` or `www/` once replacement work begins
- major product areas should be extracted feature-first rather than layer-first
- product-specific logic should prefer `packages/features/<feature-name>` instead of a generic `packages/domain` dump
- feature packages should keep related contracts, service logic, worker logic, query keys, and view models close together
- app-local code in `apps/api`, `apps/worker`, and `apps/frontend` should stay thin and mostly wire feature packages into HTTP routes, worker entrypoints, and UI routes
- only truly cross-cutting concerns should live outside feature packages, for example:
  - `packages/db`
  - `packages/auth`
- Drizzle schema and DB helpers should move toward `packages/db`
- legacy `web/` and `www/` should remain self-contained during the transition
- shared packages are for extracted apps and future cutover targets, not as a runtime dependency of the legacy `web/` production image
- `web/` and `www/` remain present until their replacements are proven and cut over

### Feature co-location rule

To avoid scattering product-specific behavior across the repo, important Otto domains should have one obvious home.

Example shape:

- `packages/features/scheduled-tasks`
- `packages/features/sessions`
- `packages/features/integrations`
- `packages/features/billing`

For each feature package, keep together as much of the domain-specific code as practical:

- Zod schemas and typed contracts
- server-side service functions
- worker-executed operations
- shared selectors, query keys, and view models
- domain tests

Then keep app integration layers thin:

- `apps/api/src/features/<feature-name>` for Hono route wiring only
- `apps/worker/src/features/<feature-name>` for job wiring only
- `apps/frontend/src/features/<feature-name>` for route components, feature hooks, and feature-local UI state

Anti-goal:

- spreading one domain such as `scheduled-tasks` across unrelated generic folders with no clear home

## Migration principles

- use a strangler migration:
  - keep the current stack running
  - replace one service boundary at a time
  - cut traffic over at Caddy
- keep shipping product work during migration
- do not require a feature freeze
- avoid dual-implementing the same feature in both old and new stacks unless there is a clear cutover plan
- prefer vertical slice migration over technology-only rewrites once the new API and frontend are established
- keep rollback simple:
  - one service
  - one route boundary
  - one image tag

## Development policy during migration

Once this migration starts in earnest:

- bug fixes may still land in `web/` and `www/` as needed
- new shared backend logic should land in shared packages first
- if legacy `web/` still needs that logic before cutover, copy the compatibility wrapper locally instead of wiring the legacy app to shared packages
- new API endpoints should prefer `apps/api` unless there is a strong short-term blocker
- new browser-facing product surfaces should prefer `apps/frontend` once it exists
- avoid expanding legacy Next.js-only abstractions if the same work is part of a near-term extraction phase

## Phase plan

### Phase 0: Packaging and shared-package foundation

Create the scaffolding needed to let old and new services coexist.

Deliverables:

- workspace-level package manager and workspace config if needed
- `apps/` and `packages/` directories
- initial shared package extraction:
  - env
  - DB client access
  - core schemas
  - selected domain services
- separate container/image definitions for future services
- Bun workspace decisions documented for the new app/package layout
- initial format, lint, test, and build command plan for the new workspace

Exit criteria:

- legacy apps still boot
- at least one shared package is used by an extracted app
- image boundaries no longer assume one monolithic `web` build forever
- the new workspace layout has a clear Bun-first package-manager direction
- the repo has an explicit decision for how the four quality gates will run during migration

### Phase 1: Gateway extraction

Replace the current custom gateway HTTP wrapper with a dedicated Hono service.

Deliverables:

- `apps/gateway`
- health endpoint
- runtime-authenticated execute route parity
- unchanged Caddy execute-path routing semantics

Exit criteria:

- production execute traffic can run against the new gateway image
- response shapes and auth behavior remain compatible
- rollback is one Caddy target or one image tag

Cutover plan:

1. Keep the external route unchanged at
   `/api/internal/runtime/integrations/execute*`.
2. Keep traffic on the primary Otto origin instead of introducing
   `/gateway/*`.
3. Run `apps/gateway` in production compose behind the existing
   `integration-gateway` service boundary.
4. Switch the `integration-gateway` container implementation from the legacy
   `web/` entrypoint to the `apps/gateway` image while preserving the same
   internal service name and Caddy route.
5. Verify:
   - `POST /api/internal/runtime/integrations/execute` still succeeds through
     Caddy
   - gateway health remains green
   - runtime auth and error payloads remain compatible
   - rollback is a one-service revert to the previous image/command

### Phase 2: Worker extraction

Move the worker into its own app/package boundary without changing the queue model.

Deliverables:

- `apps/worker`
- shared queue/domain imports from packages
- health and lifecycle visibility if needed

Exit criteria:

- worker runs independently of the legacy `web` app image
- no normal job execution path depends on inbound HTTP requests
- stale-job reclaim and lane behavior remain intact
- one wedged job can only consume one worker slot, not stall an entire lane
- apply-configuration jobs use an intentionally shorter stale-reclaim window than the global worker default so tenant updates unblock quickly

### Phase 3: API extraction

Stand up `apps/api` while the legacy `web` app still renders pages.

Deliverables:

- auth routes
- OAuth callbacks
- webhook routes
- workspace JSON APIs
- platform/operator JSON APIs
- internal runtime routes
- Zod-backed validation at request boundaries
- typed RPC-oriented contract design where it reduces duplication

Migration rule:

- route families should move as coherent groups, not as scattered one-off endpoints

Exit criteria:

- the majority of request-response business logic is no longer trapped in Next route handlers
- `web/` can call or proxy the new API during transition if needed
- API auth and cookie/session handling are production-ready
- the extracted API has a typed contract story instead of stringly typed ad hoc handlers

### Phase 4: Unified frontend foundation

Introduce the new browser-facing frontend under one primary origin.

Deliverables:

- `apps/frontend`
- server-rendered landing pages
- login handoff
- SPA shell integration
- SPA initialized from the required Bun + shadcn bootstrap command
- theme variables ported intentionally from the legacy browser-facing apps
- asset pipeline and browser analytics wiring
- initial app-shell state-management architecture documented and implemented

Cutover approach:

- move landing routes first
- keep workspace routes on legacy `web/` until the SPA is ready

Exit criteria:

- primary landing routes are served from `frontend`
- old `www/` becomes legacy-only or can be retired
- same-origin routing works with the new API service
- app-shell navigation does not rely on broad blocking reload behavior

### Phase 5: Workspace SPA beta

Run the new workspace UI in parallel before full replacement.

Deliverables:

- initial workspace shell in the new frontend
- API-backed auth/session checks
- one non-trivial workspace slice migrated end to end
- frontend tests run under Vitest
- API and gateway route tests use Hono testing utilities where applicable

Temporary routing options:

- `/beta/*`
- alternate internal hostname only if operationally simpler

Constraint:

- do not make `/app/*` the default apex-domain workspace root; the intended public shape is reserved-path handling plus `/{workspaceSlug}/...`

Exit criteria:

- one real workspace slice is usable by internal operators
- the SPA consumes the extracted API instead of legacy page-bound route logic

## Detailed execution plan for next steps

### Track A: Extract shared packages out of `web/`

Goal:

- move reusable logic out of legacy route files into extracted app boundaries and feature packages
- keep adapter route behavior unchanged while logic moves underneath
- keep the legacy `web/` image self-contained so it can still build and run without repo-root shared-package wiring

Package shape:

- `packages/db`
  - shared DB client access
  - Drizzle schema ownership over time
  - low-level persistence helpers only
- `packages/auth`
  - runtime auth
  - session helpers
  - cookie and auth utility functions shared by `apps/api` and `apps/frontend`
- `packages/features/<feature-name>`
  - feature-specific Zod contracts
  - feature service logic
  - feature worker operations
  - feature query keys, selectors, and view models

Extraction order:

1. runtime auth and common response helpers
2. env and config accessors that are safe to share
3. DB access and service functions used by internal runtime and webhook routes
4. auth and session helpers
5. Zod request and response schemas
6. route-family logic, after the lower layers are already shared

Working rule:

- first move pure logic and service functions
- only later replace route wrappers
- extracted apps should consume shared packages directly
- old `web/` route files may copy compatibility logic locally during transition, but should not import repo-level shared packages

Recommended first feature packages:

1. `packages/features/runtime-core`
2. `packages/features/webhooks`
3. `packages/features/sessions`
4. `packages/features/scheduled-tasks`
5. `packages/features/integrations`
6. `packages/features/workspace-settings`

Verification for each extraction slice:

- package-local `format`, `lint`, `test`, and `build`
- rerun affected app gates after the shared code move
- keep adapter route behavior unchanged
- prefer parity tests against current responses for critical routes

Definition of done for Track A:

- at least one shared package is imported by an extracted app
- internal runtime and webhook logic no longer live only inside route files
- legacy route files are either thinner or clearly marked as local compatibility copies

### Track B: Replace adapter-mounted API logic family by family

Goal:

- turn `apps/api` from a route-surface mirror into the real owner of request-response behavior

Route-family order:

1. internal runtime routes
2. webhooks
3. auth
4. OAuth
5. user/profile
6. runtime-config
7. workspace APIs
8. platform APIs

For each route family:

1. move shared logic into `packages/auth` or `packages/features/<feature-name>`
2. add or refine Zod request and response contracts
3. implement native Hono handlers in `apps/api`
4. keep request and response shapes identical to the legacy route family
5. remove that family's adapter dependency only after tests pass

Testing and verification per family:

- route tests in `apps/api`
- schema and contract tests close to the feature package
- parity checks against legacy responses where practical
- app gates before commit:
  - `format`
  - `lint`
  - `test`
  - `build`

Cutover rule:

- do not cut traffic for a family until native Hono handlers exist and adapter fallback is no longer needed for that family

Definition of done for Track B:

- `apps/api` owns native behavior for the family
- legacy route files for that family only remain as temporary wrappers or can be left idle pending deletion
- the family can be routed to `apps/api` without relying on legacy `web/` route code at request time

### Track C: Build the real workspace SPA against `apps/api`

Goal:

- make `apps/frontend` the real browser-facing app shell before cutting over any meaningful workspace traffic

Foundation work:

1. persistent workspace shell
2. persistent platform shell
3. TanStack Router route tree
4. TanStack Query cache layer
5. Hono RPC plus Zod contract integration
6. auth and session bootstrap against `apps/api`

Initial UI migration order:

1. auth and session bootstrap
2. workspace shell plus navigation
3. one read-heavy slice such as usage or sessions
4. one write-heavy slice such as settings or members
5. integrations and tools after the shell and mutation patterns are proven

State-management rules for this track:

- shell data stays thin and stable
- route data is owned per feature and per nested route
- TanStack Query owns server state
- URL state stays in TanStack Router
- avoid giant global stores for server-backed data

Verification for each SPA slice:

- `apps/frontend` package gates
- contract compatibility checks against `apps/api`
- manual navigation checks for non-remounting shells
- mutation checks to confirm background refresh and partial loading behavior

Definition of done for Track C:

- the new SPA can authenticate against `apps/api`
- the shell remains mounted across ordinary navigation
- at least one read-heavy and one write-heavy slice run end to end against the new API

### Merge readiness for first container replacement

The branch should be considered ready to merge for first-container replacement preparation once all of the following are true:

- `apps/frontend`, `apps/api`, `apps/gateway`, and `apps/worker` all pass package gates
- at least one shared feature package is used by both legacy `web/` and a new app
- `apps/api` owns native behavior for the first cutover route family
- `apps/frontend` has a real auth-aware shell instead of only a placeholder workspace entry
- infra wiring can boot the new containers in parallel without deleting legacy services
- the first container replacement target and rollback path are documented in `spec/STATUS.md`

### Phase 6: Vertical slice cutovers

Replace legacy workspace surfaces one slice at a time.

Recommended slice order:

1. agent
2. integrations
3. tools and skills
4. scheduled tasks
5. settings
6. platform administration

Rules:

- migrate UI, API, auth checks, and operational behaviors together
- each slice must have an explicit rollback story
- avoid partial ownership of one route tree across two UI stacks longer than necessary

Exit criteria:

- all primary workspace surfaces route through the new frontend
- remaining legacy `web/` code is transitional only

### Phase 7: Legacy retirement

Remove obsolete services and docs once traffic is fully cut over.

Deliverables:

- retire `www/`
- retire `web/`
- remove old Dockerfile and Compose assumptions that no longer apply
- update deployment docs and specs to the new steady-state architecture

Exit criteria:

- production traffic no longer depends on legacy `www/` or `web/`
- deployment and operator docs reference only the new services

## State tracking

### Overall migration state

- current state: Phase 0 foundation active, Phase 1 gateway extraction started, Phase 2 worker extraction started, Phase 3 API extraction started
- current parallel-port progress:
  - `apps/frontend` exists for legacy `www`
  - `apps/gateway` exists for legacy `integration-gateway`
  - `apps/worker` exists for the legacy `web/` worker entrypoint
  - `apps/api` now mirrors the current route-handler surface from `web/` through adapter-mounted route families
  - `packages/auth`, `packages/features/runtime-core`, and `packages/features/workspace-core` now exist for the extracted services
  - legacy `web/` keeps local compatibility copies for runtime auth, managed runtime routes, workspace bootstrap, workspace usage, workspace settings, and workspace slug normalization
  - `apps/api` now owns the current shell bootstrap, workspace usage, and workspace settings routes natively
  - the compatibility proxy in `apps/api` is narrowed to remaining legacy user-profile routes
  - `apps/frontend` now has a real routed shell with workspace `usage` and workspace `settings` slices plus a same-origin `/login` entry page
- current browser-facing production split in repo config:
  - apex domain on `frontend`
  - apex `/auth/*` on `api`
  - apex `/oauth/*` on `api`
  - apex `/api/*` on `api`
  - apex `/api/internal/runtime/integrations/execute*` on `gateway`
  - legacy app subdomain on `web`
- target apex routing behavior for workspace paths:
  - reserved public and system paths remain explicitly routed
  - `/auth/*`, `/oauth/*`, and `/api/*` should be treated as edge-routed reserved namespaces
  - non-reserved top-level paths should fall through to the workspace shell as `/{workspaceSlug}` candidates
- target browser-facing production split:
  - unified `frontend` on one primary origin
  - extracted `api`
  - extracted `gateway`
  - extracted `worker`
- current recommended next implementation step:
  - deploy and verify the apex-domain parallel launch:
    - `LANDING_PAGE_DOMAIN` on `frontend`
    - `LANDING_PAGE_DOMAIN/api/*` on `apps/api`
    - `LANDING_PAGE_DOMAIN/api/internal/runtime/integrations/execute*` on `apps/gateway`
    - `CONTROL_PLANE_DOMAIN` on legacy `web`

### Immediate execution order

The first implementation passes should happen in this order:

1. Bun workspace and repo-level gate scaffolding
2. `apps/frontend` as the first fully ported app
3. legacy `www` route and style port into `apps/frontend`
4. then `apps/gateway`
5. then `apps/worker`
6. then `apps/api`
7. only then begin workspace SPA slice cutovers from `web/`

### First port target

The first complete port target is the current `www/` app.

Definition of done for that target:

- legacy `www` routes are implemented in `apps/frontend`
- the new frontend runs through Hono
- landing routes are server-rendered there
- the new frontend package has working `format`, `lint`, `test`, and `build` gates
- `www/` remains in the repo unchanged as the legacy fallback until a later retirement phase

Current checkpoint:

- complete in parallel implementation for:
  - `apps/frontend`
  - `apps/gateway`
  - `apps/worker`
- partial in parallel implementation for:
  - legacy business logic still residing under `web/src/app/**/route.ts` while `apps/api` delegates to it
  - `apps/api` consumes the extracted shared packages while legacy `web/` keeps local compatibility copies
  - other authenticated workspace and platform families still adapter-mounted or proxied until their feature packages are extracted
- cutover still pending
- the legacy `www/` app remains present and untouched as the frontend fallback
- the legacy `integration-gateway` service remains present and untouched as the gateway fallback
- the legacy `web/` worker entrypoint remains present and untouched as the worker fallback
- the legacy `web/` route handlers remain present and untouched as the API fallback
- next implementation target is expanding `apps/api` route coverage

### Phase checklist

- [x] Phase 0 started
- [ ] Phase 0 complete
- [x] Phase 1 started
- [ ] Phase 1 complete
- [x] Phase 2 started
- [ ] Phase 2 complete
- [x] Phase 3 started
- [ ] Phase 3 complete
- [x] Phase 4 started
- [ ] Phase 4 complete
- [ ] Phase 5 started
- [ ] Phase 5 complete
- [ ] Phase 6 started
- [ ] Phase 6 complete
- [ ] Phase 7 started
- [ ] Phase 7 complete

### Service cutover tracker

- `www`:
  - current owner: legacy marketing app
  - target owner: `frontend`
  - status: production landing cutover complete; legacy `www` remains in-repo only and is no longer part of the production compose stack
- `web` page rendering:
  - current owner: legacy Next.js app
  - target owner: `frontend`
  - status: in progress, with the new SPA shell and first usage/settings slices now present under `apps/frontend`
- `web` route handlers:
  - current owner: legacy Next.js app
  - target owner: `api`
  - status: parallel port complete, with apex-domain `/api/*` routing now wired in compose and Caddy; deployment verification pending
- `internal runtime managed-config and managed-skills`:
  - current owner: shared runtime-core package plus thin route wrappers
  - target owner: `apps/api`
  - status: native Hono ownership started, shared logic extracted
- `frontend bootstrap and workspace read/write slices`:
  - current owner: `apps/frontend` via `apps/api`
  - target owner: `frontend` plus `api`
  - status: first real shell implemented, now backed by native `apps/api` routes for bootstrap, usage, and settings
- `webhooks`:
  - current owner: legacy Next.js app
  - target owner: `apps/api`
  - status: parallel port complete for Stripe and WorkOS, cutover pending
- `auth` and `oauth` routes:
  - current owner: legacy Next.js app
  - target owner: `apps/api`
  - status: parallel port complete, with same-origin forwarding from `apps/frontend` now in place for login, logout, and OAuth callbacks
- `integration-gateway`:
  - current owner: legacy gateway service
  - target owner: `apps/gateway`
  - status: production compose cutover wired, with apex-domain execute routing now wired in Caddy; deployment verification pending
- `worker`:
  - current owner: legacy worker entrypoint under `web/`
  - target owner: `apps/worker`
  - status: production compose cutover wired, deployment verification pending

### Session update rules

Whenever migration work advances:

- update this spec's phase checklist
- update the service cutover tracker statuses
- update `spec/STATUS.md` with:
  - active phase
  - the branch or workstream in progress
  - the next recommended migration step
- update or retire `www/spec/` assumptions once the frontend replacement becomes active work

## Acceptance criteria

- the repo has one explicit migration plan for moving from:
  - separate `www/` and `web/`
  - to unified `frontend` plus extracted services
- the plan allows ongoing product development during migration
- service replacement order is explicit and low risk
- the target repo layout is explicit
- state tracking exists for both phase progress and service cutover progress
- the plan preserves independence from Cloudflare-specific runtime requirements
- the plan explicitly locks in:
  - React + Vite + TanStack Router + shadcn for the workspace frontend
  - Hono + Zod + Hono RPC for backend contracts
  - Vitest and Hono testing for the new test strategy
  - regular format, lint, test, and build gates during implementation
  - protected top-level public and system namespaces so workspace slugs cannot collide with landing or API routes

## Open questions

- Should `frontend` serve built SPA assets directly, or should Caddy serve static SPA assets and only forward SSR routes to `frontend`?
- Should `apps/api` and `apps/frontend` share session cookie issuance, or should `frontend` only proxy auth/session bootstrap to `api`?
- Should `platform` routes live inside the same SPA shell from the start, or remain temporarily on legacy `web/` until later slice cutover?
- Should Drizzle migrations move into `packages/db` immediately in Phase 0, or only after API and worker extraction are stable?
- Is Bun compatible enough with the required SSH, Stripe, and auth stack to standardize the new backend services on Bun, or should Node.js remain the default runtime for `frontend`, `api`, and `worker` first?
