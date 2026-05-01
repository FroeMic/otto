# otto-integrations

An OpenClaw plugin that gives the agent tools to discover and execute integrations. It is a thin adapter — the plugin proxies all execution to the integration gateway; all logic and credential handling lives in the control plane.

## Exposed Tools

| Tool | Purpose |
|---|---|
| `list_integrations` | List connected integrations and their status |
| `get_integration` | Get details about a specific integration |
| `get_integration_details` | Get full command list for an integration |
| `find_integration_commands` | Search available commands across all integrations |
| `execute_integration_command` | Execute a specific integration command |
| `configure_integration` | Update integration settings |
| `manage_integration` | Connect or disconnect an integration |

## Execution Flow

When the agent calls `execute_integration_command`, the plugin sends the request to `apps/gateway` with the tenant bearer token. The gateway authenticates the request, checks the capability policy, delegates to `packages/features/integrations-runtime`, and returns the result. The plugin never directly calls Slack, GitHub, or any other external service.
