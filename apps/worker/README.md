# worker

The background job processor. Handles everything that should not block HTTP request handlers: VPS provisioning, config apply, OAuth token refresh, billing settlement, scheduled task execution, and workspace chat turns. Jobs are stored in Postgres and processed in concurrent per-lane slots — a hung job in one lane does not block others.

## Job Lanes

| Lane | Jobs |
|---|---|
| `runtime` | Provisioning, config apply, image refresh, server deletion |
| `chat` | Workspace chat turn execution |
| `integrations` | OAuth token refresh, Slack sync, scheduled task reconciliation, session sync |
| `metering` | OpenAI usage sync |
| `settlement` | Credit burndown, auto top-off, billing settlement |

## Key Jobs

- **`provision_tenant_server`** — Creates a Hetzner VPS, installs the runtime image, and applies initial config
- **`apply_tenant_config`** — Generates `openclaw.json` + skill files and writes them to the tenant server via SSH; runtime restarts with new state
- **`refresh_runtime_image`** — Pulls an updated runtime image on the tenant VPS and restarts the runtime
- **`run_workspace_chat_turn`** — Processes a workspace chat message through the AI pipeline
- **`settle_credit_usage_chunk`** — Converts metered OpenAI token usage into credit ledger entries

## Provisioning Pipeline

`provision_tenant_server` runs through nine sequential steps:

1. `create_server` — Hetzner API call to create VPS
2. `wait_for_hetzner_action` — Poll until Hetzner action completes
3. `fetch_server_ip` — Retrieve assigned IP address
4. `wait_for_ssh` — Poll until SSH is available
5. `wait_for_host_bootstrap` — Wait for cloud-init to finish
6. `bootstrap_runtime` — Install runtime image and dependencies
7. `start_runtime` — Launch the OpenClaw runtime process
8. `verify_runtime` — Health-check the running runtime
9. `mark_server_ready` — Mark tenant as provisioned in the control plane

Each step is persisted so a restart resumes from the last completed step.
