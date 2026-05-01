# gateway

An isolated Hono service that proxies integration command execution from tenant runtimes to external services. Separated from the main API to prevent runtime execution load from affecting browser-facing traffic and to provide a clear blast-radius boundary.

## How It Works

1. Tenant runtime sends `POST /api/internal/runtime/integrations/execute` with a bearer token, `integrationKey`, `commandKey`, and `arguments`
2. Gateway validates the bearer token via `authenticateTenantRuntimeRequest`
3. Calls `executeRuntimeIntegrationInGateway` from `packages/features/integrations-runtime`, which enforces the capability policy — only commands the control plane has enabled for that tenant are allowed
4. Returns the command result or a structured error

The runtime never holds integration credentials (Slack bot tokens, GitHub tokens, etc.). The gateway holds them on behalf of the tenant and executes commands in response to authenticated requests.

## Exposed Endpoint

```
POST /api/internal/runtime/integrations/execute
```

Everything else returns 404.

## Dependencies

`packages/features/integrations-runtime` only.

**Port:** `3001`
