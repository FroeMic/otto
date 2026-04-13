# TODO 25: App Shell Layout And Notifications

## Goal

Adopt the useful shell mechanics from `froemic-react-app-shell` into Otto so the app has:

- stable viewport-owned height
- explicit scroll ownership
- shell-level in-flow notifications
- a reusable page-frame layout primitive
- a consistent header and content rhythm across workspace, settings, and platform shells

This work should preserve Otto's current sidebar visual language and keep the sidebar toggle permanently available in the main app header.

## Scope

- add a shared shell viewport wrapper for the SPA shells in `apps/web`
- add a shell-level notification provider, queue, registry, and renderer
- add a reusable page-frame primitive with:
  - header
  - main scroll region
  - optional aside
  - optional footer
- adopt the new shell viewport in:
  - workspace shell
  - settings shell
  - platform shell
- keep the current Otto sidebar styling and current sidebar state model
- define explicit scroll-container rules for:
  - outer shell
  - sidebar conversation history
  - page main content
  - optional page aside

## Out of scope

- do not port the reference app's sidebar visual styling
- do not port the reference app's desktop sidebar width resize behavior yet
- do not port the reference app's demo or product-specific page layouts
- do not replace Sonner toasts; shell notifications are an additional surface, not a replacement
- do not redesign feature pages beyond adopting the new page-frame primitive where it improves consistency

## Dependencies

- `TODO_20_unified_frontend_and_hono_migration.md`
- `DONE_24_web_codebase_contraction.md`

## Why this work exists

The current Otto SPA shell works, but the layout logic is still flatter than it should be:

- viewport height and inner scroll ownership are implicit rather than shell-owned
- notifications are toast-only and not suited for shell-level system notices
- workspace, settings, and platform shells share concepts but not enough reusable shell infrastructure
- page headers and content framing are still more ad hoc than they should be

The reference repo `froemic-react-app-shell` solves the correct problems:

- bounded shell viewport
- in-flow shell notifications
- explicit scroll-region ownership
- reusable page-frame structure

Otto should port those mechanics while keeping Otto's own visual design.

## Product principles

- keep the current Otto sidebar feeling visually inset and in the background of the app
- keep the sidebar toggle permanently visible in the main app header
- do not add a second competing notification system for the same use case:
  - Sonner remains for local ephemeral toasts
  - shell notifications are for in-flow workspace-level notices
- favor CSS layout over JS measurement for height calculations
- use explicit scroll owners rather than allowing document scroll to emerge accidentally

## Target shell model

```text
ShellViewport
├─ ShellNotificationCenter        auto height, normal flow
└─ ShellStage                     flex-1 min-h-0
   ├─ Sidebar surface             fixed shell child
   │  ├─ header                   fixed
   │  ├─ middle history           scroll owner
   │  └─ footer                   fixed
   └─ Main surface                fixed shell child
      ├─ App header               fixed
      └─ PageFrame
         ├─ PageFrameHeader       fixed within page
         ├─ PageFrameMain         main page scroll owner
         ├─ PageFrameAside        optional independent scroll owner
         └─ PageFrameFooter       optional fixed footer
```

## Scroll ownership rules

### Shell level

- `ShellViewport` must use `h-dvh min-h-dvh overflow-hidden`
- `ShellStage` must use `flex-1 min-h-0`
- the document body should not be the primary scroll container for authenticated app surfaces

### Sidebar

- sidebar header is fixed
- conversation history is the scroll owner
- sidebar footer is fixed

### Main surface

- shell app header is fixed
- `PageFrameMain` is the default scroll owner
- `PageFrameAside` is an optional independent scroll owner
- no page should rely on document scroll unless explicitly justified

## Notification model

Otto needs a shell-owned notification center that renders in normal shell flow above the app stage.

### Conceptual split

- `ShellNotificationProvider`
  - owns queue state and imperative API
- `notification-queue`
  - pure queue reducer logic
- `notification-registry`
  - maps notification kind to renderer
- `ShellNotificationCenter`
  - renders the current notification using the registry

### Notification contract

Notifications should be modeled by kind, not by one giant flexible blob.

Examples:

- `sync-status`
- `runtime-warning`
- `integration-connection`

The registry should allow future shell-level notices to render without hardcoding all variants into one monolith.

### Relationship to Sonner

- keep Sonner for:
  - local mutation success/failure feedback
  - page-local ephemeral notices
- use shell notifications for:
  - workspace-level sync state
  - runtime state warnings
  - global notices that should visibly affect the shell layout

## Page-frame model

Otto should add a neutral page-frame primitive for consistent page composition.

### Shape

```text
PageFrame
├─ PageFrameHeader
├─ PageFrameBody
│  ├─ PageFrameMain
│  └─ PageFrameAside (optional)
└─ PageFrameFooter (optional)
```

### What it provides

- consistent page header rhythm
- explicit main scroll ownership
- optional right aside support
- optional footer support
- stable layout under shell notifications and bounded shell height

### Good adoption targets

- session detail pages
- skill detail pages
- scheduled-task detail pages
- settings detail pages
- workspace conversation detail later, if it benefits from it

## Code placement

Shell-only browser code should stay in `apps/web/src/client/app/app-shell`.

### New structure

```text
apps/web/src/client/app/app-shell/
  ShellViewport.tsx
  ShellStage.tsx

  frame/
    PageFrame.tsx

  notifications/
    ShellNotificationProvider.tsx
    ShellNotificationCenter.tsx
    notification-queue.ts
    notification-registry.ts
    notification-types.ts

  WorkspaceShell.tsx
  SettingsShell.tsx
  PlatformShell.tsx
```

### Why here

- this is browser-only shell infrastructure
- it is shared by multiple app shells
- it is not product-domain feature logic
- it should not live in `packages/` or in any one feature folder

### Keep feature pages in feature folders

Do not move page-specific logic into the shell just because it consumes the new layout primitives.

## Otto-specific design decision

### Port from the reference shell

- bounded shell viewport behavior
- in-flow notification center behavior
- page-frame behavior
- explicit scroll-owner model

### Keep Otto-native

- sidebar styling
- nav hierarchy
- shell colors and spacing language
- current shadcn-based sidebar primitives

### Defer

- custom desktop sidebar resize behavior
- sidebar width persistence beyond the existing open/collapsed behavior
- demo page visuals from the reference repo

## Implementation phases

### Phase 1: shared shell viewport

Add:

- `ShellViewport`
- `ShellStage`

Adopt in:

- `WorkspaceShell`
- `SettingsShell`
- `PlatformShell`

Requirements:

- keep current sidebar visuals
- keep current `SidebarTrigger` in the shell header
- establish explicit `min-h-0`, `flex-1`, and `overflow-hidden` boundaries

Expected outcome:

- stable viewport height
- reliable inner scroll behavior
- no meaningful product-UI redesign

### Phase 2: shell notification center

Add:

- `ShellNotificationProvider`
- `notification-queue`
- `notification-types`
- `notification-registry`
- `ShellNotificationCenter`

Mount in:

- shared shell viewport

Requirements:

- notifications render in normal flow above the app stage
- no UI producers are required yet
- Sonner remains intact

Expected outcome:

- shell can render persistent or semi-persistent notices without toast abuse

### Phase 3: page-frame primitive

Add:

- `PageFrame`
- `PageFrameHeader`
- `PageFrameBody`
- `PageFrameMain`
- `PageFrameAside`
- `PageFrameFooter`

Adopt first on the pages that benefit most from stable internal layout.

Expected outcome:

- consistent page header/body/footer rhythm
- optional aside support without layout hacks

### Phase 4: targeted adoption pass

Apply the new page-frame pattern where it improves consistency and reduces bespoke page structure.

Initial target candidates:

- sessions detail
- skills detail
- scheduled-task detail
- selected settings detail pages

This phase should remain selective. Do not churn every page just for symmetry.

## Acceptance criteria

- authenticated app shells use a shared bounded shell viewport
- shell notifications can render in normal flow above the app stage
- the main app header keeps a persistent sidebar toggle
- sidebar history remains the sidebar scroll owner
- feature pages can adopt a shared page-frame primitive for consistent layout
- no page depends on document scroll by accident
- Otto sidebar visuals remain Otto-native
- no shell infrastructure is placed in a product feature folder or shared runtime package

## Status checklist

- [ ] Phase 1 shell viewport implemented
- [ ] Workspace shell adopted
- [ ] Settings shell adopted
- [ ] Platform shell adopted
- [ ] Phase 2 notification center implemented
- [ ] Notification registry introduced
- [ ] Phase 3 page-frame primitive implemented
- [ ] First detail pages migrated to `PageFrame`
- [ ] Scroll ownership verified across workspace, settings, and platform shells

## Open questions

- Which first page should adopt `PageFrame` after the primitive lands: session detail, scheduled-task detail, or skill detail?
- Should shell notifications remain single-banner-only at first, or support stacked queued notices from day one?
- Do we want shell notifications to support action buttons in the first pass, or remain informational-only until a real use case appears?
