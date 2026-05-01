# feature-integrations-runtime

The integration execution engine. Implements the gateway execution path and per-integration command libraries. When an agent calls `execute_integration_command`, this package resolves the integration, validates the capability policy, and executes the command against the external service.

## Supported Integrations

Slack, Linear, GitHub, PostHog, Brave Search, Gandi

Each integration is self-contained: OAuth provider config (where applicable), a command registry with typed argument schemas, and a capability set that the control plane can selectively enable per tenant.

## Key Export

```ts
executeRuntimeIntegrationInGateway({
  integrationKey,   // e.g. "slack"
  commandKey,       // e.g. "post_message"
  arguments,        // validated against command schema
  tenantId,
})
```

Called by `apps/gateway` for every inbound execute request.

## Capability Policy

Each integration defines available commands. The control plane determines which subset is enabled for a given tenant's integration. The gateway enforces this — a command not in the tenant's capability set is rejected before execution, regardless of whether the underlying credentials would allow it.

## Used By

- `apps/gateway` — primary consumer; all runtime integration execute traffic flows through here
- `apps/api` — OAuth flow handling, webhook processing, integration status resolution
