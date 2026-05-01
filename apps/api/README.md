# api

The control plane API. A Hono server serving three distinct audiences: the web frontend via type-safe RPC, tenant runtimes via HTTP adapters, and external systems via OAuth callbacks and webhooks. Long-running work is enqueued as a job and delegated to `apps/worker` — the API never does SSH, never calls Hetzner, and never calls OpenAI directly.

## Responsibilities

- **Browser RPC** — type-safe Hono RPC routes for all workspace features (agent settings, sessions, files, skills, integrations, billing, members, platform admin)
- **Runtime HTTP adapters** — endpoints for tenant runtimes to pull managed config, sync skills, report sessions, and proxy AI calls
- **OAuth flows** — integration OAuth (Slack, GitHub, Linear) and auth via WorkOS
- **Webhooks** — Slack event subscriptions, GitHub app webhooks, Stripe payment events
- **Auth** — WorkOS session validation for browser requests; bearer token validation for runtime requests

## Routers

| Router | Domain |
|---|---|
| `agent` | Agent personalization (prompt, model, name) |
| `workspace` | Workspace settings and bootstrap |
| `integrations` | Integration connect/disconnect/configure |
| `files` | Runtime file browser and download |
| `sessions` | Conversation history and transcripts |
| `scheduled-tasks` | Task scheduling and status |
| `skills` | Skill install/remove/reset |
| `billing` | Plan, credits, preferences |
| `platform` | Operator admin (org list, tenant detail, jobs) |
| `onboarding` | First-run provisioning state |
| `user` | User profile |
| `workspace-members` | Invitations and roles |

## Design

Routes that trigger side effects enqueue a job and return immediately. The API surface stays thin and request/response focused — all provisioning, config apply, OAuth refresh, and billing settlement logic runs in `apps/worker`.

**Port:** `3002`
