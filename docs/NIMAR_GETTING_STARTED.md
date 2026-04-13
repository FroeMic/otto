# Otto: Current State and Nimar Quickstart

## Summary

Otto is a multi-service workspace app that provisions one OpenClaw gateway per customer workspace on a dedicated Hetzner VPS.

Current flow:

1. User signs in with WorkOS.
2. User completes Slack install OAuth.
3. Otto stores the tenant-specific Slack bot token.
4. Otto enqueues a provisioning job.
5. Worker provisions a Hetzner server, waits for SSH and Docker, writes OpenClaw config, injects Slack and OpenAI credentials, and starts the OpenClaw container.

## What Is Implemented

- WorkOS auth: sign up, sign in, sign out
- Slack app wiring for a shared private Slack app
- Slack OAuth flow to obtain a tenant-specific bot token
- Postgres-backed provisioning jobs in-repo
- Hetzner provisioning:
  - create server
  - wait for create action
  - fetch public IP
  - wait for SSH
  - wait for cloud-init and Docker
- Runtime bootstrap over SSH:
  - write `openclaw.json`
  - write runtime `.env`
  - inject OpenAI API key and model
  - inject Slack app token and tenant bot token
- Start OpenClaw in Docker on the tenant server
- Verify OpenClaw liveness on the tenant server

## Caveats

- Provisioning currently takes roughly 5 minutes on a cold server because Docker and host dependencies are installed during first boot.
- This should get faster if we switch to a Hetzner snapshot/custom image with Docker and baseline runtime dependencies preinstalled.
- Slack OAuth requires HTTPS redirect URIs, so local development currently needs an ngrok tunnel to `localhost:3000`.
- The Slack app settings currently live here:
  - [Slack OAuth settings](https://app.slack.com/app-settings/T0AL0U35D0V/A0ALCBJR23X/oauth)

## What Is Missing

- Polished user-facing onboarding flow
- Production deployment of the workspace and runtime control services
- Better runtime health visibility in the dashboard
- Faster/bootstrap-optimized server images

## Local Development

### Prerequisites

- Bun
- Docker
- ngrok
- Postgres via `docker-compose.yml`
- WorkOS credentials
- Hetzner Cloud API token
- Slack app credentials
- OpenAI API key

### Important env vars

In `.env`:

```env
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/otto

WORKOS_CLIENT_ID=
WORKOS_API_KEY=
WORKOS_COOKIE_PASSWORD=
NEXT_PUBLIC_WORKOS_REDIRECT_URI=https://<ngrok-domain>/auth/callback

SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_REDIRECT_URI=https://<ngrok-domain>/oauth/callback/slack

CONTROL_PLANE_ENCRYPTION_SECRET=
CONTROL_PLANE_OAUTH_STATE_SECRET=

HETZNER_API_TOKEN=
HETZNER_DEFAULT_SERVER_TYPE=cx23
HETZNER_DEFAULT_LOCATION=nbg1
HETZNER_DEFAULT_IMAGE=ubuntu-24.04
HETZNER_SSH_KEY_NAMES=

RUNTIME_DEPLOY_PRIVATE_KEY="-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----"
RUNTIME_SSH_USERNAME=root
RUNTIME_SSH_PORT=22

RUNTIME_OPENAI_API_KEY=
RUNTIME_MODEL_PRIMARY=openai/gpt-5.4

RUNTIME_SLACK_APP_TOKEN=
```

Notes:

- `SLACK_REDIRECT_URI` must match the Slack app redirect URL exactly.
- `NEXT_PUBLIC_WORKOS_REDIRECT_URI` must match WorkOS exactly.
- Use the same ngrok domain for the whole app flow, not just the callback.

### Start locally

From repo root:

```bash
docker compose -f docker-compose.yml up -d
bun run db:migrate
bun run dev:all
```

In another terminal:

```bash
ngrok http 3000
```

Then update:

- WorkOS redirect/homepage/sign-in settings to the ngrok domain
- Slack redirect URL to `https://<ngrok-domain>/oauth/callback/slack`

## What You Can Test Today

1. Sign in with WorkOS.
2. Connect the Slack integration through OAuth.
3. Watch Otto provision a real Hetzner server.
4. SSH into the server and verify OpenClaw is running.
5. Send a Slack DM to the connected bot.

Current known limitation:

- The OpenClaw runtime is wired correctly, but `gpt-5.4` may exceed current OpenAI TPM limits for realistic Slack interactions depending on account limits and prompt size.

## Code Areas To Know

- `apps/web/src/server/app.tsx`
  - browser app entrypoint
- `apps/api/src/integrations/oauth-routes.ts`
  - integration OAuth start and callback routes
- `apps/worker/src/runtime/lib/jobs/provisioning.ts`
  - end-to-end provisioning workflow
- `apps/worker/src/runtime/lib/runtime/manager.ts`
  - SSH bootstrap and OpenClaw startup
- `apps/worker/src/runtime/lib/openclaw/config.ts`
  - generated OpenClaw config
- `apps/worker/src/runtime/db/control-plane.ts`
  - tenant creation, provisioning state, and runtime operations data access

## Recommended Next Work

1. Make runtime verification more resilient and visible in the dashboard.
2. Prepare a deployable workspace/runtime environment.
3. Speed up provisioning with a Hetzner snapshot/base image.
4. Continue the runtime release and AI proxy tracks from `spec/`.
