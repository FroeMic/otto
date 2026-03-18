# TODO 12: Runtime Dashboard Access

## Goal

Expose the OpenClaw dashboard access details in the authenticated Otto UI so an organization member can open the tenant runtime dashboard through an SSH tunnel and authenticate with the correct gateway token without manually inspecting the VPS.

## Scope

- surface the tenant runtime dashboard URL and SSH tunnel instructions in the Agent status UI
- surface the tenant runtime gateway token from control-plane encrypted storage
- keep the token handling aligned with OpenClaw dashboard and gateway auth docs
- avoid broadening runtime exposure beyond the existing host-loopback-only publish

## Dependencies

- `TODO_05_config_apply_and_reconciliation.md`
- `TODO_07_operations_and_observability.md`
- `TODO_09_ui_app_shell_and_onboarding_rebuild.md`
- OpenClaw gateway configuration reference: <https://docs.openclaw.ai/gateway/configuration-reference>
- OpenClaw dashboard docs: <https://docs.openclaw.ai/web/dashboard>

## Implementation notes

- Keep the gateway token source of truth in `tenant_runtime_secrets`; do not duplicate it into tenant summary tables or desired-state JSON.
- Keep `OPENCLAW_GATEWAY_TOKEN` projected into the tenant runtime `.env`, and keep `gateway.auth.token` in `openclaw.json` sourced from that env var.
- The Otto UI should show the dashboard access details only on the authenticated Agent status / deployment view, not in the global app shell payload.
- The dashboard URL shown in Otto should remain the localhost URL the user reaches through a tunnel:
  - `http://127.0.0.1:18791/`
- The UI should also show the SSH tunnel command using the tenant IPv4:
  - `ssh -N -L 18791:127.0.0.1:18791 root@<tenant-ip>`
- The gateway token should be masked by default with explicit reveal and copy actions.
- For this first slice, any authenticated organization member may reveal the token for that organization.
- Explicit role-based restrictions such as org-admin-only or global-operator-only access are deferred until the control plane has a stronger authorization layer than membership-only gating.
- If the tenant is missing a runtime IP or gateway token, show a clear blocked / unavailable state instead of guessing fallback values.
- Do not add a public runtime URL, reverse-proxy path, or tokenized dashboard link in this slice.
- Keep the runtime port model unchanged:
  - OpenClaw listens on the container interface needed for Docker publishing
  - Docker publishes only `127.0.0.1:18791` on the tenant host
  - users reach the dashboard through SSH tunneling, not direct public ingress

## Acceptance criteria

- an authenticated organization member can open the Agent status page and see:
  - the dashboard localhost URL
  - the SSH tunnel command for the current tenant server when an IP exists
  - the current gateway token with reveal and copy controls
- the gateway token is fetched from encrypted control-plane storage, not from a duplicated dashboard cache field
- the token is not added to the shared `DashboardOrganization` shell payload
- a user can run the shown SSH tunnel command on their own machine, open `http://127.0.0.1:18791/`, paste the shown token into the OpenClaw dashboard auth prompt, and log in successfully
- if the tenant does not yet have a server IP or stored token, the page shows a clear unavailable state
- no new public runtime exposure is introduced

## Status checklist

- [x] add a focused spec for runtime dashboard access
- [x] add a server-only control-plane read path for the current tenant gateway token in the Agent status page
- [x] add a deployment access card that shows dashboard URL, SSH tunnel command, and masked token controls
- [x] keep the token out of the shared dashboard shell payload
- [ ] verify the dashboard login flow manually through an SSH tunnel
- [x] update `spec/STATUS.md` with the new follow-up slice

## Open questions

- Should a later authz slice restrict token reveal to org admins or global operators instead of all org members?
- Should a later operator UX add token rotation / drift recovery directly in Otto, or keep that as a separate operational workflow?
