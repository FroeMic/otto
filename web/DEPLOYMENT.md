# Control-Plane Deployment

This deploy target assumes one public control-plane VPS on Hetzner:

- public HTTPS for the web UI
- local Docker Compose services for `caddy`, `web`, `worker`, and `postgres`
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

On the host, place the repo and create the production env file:

```bash
cp .env.production.example .env
```

Set at least:

- `OTTO_DOMAIN`
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
- `CONTROL_PLANE_OAUTH_STATE_SECRET`

Use the internal Postgres hostname in `DATABASE_URL`, for example:

```bash
DATABASE_URL=postgres://otto:change-me@postgres:5432/otto
```

## 4. Build and migrate

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml --profile ops run --rm migrate
```

## 5. Start the stack

```bash
docker compose -f docker-compose.prod.yml up -d
```

Verify:

- `https://<your-domain>/healthz` returns `200`
- the `web` and `worker` containers stay healthy
- `WORKOS_REDIRECT_URI` points at the public callback URL
- `WORKOS_BASE_URL` matches the public app origin
- `WORKOS_CLIENT_ID` and `WORKOS_API_KEY` come from the production WorkOS environment so hosted AuthKit uses the production `*.authkit.app` domain
- WorkOS and Slack redirect URIs point at the public domain

## 6. Harden SSH

At minimum:

- disable password auth in `sshd`
- use Tailscale SSH or key-only auth
- keep Hetzner console access available for recovery

With that setup, the app stays public while host administration stays private.
