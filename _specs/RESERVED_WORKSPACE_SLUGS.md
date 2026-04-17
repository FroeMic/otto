# Reserved Workspace Slugs

These top-level paths are protected so a workspace slug cannot collide with:

- public landing and marketing routes
- documentation and status routes
- system and auth namespaces used by the unified frontend and extracted API

The code source of truth lives in [`packages/features/workspace-slugs/src/index.ts`](../packages/features/workspace-slugs/src/index.ts).

## System namespaces

- `api`
- `api-docs`
- `app`
- `auth`
- `ingest`
- `login`
- `logout`
- `oauth`
- `platform`
- `status`
- `webhooks`

## Public namespaces

- `about`
- `agents`
- `android`
- `asks`
- `blog`
- `brand`
- `build`
- `careers`
- `change`
- `changelog`
- `contact`
- `customers`
- `developers`
- `docs`
- `download`
- `dpa`
- `features`
- `fm`
- `insights`
- `integrations`
- `ios`
- `method`
- `mobile`
- `now`
- `plan`
- `pricing`
- `privacy`
- `quality`
- `readme`
- `releases`
- `security`
- `startups`
- `switch`
- `terms`

## Enforcement points

- workspace creation during onboarding
- workspace slug updates in settings
- automatic slug generation from external organization names

## Why this exists

- landing-page-first cutover needs predictable top-level public routing
- the long-term unified origin needs stable public and system namespaces
- route collisions should fail early and consistently instead of creating ambiguous URLs
