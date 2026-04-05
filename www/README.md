# Otto public site

This is Otto's public website app.

## Local env

Copy the example file if you want to enable browser analytics locally:

```bash
.env.example -> .env.local
```

Available variables:

- `NEXT_PUBLIC_POSTHOG_ENABLED`
- `NEXT_PUBLIC_POSTHOG_HOST`
- `NEXT_PUBLIC_POSTHOG_TOKEN`

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
