# Tenant Runtime Testing Runbook

Use this runbook when touching provisioning, apply, runtime bootstrap, or tenant
server lifecycle behavior.

## Policy reminders

- Follow `AGENTS.md` for architecture and naming guardrails.
- Keep request handlers thin and job-oriented runtime operations in worker paths.

## Provider modes (target design and test matrix)

Current behavior:

- `hetzner`: selected when `HETZNER_API_TOKEN` is present.
- `fake`: selected when `HETZNER_API_TOKEN` is absent.

Planned behavior:

- explicit provider mode (for example `TENANT_RUNTIME_PROVIDER`) with:
  - `hetzner`
  - `docker`
  - `fake`

## Recommended testing matrix

### 1) Fast loop (every PR touching provisioning logic)

- Provider: `fake`
- Goal:
  - validate job transitions and queue behavior
  - validate DB state updates without external infra
- Commands:
  - run targeted worker tests only
  - avoid full-repo test runs

### 2) Realistic integration loop (for deploy/SSH/runtime changes)

- Provider: `docker` (when available in environment)
- Goal:
  - validate SSH reachability checks
  - validate runtime bootstrap and restart logic
  - validate delete flows remove provider resources
- Notes:
  - use dedicated docker resources per tenant id
  - ensure teardown is idempotent

### 3) Production path confidence loop

- Provider: `hetzner`
- Goal:
  - confirm real provider interactions before production release
- Scope:
  - limited smoke validation due cost and external dependency

## Cloud VM constraints

Some cloud agent VMs may not include Docker. If Docker is unavailable:

1. run fake-mode tests and logic validation;
2. document docker-mode test gap clearly in the PR;
3. run docker-mode in a Docker-enabled environment before merge.

## Expected evidence in PRs

For provisioning/runtime-related changes, capture:

- command outputs for targeted tests
- API/service health checks as needed
- worker log snippets showing claimed jobs and successful transitions
- any environment constraints (for example "Docker unavailable in this VM")
