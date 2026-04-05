# Otto Marketing Site Status

## Current state

- The repo currently has one production Next.js app in `web/` for the workspace experience.
- Root scripts are still `web/`-centric, so adding a public site should be treated as a monorepo step rather than a page inside the existing app.
- The current workspace theme already provides useful brand direction for the public site:
  - warm orange primary accents
  - soft radius scale
  - light and dark theme support through `next-themes`
- A separate `www/` app is now the recommended direction for the public website.
- No marketing-site app has been scaffolded yet.

## Product target

- Ship a minimal public website for `getyourotto.com` that explains Otto clearly, looks polished in light and dark mode, and drives visitors into the workspace signup flow.
- Keep the first release intentionally small while laying the groundwork for PostHog-backed experimentation.

## First-release scope

- standalone Next.js app in `www/`
- shared visual direction with the workspace app, but without premature shared-package extraction
- one polished homepage with minimal supporting navigation
- PostHog analytics on the same project as the workspace app
- first experiment surface centered on homepage CTA and hero framing

## Recommended IA for v1

- `/` home
- `/pricing`
- `/security`
- `/login` or direct link to `app.getyourotto.com/login`

Defer until after the first release:

- blog
- changelog
- comparison pages
- enterprise page
- broader CMS work

## Measurement direction

- Primary metric: signup start rate from public-site visitors.
- Secondary metrics:
  - homepage primary CTA click-through rate
  - pricing-page visit rate
  - signup completion rate
  - contact/demo request rate if a sales CTA is introduced
- Guardrail metrics:
  - bounce or low-engagement session rate
  - Core Web Vitals by device class
  - major variant regressions in mobile conversion

## Next recommended step

- Start `TODO_00_www_foundation_and_theme.md`.
- Decide the app directory name and keep it `www/` unless deployment constraints strongly prefer another label.
- Scaffold the app only after the spec is accepted, then mirror the current workspace baseline where it helps:
  - Next.js app router
  - Tailwind v4
  - shadcn
  - `next-themes`
  - Biome
  - PostHog client/server setup

## Open questions

- Should the public site and workspace app share a root workspace manager now, or should root scripts stay simple and add monorepo tooling only when `www/` exists?
- Should pricing live on day one, or should v1 keep pricing inline on the homepage until billing language is more stable?
- Which public CTA should be primary at launch: self-serve signup, waitlist, or book demo?
