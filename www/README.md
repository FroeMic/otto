# Otto public site

This is Otto's public website app.

## Env

For local development:

```bash
cp .env.example .env.local
```

Available variables:

- `NEXT_PUBLIC_POSTHOG_ENABLED`
- `NEXT_PUBLIC_POSTHOG_HOST`
- `NEXT_PUBLIC_POSTHOG_TOKEN`

For Docker or production builds, create:

```bash
cp .env.production.example .env
```

The Docker build reads `www/.env` directly, so the landing site can keep its
own public analytics configuration separate from `web/.env`.

## Commands

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run typecheck`
- `npm run format`

## PostHog

The app uses the same production-only browser analytics pattern as `web/`:

- browser events initialize through `instrumentation-client.ts`
- `/ingest` is proxied through Next.js rewrites
- analytics stays off unless `NEXT_PUBLIC_POSTHOG_ENABLED=true`
