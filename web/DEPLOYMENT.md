# Otto Public Deployment

This deploy target assumes one public control-plane VPS on Hetzner:

- public HTTPS for both the marketing site and the workspace app
- local Docker Compose services for `caddy`, `www`, `web`, `worker`, and `postgres`
- Tailscale-only operator access for SSH

## 1. Provision the host

- Create one Ubuntu VPS in Hetzner.
- Attach a Hetzner firewall that allows inbound `80` and `443`.
- Do not leave public `22` open permanently.

## 2. Bootstrap the host

Install Docker, the Compose plugin, and Tailscale.

Join the box to your tailnet before tightening SSH:

```bash
sudo tailscale up --ssh
```

Verify you can reach the host over Tailscale, then remove any public firewall rule for `22`.

## 3. Prepare the app

On the host, place the repo and create the production env files:

```bash
cp .env.production.example .env
cp ../www/.env.production.example ../www/.env
```

Set at least:

- `LANDING_PAGE_DOMAIN`
- `CONTROL_PLANE_DOMAIN`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `WORKOS_CLIENT_ID`
- `WORKOS_API_KEY`
- `WORKOS_COOKIE_PASSWORD`
- `WORKOS_REDIRECT_URI`
- `WORKOS_BASE_URL`
- `SLACK_CLIENT_ID`
- `SLACK_CLIENT_SECRET`
- `SLACK_REDIRECT_URI`
- `HETZNER_API_TOKEN`
- one of `RUNTIME_DEPLOY_PRIVATE_KEY` or `RUNTIME_DEPLOY_PRIVATE_KEY_PATH`
- `CONTROL_PLANE_ENCRYPTION_SECRET`
- `CONTROL_PLANE_OPENAI_ADMIN_API_KEY` so Otto can provision the initial tenant-specific OpenAI project and service-account key during tenant bootstrap and later rotate it
- `CONTROL_PLANE_OAUTH_STATE_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RUNTIME_OPENCLAW_IMAGE` if you want tenant runtimes to use the Otto custom OpenClaw image with bundled Otto plugins

In `../www/.env`, set the landing-site browser analytics values you want baked
into the public site build:

- `NEXT_PUBLIC_POSTHOG_ENABLED`
- `NEXT_PUBLIC_POSTHOG_HOST`
- `NEXT_PUBLIC_POSTHOG_TOKEN`

For Brave web search, also set:

- `RUNTIME_BRAVE_API_KEY`
- `RUNTIME_WEB_SEARCH_PROVIDER=brave`
- optionally `RUNTIME_WEB_SEARCH_BRAVE_MODE`
- optionally `RUNTIME_WEB_SEARCH_MAX_RESULTS`
- optionally `RUNTIME_WEB_SEARCH_TIMEOUT_SECONDS`
- optionally `RUNTIME_WEB_SEARCH_CACHE_TTL_MINUTES`

Use the internal Postgres hostname in `DATABASE_URL`, for example:

```bash
DATABASE_URL=postgres://otto:change-me@postgres:5432/otto
```

## 4. Build and migrate

If you are using the Otto-managed runtime image with bundled runtime plugins, build
and publish it from the repo root first:

```bash
IMAGE_REVISION=1 ./publish-runtime-image.sh
```

Then set:

```bash
RUNTIME_OPENCLAW_IMAGE=ghcr.io/froemic/otto-openclaw:2026.4.1.1
```

on the control-plane host before rebuilding the production stack.

For Stripe billing, also configure:

- four recurring monthly prices in Stripe for:
  - `Basic` at `$20/month`
  - `Plus` at `$50/month`
  - `Pro` at `$100/month`
  - `Max` at `$200/month`
- set their Stripe price `lookup_key` values exactly to:
  - `basic_monthly`
  - `plus_monthly`
  - `pro_monthly`
  - `max_monthly`
- a Stripe webhook endpoint at `https://<your-domain>/webhooks/stripe`
- webhook events:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`
- the Stripe billing portal, with customer-managed payment methods, invoices, cancellation, and plan changes enabled

If PostHog browser analytics is enabled on the landing site, make sure those
`NEXT_PUBLIC_*` values are already present in `../www/.env` before running
`docker compose ... build`. Next.js inlines `NEXT_PUBLIC_*` values into the
browser bundle at build time.

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml --profile ops run --rm migrate
```

## 5. Start the stack

```bash
docker compose -f docker-compose.prod.yml up -d
```

Verify:

- `https://<your-landing-domain>/` returns `200`
- `https://<your-domain>/healthz` returns `200`
- the apex or landing hostname resolves to the same VPS that runs Caddy
- the `web` and `worker` containers stay healthy
- the `www` container stays healthy
- Postgres answers on `127.0.0.1:5433` on the host
- `LANDING_PAGE_DOMAIN` matches the public marketing hostname
- `CONTROL_PLANE_DOMAIN` matches the public app hostname
- `WORKOS_REDIRECT_URI` points at the public callback URL
- `WORKOS_BASE_URL` matches the public app origin
- `WORKOS_CLIENT_ID` and `WORKOS_API_KEY` come from the production WorkOS environment so hosted AuthKit uses the production `*.authkit.app` domain
- WorkOS and Slack redirect URIs point at the public domain

If Brave web search is enabled, also verify a real tenant projection:

```bash
npm run verify:runtime-surface -- <org-slug> web search
```

That script authenticates with the tenant gateway token and calls the same
internal control-plane surface endpoints the `otto-runtime-config` runtime plugin
uses. On the tenant server itself, you can also verify file projection with:

```bash
grep -F '"search"' /opt/openclaw/home/openclaw.json
grep '^BRAVE_API_KEY=' /opt/openclaw/home/.env
```

To connect from a laptop over Tailscale, forward that host-only Postgres port:

```bash
ssh -L 5433:127.0.0.1:5433 root@otto-control-plane
psql 'postgres://otto:<password>@127.0.0.1:5433/otto'
```

## 6. Harden SSH

At minimum:

- disable password auth in `sshd`
- use Tailscale SSH or key-only auth
- keep Hetzner console access available for recovery

With that setup, the app stays public while host administration stays private.
