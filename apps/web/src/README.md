# `apps/web/src` organization

Use this layout for new SPA work.

## Routing and shell

- Keep route registration centralized under `src/client/app/`.
- Use a dedicated route-tree file so the full SPA surface is visible in one place.
- Keep app shell code under `src/client/app/app-shell/`.
- App shell code includes:
  - app shell layout
  - global sidebar and header
  - settings shell and settings sidebar
  - workspace index-route helpers

## Features

- Organize browser code by bounded context under `src/features/<feature>/`.
- Current preferred top-level feature groups are:
  - `workspace`
  - `usage`
  - `billing`
- Treat `settings` as a shell/navigation area, not as a feature group for domain logic.

Suggested shape:

```text
src/
  client/
    app/
      router.tsx
      route-tree.tsx
      app-shell/
        AppShell.tsx
        AppSidebar.tsx
        AppHeader.tsx
        SettingsShell.tsx
        SettingsSidebar.tsx
        WorkspaceIndexPage.tsx
  features/
    workspace/
      pages/
      components/
      api/
      types.ts
    usage/
      pages/
      components/
      api/
      types.ts
    billing/
      pages/
      components/
      api/
      types.ts
```

## Pages

- Each page component should live in its own file.
- Route registration should import page components from their feature folders.
- Do not bury page components inside the central route file.

## React file conventions

- Define component props in the same file.
- Put props definitions near the top of the file.
- Use exported `interface` declarations for component props.
- Export components as named exports only.
- Do not use default exports for components.
- Prefer named imports over namespace imports for local application code.

## PR review

Before opening a PR for SPA work, review the branch against this file and `AGENTS.md`:

- routes are centralized
- shell code stays in the app-shell area
- pages are grouped by feature
- no new catch-all `settings` feature folder was introduced for domain logic
- component files follow the props/export/import conventions
