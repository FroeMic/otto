# Hetzner Onboarding Snapshot Runbook

This runbook defines the manual first-pass workflow for baking and activating an onboarding snapshot for snapshot-based tenant provisioning.

## Preconditions

- `HETZNER_API_TOKEN` is set for the target Hetzner project.
- `HETZNER_DEFAULT_LOCATION` and `HETZNER_DEFAULT_SERVER_TYPE` point at the intended onboarding host shape.
- `RUNTIME_OPENCLAW_IMAGE` is set to the runtime image that new tenants should boot.
- The deploy SSH key named in `HETZNER_SSH_KEY_NAMES` exists in the target Hetzner project.

## Bake flow

1. Create a temporary Hetzner server from the supported base image.
2. Bootstrap the host once:
   - install Docker
   - create the `openclaw` user
   - create `/opt/openclaw`, `/opt/openclaw/home`, and `/opt/openclaw/runtime`
3. Pull the target Otto runtime image onto the host.
4. Write `/opt/openclaw/runtime/snapshot-metadata.json` with:
   - `generation`
   - `runtimeImage`
   - `baseImage`
   - `bakedAt`
5. Power off the host cleanly.
6. Create a Hetzner snapshot from the powered-off server.
7. Set:
   - `HETZNER_ONBOARDING_PROVISIONING_MODE=hetzner_snapshot`
   - `HETZNER_DEFAULT_SNAPSHOT_IMAGE=<snapshot-id>`
   - `HETZNER_SNAPSHOT_EXPECTED_RUNTIME_IMAGE=<runtime-image-ref>`
   - `HETZNER_SNAPSHOT_GENERATION=<generation>`

## Rollback

To stop using the snapshot path:

1. Set `HETZNER_ONBOARDING_PROVISIONING_MODE=legacy_base_image`.
2. Keep the previous snapshot id recorded for later reuse.
3. New onboarding runs will queue the legacy `provision_tenant_server` job again.

## Notes

- The snapshot must not contain tenant-specific secrets.
- OpenAI credentials, tenant tokens, gateway tokens, and projected runtime config are still written after server creation.
- The existing `provision_tenant_server` job remains the rollback path.
