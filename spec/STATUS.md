# Otto Status

## Current state

- Repository state is still mostly bootstrap.
- `web/` is a minimal Next.js app with placeholder docs.
- No persistent job runtime, auth integration, database layer, or tenant provisioning code exists yet.

## Active architectural decision

- Prefer a database-backed workflow engine inside the Next.js repo before adopting `trigger.dev`.
- Keep the code structured so `trigger.dev` can be introduced later behind a job interface if the simpler approach stops being sufficient.

## Next recommended implementation step

- Execute `TODO_00_architecture_and_job_runtime.md`.

## Open questions

- Will the control plane be self-hosted as a long-running Node process or deployed onto a serverless platform with strict execution limits?
- Is WorkOS still the preferred auth provider, or should auth be deferred until core provisioning is proven?
- Should the first VPS bootstrap install OpenClaw directly, or should the runtime image be built and published first?
