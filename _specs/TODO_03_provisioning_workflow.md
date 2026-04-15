# TODO 03: Provisioning Workflow

## Goal

Provision one dedicated Hetzner VPS per tenant through resumable background jobs.

## Scope

- implement Hetzner wrapper
- create cloud-init template
- create provisioning workflow
- persist server metadata and transitions
- define how alternate provisioning strategies can coexist without mutating the current job path

## Dependencies

- `TODO_00_architecture_and_job_runtime.md`
- `TODO_01_repo_foundation.md`
- `DONE_02_auth_and_tenant_model.md`
- `TODO_34_snapshot_based_tenant_provisioning.md`

## Implementation notes

- Provisioning steps should be explicit and restart-safe:
  - create server
  - poll server action
  - fetch IP
  - wait for SSH
  - mark server reachable
  - enqueue config apply
- Persist each step boundary so retries resume cleanly.
- Keep Hetzner-specific logic behind a small service boundary under `web/src/lib/hetzner`.
- Use native `fetch` in Node.js as the default transport for the Hetzner Cloud API.
- Do not plan around a Hetzner-specific JavaScript SDK in the first pass.
- Split the Hetzner layer into:
  - `client.ts` for authenticated HTTP requests and normalized API errors
  - `servers.ts` for server lifecycle
  - `server-types.ts` for validating selected VPS sizes
  - `images.ts` for validating selected base images
- Library and transport notes:
  - primary choice: built-in `fetch`
  - acceptable lower-level alternative if needed: `undici`
  - official Hetzner docs currently point to CLI, Go, and Python integrations, not an official JS SDK
- The minimum Hetzner wrapper functions for this spec are:
  - `createServer(input)`
  - `getServer(serverId)`
  - `listServers(filters)`
  - `waitForServerAction(serverId, actionId)`
  - `deleteServer(serverId)`
  - `rebootServer(serverId)`
  - `rebuildServer(serverId, input)`
- `createServer(input)` should:
  - call `POST /servers`
  - require `name`, `server_type`, and `image`
  - use `location`, not deprecated `datacenter`
  - pass `ssh_keys`, `user_data`, `labels`, and optional `volumes` without leaking raw REST details to workflow code
  - return a normalized object containing at least `serverId`, `initialActionId`, `status`, `ipv4`, and `name`
- `client.ts` should read its defaults from validated env:
  - `HETZNER_API_TOKEN`
  - optional `HETZNER_API_BASE_URL`
  - `HETZNER_POLL_INTERVAL_MS`
  - `HETZNER_ACTION_TIMEOUT_MS`
- Provisioning defaults should come from validated env or app config, not be hardcoded in workflows:
  - `HETZNER_DEFAULT_LOCATION`
  - `HETZNER_DEFAULT_SERVER_TYPE`
  - `HETZNER_DEFAULT_IMAGE`
- `waitForServerAction(serverId, actionId)` should:
  - poll `GET /servers/{id}/actions/{action_id}`
  - stop on `success` or `error`
  - back off between polls to avoid wasting rate limit
  - surface structured action errors into the job event log
- `getServer(serverId)` should be the canonical source for:
  - current Hetzner status
  - `public_net.ipv4.ip`
  - selected image, location, labels, and protection flags
- The workflow handler should validate the selected server type and image before create:
  - `GET /server_types` or `GET /server_types/{id}`
  - `GET /images` or `GET /images/{id}`
  - reject mismatched architecture or unavailable/deprecated image choices early
- The Hetzner client should normalize at least:
  - HTTP status
  - Hetzner `error.code`
  - Hetzner `error.message`
  - rate-limit headers when present
- Keep raw provider response shapes out of route handlers and job handlers:
  - workflows should consume normalized internal types
  - only `web/src/lib/hetzner/*` should know the exact endpoint payload shapes
- Cloud-init should only prepare the machine:
  - create the `openclaw` user
  - install Docker and Compose
  - install the deploy SSH key
  - create runtime directories
  - optionally write the base `docker-compose.yml`
  - not write tenant secrets or final runtime config
- Recommended provisioning job step states:
  - `queued`
  - `validating_inputs`
  - `creating_server`
  - `waiting_for_server_action`
  - `fetching_server`
  - `waiting_for_ssh`
  - `reachable`
  - `ready`
  - `failed`
- Recommended persisted Hetzner metadata on `tenant_servers`:
  - `provider_server_id`
  - `last_action_id`
  - `name`
  - `ipv4`
  - `ipv6`
  - `location`
  - `server_type`
  - `image`
  - `status`
  - `labels_json`
- Idempotency rules:
  - if `provider_server_id` already exists, resume from `getServer` instead of creating a second VPS
  - if an action is still running, resume polling instead of issuing a new mutating call
  - only enqueue config apply after SSH has been proven reachable
- Snapshot-based provisioning is now a tracked follow-on strategy:
  - the current `provision_tenant_server` path remains the legacy base-image path
  - snapshot provisioning should land as a second job type and strategy, not as an in-place rewrite of the legacy flow
  - shared helpers may be reused, but the old job behavior should remain available as a rollback path

## Exit criteria

- tenant provisioning can run asynchronously
- Hetzner metadata is stored in DB
- worker can recover after interruption
- successful provisioning enqueues apply

## Status checklist

- [x] implement Hetzner API client
- [ ] define normalized Hetzner service interfaces
- [x] define Hetzner env-backed defaults
- [x] implement cloud-init renderer
- [ ] define provisioning workflow states
- [ ] persist server metadata
- [ ] implement action polling with retry/backoff
- [ ] implement image validation
- [ ] enqueue config apply on success

## Open questions

- Do we need server deletion and rebuild flows in the first pass?
- Decision: no, not for v1. Keep the wrapper surface ready for them, but do not block the first provisioning increment on those flows.
- Once snapshot-based provisioning lands, should the legacy base-image path remain the permanent fallback, or should it become operator-only?
