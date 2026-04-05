# TODO 00: WWW Foundation And Theme

## Goal

Create the standalone public-site app shell under `www/` with the right baseline tooling, theming, and repo integration.

## Scope

- choose the app directory and keep it isolated from `web/`
- scaffold a standalone Next.js app
- align baseline tooling with the existing repo where practical
- bring over the Otto visual foundations needed for a warm, soft, rounded public site
- prepare local-only Magic UI usage for prototyping

## Dependencies

- none

## Implementation notes

- Prefer `www/` as the directory name because the site is likely to become more than a single landing page.
- Keep `web/` and `www/` as separate apps from day one.
- Do not extract a shared UI package in this step.
- Reuse only the minimum viable design primitives from `web/`:
  - color tokens
  - radius scale
  - theme provider setup
  - typography choices if they still fit the public-site voice
- Add shadcn to `www/` directly instead of importing `web/` components across app boundaries.
- Add Magic UI registry support only through local configuration. Do not commit credentials.
- Update root scripts after scaffold so local development can target both apps cleanly.

## Acceptance criteria

- `www/` exists as its own Next.js app
- `www/` has its own `package.json`, `components.json`, and app-level `spec/` folder
- light and dark mode both work
- the visual tokens clearly match Otto's current warm brand direction
- the repo has root scripts for `www` alongside the existing `web` scripts

## Status checklist

- [ ] decide final public-site directory name
- [ ] scaffold the standalone Next.js app
- [ ] install and configure shadcn
- [ ] mirror theme primitives from `web/`
- [ ] add `next-themes`
- [ ] set up Biome or equivalent formatting/linting to match repo standards
- [ ] prepare local-only Magic UI registry configuration
- [ ] add root scripts for `dev:www`, `build:www`, and `lint:www`

## Open questions

- Should the root repo adopt Bun workspaces immediately when `www/` is created, or should that wait until shared code actually appears?
- Should the public site use the exact workspace font stack, or a slightly more editorial heading font while keeping the same color system?
