# Hetzner Cloud API Reference For Managed OpenClaw

Last updated: March 13, 2026

This document is a working reference for the Hetzner Cloud API surface that matters for the managed OpenClaw control plane.

It is intentionally scoped to:

- tenant VPS provisioning
- tenant VPS lookup and lifecycle management
- action polling
- image selection and rebuilds
- server type validation
- optional attached volumes
- basic operational hooks

Official sources used:

- [Hetzner Cloud API overview](https://docs.hetzner.cloud/reference/cloud)
- [Servers](https://docs.hetzner.cloud/reference/cloud#tag/servers)
- [Server Actions](https://docs.hetzner.cloud/reference/cloud#tag/server-actions)
- [Server Types](https://docs.hetzner.cloud/reference/cloud#tag/server-types)
- [Images](https://docs.hetzner.cloud/reference/cloud#tag/images)
- [Volumes](https://docs.hetzner.cloud/reference/cloud#tag/volumes)
- [Hetzner changelog](https://docs.hetzner.cloud/changelog)

## Core API conventions

### Base URL and auth

- Base URL: `https://api.hetzner.cloud/v1`
- Auth: `Authorization: Bearer <project_api_token>`
- Format: HTTPS + JSON

### IDs

- Resource IDs are `int64`
- Treat them as opaque strings in app code if that avoids number precision issues
- The spec exposes max values up to JavaScript's safe integer limit in many places

### Async actions

Many write operations are asynchronous and return an `action`.

Relevant action states:

- `running`
- `success`
- `error`

The practical rule for our control plane:

1. call the mutating endpoint
2. extract `action.id`
3. poll the resource action endpoint until `success` or `error`
4. fetch the resource again
5. continue with SSH-level readiness checks if this is a server bootstrap flow

### Pagination and sorting

List endpoints generally support:

- `page`
- `per_page`
- optional `sort`

For provisioning logic, we should mostly avoid broad scans and prefer:

- direct `GET` by ID
- filtered `GET` by exact `name`

### Labels

Hetzner supports labels on the resources we care about. They are useful for:

- tagging tenant ownership
- environment markers
- reconciliation checks

Recommended labels for our use case:

- `otto/tenant_id`
- `otto/org_id`
- `otto/runtime=openclaw`
- `otto/managed=true`

### Rate limits

- Default rate limit is documented as `3600` requests per hour per project
- Do not poll action endpoints aggressively
- Use backoff for action polling and SSH readiness polling

## Important current platform notes

### Prefer `location`, not `datacenter`

Hetzner deprecated `datacenter` in server request/response shapes in favor of `location`.

Important dates from Hetzner's changelog:

- December 16, 2025: Hetzner announced the move toward `location`
- The API spec marks `datacenter` as deprecated and says it will be removed after July 1, 2026

For new code, always send:

- `location`

Do not build new code around:

- `datacenter`

### `user_data` on rebuild is now supported

As of January 16, 2026, Hetzner documents `user_data` on:

- `POST /servers`
- `POST /servers/{id}/actions/rebuild`

This matters because rebuild can now re-bootstrap a tenant box with cloud-init behavior, instead of only changing the base image.

## Resource group: Servers

Docs:

- [List Servers](https://docs.hetzner.cloud/reference/cloud#tag/servers/list_servers)
- [Create a Server](https://docs.hetzner.cloud/reference/cloud#tag/servers/create_server)
- [Get a Server](https://docs.hetzner.cloud/reference/cloud#tag/servers/get_server)
- [Update a Server](https://docs.hetzner.cloud/reference/cloud#tag/servers/update_server)
- [Delete a Server](https://docs.hetzner.cloud/reference/cloud#tag/servers/delete_server)
- [Get Metrics for a Server](https://docs.hetzner.cloud/reference/cloud#tag/servers/get_server_metrics)

### `GET /servers`

Use for:

- filtered discovery
- reconciliation
- name-based lookups

Useful query params:

- `name`
- `label_selector`
- `status[]`
- `sort[]`
- `page`
- `per_page`

Server statuses exposed by the spec:

- `running`
- `initializing`
- `starting`
- `stopping`
- `off`
- `deleting`
- `migrating`
- `rebuilding`
- `unknown`

Control-plane usage:

- occasional recovery path
- safety checks before provisioning duplicate tenant servers
- dashboards or admin tools

Not ideal for:

- primary provisioning flow once we already have `server.id`

### `POST /servers`

This is the main provisioning endpoint.

Required request fields:

- `name`
- `server_type`
- `image`

Key optional request fields relevant to us:

- `location`
- `start_after_create`
- `ssh_keys`
- `user_data`
- `labels`
- `volumes`
- `networks`
- `firewalls`
- `placement_group`
- `automount`
- `public_net`

Important request field behavior:

- `location` must not be used together with deprecated `datacenter`
- `user_data` is limited to `32 KiB`
- `ssh_keys` accepts IDs or names
- `public_net.enable_ipv4` and `public_net.enable_ipv6` can be controlled explicitly
- if `public_net.ipv4` or `public_net.ipv6` is omitted while enabled, Hetzner can allocate new Primary IPs

Important response fields:

- `server`
- `action`
- `next_actions`
- `root_password`

Provisioning implications:

- if no SSH keys are specified, Hetzner can return a `root_password`
- for our managed flow, we should rely on injected SSH keys instead of password access
- `action` is the bootstrap action we must poll
- `next_actions` may contain follow-up actions such as power-on when `start_after_create` is used

Recommended create payload for v1:

```json
{
  "name": "tenant-abc123",
  "server_type": "cpx21",
  "image": "ubuntu-24.04",
  "location": "nbg1",
  "start_after_create": true,
  "ssh_keys": ["otto-runtime-deploy"],
  "user_data": "#cloud-config\n...",
  "labels": {
    "otto/tenant_id": "tenant_abc123",
    "otto/runtime": "openclaw",
    "otto/managed": "true"
  }
}
```

### `GET /servers/{id}`

Use for:

- fetching canonical server state after create/delete/rebuild actions
- obtaining public IPv4 from `server.public_net.ipv4.ip`
- reading status, location, attached volumes, labels, protection flags

Fields especially relevant to us:

- `server.id`
- `server.name`
- `server.status`
- `server.public_net.ipv4.ip`
- `server.public_net.ipv6.ip`
- `server.server_type`
- `server.location`
- `server.image`
- `server.protection`
- `server.labels`
- `server.volumes`
- `server.primary_disk_size`

Practical note:

- Hetzner action success does not mean cloud-init and SSH are ready
- after `GET /servers/{id}` returns a usable IPv4, the next step is still `ssh.waitUntilReachable`

### `PUT /servers/{id}`

This is intentionally small.

Supported request fields:

- `name`
- `labels`

Use for:

- repairing labels
- renaming a tenant server if naming rules change

Do not expect this endpoint to handle:

- resizing
- image changes
- restart behavior

Those live under server actions.

### `DELETE /servers/{id}`

Use for:

- tenant teardown
- failed-environment cleanup

Practical recommendation:

- set a server protection policy before using this aggressively in production workflows
- always mark the tenant server row as deleting first in our DB before calling Hetzner

### `GET /servers/{id}/metrics`

Useful query params:

- `type[]`: `cpu`, `disk`, `network`
- `start`
- `end`
- `step`

Use for:

- future admin dashboards
- support tooling
- capacity planning

Not needed for day-1 provisioning, but worth wiring behind a thin wrapper for operations later.

## Resource group: Server actions

Docs:

- [Server Actions](https://docs.hetzner.cloud/reference/cloud#tag/server-actions)
- [Power off a Server](https://docs.hetzner.cloud/reference/cloud#tag/server-actions/poweroff_server)
- [Power on a Server](https://docs.hetzner.cloud/reference/cloud#tag/server-actions/poweron_server)
- [Soft-reboot a Server](https://docs.hetzner.cloud/reference/cloud#tag/server-actions/reboot_server)
- [Rebuild a Server from an Image](https://docs.hetzner.cloud/reference/cloud#tag/server-actions/rebuild_server)

### `GET /actions/{action_id}`

This is the main polling endpoint we need.

Use for:

- polling a specific action after `create`, `rebuild`, `reboot`, `poweroff`, `poweron`, `reset`, or `shutdown`

Important response fields:

- `action.id`
- `action.command`
- `action.status`
- `action.progress`
- `action.started`
- `action.finished`
- `action.error`

This should back:

- `hetzner.waitForServerAction(serverId, actionId)`

Implementation note from live API testing on March 13, 2026:

- polling `GET /servers/{id}/actions/{action_id}` returned `not_found`
- polling `GET /actions/{action_id}` returned the expected action payload

For the Otto client, treat `GET /actions/{action_id}` as the canonical polling route.

### `GET /servers/{id}/actions`

Use for:

- admin visibility
- debugging a tenant server history

Useful query params:

- `status[]`
- `sort[]`
- `page`
- `per_page`

This is not required for the core happy path, but it is useful for ops tooling.

### `GET /servers/actions`

Use for:

- broad admin tooling across all managed servers
- incident investigation

Not required for day-1 tenant provisioning.

### `POST /servers/{id}/actions/poweroff`

No request body.

Use for:

- hard operational stop
- maintenance windows

This is a stronger action than app-level restart over SSH.

### `POST /servers/{id}/actions/poweron`

No request body.

Use for:

- starting a powered-off tenant server

### `POST /servers/{id}/actions/reboot`

No request body.

Use for:

- OS-level reboot
- recovery when Docker or the VM itself is unhealthy

This should not be the normal config-apply path. Normal config apply should still be:

- SSH write files
- Docker compose restart or recreate

### `POST /servers/{id}/actions/shutdown`

No request body.

Use for:

- graceful VM shutdown

This is usually preferable to `poweroff` if the VM is healthy and we want a cleaner stop.

### `POST /servers/{id}/actions/reset`

No request body.

Use for:

- last-resort hard reset

This is a stronger operational escape hatch. Keep it out of normal workflows.

### `POST /servers/{id}/actions/reset_password`

No request body.

Use for:

- emergency recovery only

This is not part of the intended managed flow if we consistently use deploy keys.

### `POST /servers/{id}/actions/rebuild`

Required request field:

- `image`

Important optional request field:

- `user_data`

Use for:

- tenant repair / reinstall
- base image replacement while keeping server identity
- full recovery path after a broken runtime

Important behavior:

- Hetzner now supports `user_data` during rebuild
- if `user_data` is omitted, the spec says previous `user_data` may be reused

Recommended use in our system:

- expose as a deliberate repair action, not an automatic retry

## Resource group: Server types

Docs:

- [List Server Types](https://docs.hetzner.cloud/reference/cloud#tag/server-types/list_server_types)
- [Get a Server Type](https://docs.hetzner.cloud/reference/cloud#tag/server-types/get_server_type)

### `GET /server_types`

Useful query params:

- `name`
- `page`
- `per_page`

Use for:

- validating a configured default server type like `cpx21`
- displaying upgrade candidates later
- cache warmup in admin UI

Important response fields to care about:

- `name`
- `architecture`
- `cores`
- `memory`
- `disk`
- `storage_type`
- `cpu_type`
- `prices`
- `locations`
- `locations[].deprecation`

Important operational note:

- availability is location-sensitive
- deprecation is now expressed per location
- the old top-level `deprecated` signal is itself deprecated

This means our validation layer should check:

1. the server type exists
2. it supports the intended `location`
3. the target location is not deprecated/unavailable for that type

### `GET /server_types/{id}`

Use for:

- exact lookups by stored Hetzner ID

For most app code, `GET /server_types?name=cpx21` is more ergonomic before server creation.

## Resource group: Images

Docs:

- [Images](https://docs.hetzner.cloud/reference/cloud#tag/images)

### `GET /images`

Useful query params:

- `type[]`: `system`, `app`, `snapshot`, `backup`
- `status[]`: `available`, `creating`, `unavailable`
- `name`
- `architecture`
- `include_deprecated`
- `label_selector`
- `sort[]`

Use for:

- validating the chosen base image, for example `ubuntu-24.04`
- filtering system images for create/rebuild flows
- checking architecture compatibility

Important practical checks:

- prefer `type=system`
- require `status=available`
- match `architecture` against the chosen server type
- avoid deprecated images unless this is a deliberate recovery path

### `GET /images/{id}`

Use for:

- exact lookups of a chosen image
- reading deprecation and architecture metadata

Relevant response fields:

- `id`
- `type`
- `status`
- `name`
- `description`
- `disk_size`
- `os_flavor`
- `os_version`
- `rapid_deploy`
- `deprecated`
- `architecture`

### `PUT /images/{id}`

Supported fields:

- `description`
- `type` with only `snapshot` as the documented destination value
- `labels`

Likely not needed for v1 unless we start managing snapshots/images we create ourselves.

### `DELETE /images/{id}`

Likely not needed for day 1.

Relevant only if we later create snapshots as part of repair or backup tooling.

## Resource group: Volumes

Docs:

- [Volumes](https://docs.hetzner.cloud/reference/cloud#tag/volumes)

Volumes are optional for v1, but the API surface is clean enough that we should account for it in the wrapper design.

### `GET /volumes`

Useful query params:

- `status[]`
- `name`
- `label_selector`
- `sort[]`
- `page`
- `per_page`

Use for:

- reconciliation
- optional tenant storage discovery

### `POST /volumes`

Required fields:

- `size`
- `name`

Useful optional fields:

- `location`
- `server`
- `automount`
- `format`
- `labels`

Important behavior:

- volume and server must live in the same location
- `server` can be provided at creation time to attach immediately
- supported documented filesystem formats are `xfs` and `ext4`

### `GET /volumes/{id}`

Relevant response fields:

- `id`
- `created`
- `name`
- `server`
- `location`
- `size`
- `linux_device`
- `protection`
- `labels`
- `status`
- `format`

Use for:

- verifying an attached data volume after provisioning

### `PUT /volumes/{id}`

Supported fields:

- `name`
- `labels`

### `DELETE /volumes/{id}`

Use for:

- teardown of optional tenant storage

### `POST /volumes/{id}/actions/attach`

Required field:

- `server`

Optional field:

- `automount`

Use for:

- attaching an existing data volume to a tenant server

### `POST /volumes/{id}/actions/detach`

No request body.

Use for:

- maintenance
- teardown

### `POST /volumes/{id}/actions/resize`

Required field:

- `size`

Constraint from the spec:

- new size must be greater than current size

Use for:

- future storage expansion

## Wrapper design we should implement

The main rule is:

- keep raw Hetzner REST details in one low-level client
- expose boring, explicit service methods above it
- keep workflow code independent of whether jobs run in-process or later in Trigger.dev

### Low-level client

Suggested module:

- `lib/hetzner/client.ts`

Responsibilities:

- base URL
- auth header
- JSON parsing
- consistent error shaping
- optional rate-limit logging

Suggested primitives:

```ts
type HetznerRequestInit = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, string | string[] | number | boolean | undefined>;
  body?: unknown;
};

async function hetznerRequest<T>(path: string, init?: HetznerRequestInit): Promise<T>;
```

### Server service

Suggested module:

- `lib/hetzner/servers.ts`

Suggested surface:

```ts
createServer(input)
getServer(serverId)
listServers(filters)
updateServer(serverId, patch)
deleteServer(serverId)
getServerMetrics(serverId, input)
waitForServerAction(serverId, actionId)
powerOnServer(serverId)
powerOffServer(serverId)
rebootServer(serverId)
shutdownServer(serverId)
resetServer(serverId)
resetServerPassword(serverId)
rebuildServer(serverId, input)
```

### Catalog service

Suggested modules:

- `lib/hetzner/server-types.ts`
- `lib/hetzner/images.ts`

Suggested surface:

```ts
listServerTypes(filters)
getServerType(serverTypeId)
listImages(filters)
getImage(imageId)
```

Optional later:

```ts
updateImage(imageId, patch)
deleteImage(imageId)
```

### Volume service

Suggested module:

- `lib/hetzner/volumes.ts`

Suggested surface:

```ts
listVolumes(filters)
createVolume(input)
getVolume(volumeId)
updateVolume(volumeId, patch)
deleteVolume(volumeId)
attachVolume(volumeId, input)
detachVolume(volumeId)
resizeVolume(volumeId, input)
waitForVolumeAction(volumeId, actionId)
```

## Minimum API surface for v1

If the goal is one tenant VPS with no extra storage, the actual minimum Hetzner surface is:

- `GET /server_types`
- `GET /images`
- `POST /servers`
- `GET /servers/{id}`
- `GET /actions/{action_id}`
- `DELETE /servers/{id}`
- `POST /servers/{id}/actions/reboot`
- `POST /servers/{id}/actions/rebuild`

That is enough to support:

- provision
- inspect
- delete
- reboot
- rebuild
- validate image and server type before create

## Useful but not mandatory for v1

- `GET /servers`
- `PUT /servers/{id}`
- `GET /servers/{id}/metrics`
- `GET /servers/{id}/actions`
- `GET /servers/actions`
- volume endpoints

## Control-plane recommendations

### Provision flow

Recommended sequence:

1. validate server type with `GET /server_types`
2. validate image with `GET /images`
3. `POST /servers`
4. poll `GET /actions/{action_id}`
5. `GET /servers/{id}`
6. wait for SSH
7. apply config over SSH

### Repair flow

Recommended sequence:

1. `POST /servers/{id}/actions/rebuild`
2. poll server action
3. `GET /servers/{id}`
4. wait for SSH again
5. re-apply config over SSH

### Restart flow

Default managed flow:

- use SSH and restart the OpenClaw container or service on the VPS

Use Hetzner reboot only when:

- the VM itself is unhealthy
- SSH path is broken
- Docker-level restart is insufficient

## What not to guess in implementation

These details should always be read from the live Hetzner API or our own validated config, not assumed:

- server type availability by location
- image availability and deprecation
- architecture compatibility
- action completion timing
- exact current image names that remain orderable

This matters because Hetzner has recently changed:

- image availability
- deprecation signaling
- server request/response location fields
- rebuild capabilities
