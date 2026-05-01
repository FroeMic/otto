# feature-platform

Zod schemas and TypeScript types for the platform admin surface — the operator's view of all tenants, organizations, jobs, and usage. This package is schema-only; all business logic lives in `apps/api` and `apps/worker`.

## What the Platform Admin Surface Covers

- **Org list** — all organizations with tenant status, runtime image version, and Slack integration health
- **Tenant detail** — VPS IP, latest apply run, recent jobs, AI provider status, recent events
- **Job detail** — step-level progress, stdout/stderr from apply and verify runs
- **Usage metrics** — token counts, credit burn, breakdown by model and usage type
- **Operator actions** — provision server, apply config, delete server, grant credits, cancel jobs

## Key Types

```ts
PlatformOrganizationListItem  // org row with tenant and runtime status
PlatformTenantSummary         // full tenant detail including jobs and apply runs
PlatformJobResult             // job execution result with step-level output
PlatformApplyRunDetail        // apply run output (stdout/stderr per step)
```
