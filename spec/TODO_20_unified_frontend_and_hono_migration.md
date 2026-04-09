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

### Workspace routing

- `/{orgSlug}/...`
- `/platform/...`
- `/app/...` only if a temporary SPA beta prefix is needed during migration

These routes are browser-facing and go to `frontend`, which serves SSR or SPA entrypoints as appropriate.

### Backend routing

- `/api/*`
- `/auth/*`
- `/oauth/*`
- `/webhooks/*`
- `/api/internal/runtime/*`

These routes go to `api`, except for execution paths intentionally held in `gateway`.

### Gateway routing

- `/api/internal/runtime/integrations/execute*`

This route continues to go to `gateway` unless later evidence shows it should be merged into `api`.

## Target repository layout

The long-term target layout should be:

- `apps/frontend`
- `apps/api`
- `apps/gateway`
- `apps/worker`
- `packages/db`
- `packages/domain`
- `packages/contracts`
- `packages/auth`
- `infra/caddy`
- `runtime-image`
- `runtime-plugins`

### Layout rules

- new shared business logic must not be added only inside legacy `web/` or `www/` once replacement work begins
- new backend logic should prefer `packages/domain` and `packages/contracts`
- Drizzle schema and DB helpers should move toward `packages/db`
- legacy apps can import shared packages during the transition
- `web/` and `www/` remain present until their replacements are proven and cut over

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
- at least one shared package is imported by both legacy and new code
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

- `/app/*`
- `/beta/*`
- alternate internal hostname only if operationally simpler

Exit criteria:

- one real workspace slice is usable by internal operators
- the SPA consumes the extracted API instead of legacy page-bound route logic

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
  - `apps/api` exists for the first extracted internal runtime and webhook route families
- current browser-facing production split:
  - landing on `www`
  - workspace on `web`
- target browser-facing production split:
  - unified `frontend` on one primary origin
  - extracted `api`
  - extracted `gateway`
  - extracted `worker`
- current recommended next implementation step:
  - expand `apps/api` beyond internal runtime and webhooks into auth, OAuth, workspace, and platform route families without deleting the legacy handlers

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
  - `apps/api` internal runtime routes
  - `apps/api` webhook routes
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
- [ ] Phase 4 started
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
  - status: parallel port complete, cutover pending
- `web` page rendering:
  - current owner: legacy Next.js app
  - target owner: `frontend`
  - status: not started
- `web` route handlers:
  - current owner: legacy Next.js app
  - target owner: `api`
  - status: in progress, with internal runtime route families now mounted in `apps/api`
- `webhooks`:
  - current owner: legacy Next.js app
  - target owner: `apps/api`
  - status: parallel port complete for Stripe and WorkOS, cutover pending
- `auth` and `oauth` routes:
  - current owner: legacy Next.js app
  - target owner: `apps/api`
  - status: not started
- `integration-gateway`:
  - current owner: legacy gateway service
  - target owner: `apps/gateway`
  - status: parallel port complete, cutover pending
- `worker`:
  - current owner: legacy worker entrypoint under `web/`
  - target owner: `apps/worker`
  - status: parallel port complete, cutover pending

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

## Open questions

- Should `frontend` serve built SPA assets directly, or should Caddy serve static SPA assets and only forward SSR routes to `frontend`?
- Should `apps/api` and `apps/frontend` share session cookie issuance, or should `frontend` only proxy auth/session bootstrap to `api`?
- Should `platform` routes live inside the same SPA shell from the start, or remain temporarily on legacy `web/` until later slice cutover?
- Should Drizzle migrations move into `packages/db` immediately in Phase 0, or only after API and worker extraction are stable?
- Is Bun compatible enough with the required SSH, Stripe, and auth stack to standardize the new backend services on Bun, or should Node.js remain the default runtime for `frontend`, `api`, and `worker` first?
