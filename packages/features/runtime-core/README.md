# feature-runtime-core

Shared substrate for managed tenant runtime state. Exports handler functions for managed config and managed skills — mounted by `apps/api` (browser-facing mutations) and runtime HTTP adapters (agent tool call mutations). No HTTP server, no provider-specific code.

## Responsibilities

- **Managed config** — get/patch handlers for agent instruction files (`openclaw.json` config and system prompt files); includes optimistic concurrency via version conflict detection
- **Managed skills** — full CRUD handlers for tenant-owned skills: create, update, delete, reset to canonical, install from library
- **Sessions** — session query contracts, transcript handling
- **Scheduled tasks** — task normalization and sync logic
- **Runtime files** — file snapshot and download operations

## Key Exports

```ts
// Managed config
handleManagedConfigGetRequest(tenantId)
handleManagedConfigPatchRequest(tenantId, payload)  // version-checked

// Managed skills
handleManagedSkillsGetRequest(tenantId)
handleManagedSkillsPostRequest(tenantId, payload)
handleManagedSkillsUpdateRequest(tenantId, skillId, payload)  // version-checked
handleManagedSkillsDeleteRequest(tenantId, skillId)
```

## Used By

- `apps/api` — mounts these handlers on runtime-facing HTTP routes and browser RPC routes
- `apps/worker` — calls underlying DB functions during config apply and provisioning
