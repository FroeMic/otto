# TODO 33: Skill Library And Installed Skills UX

## Goal

Redesign the workspace Skills product surface so it cleanly separates:

- the skill library of reusable template skills
- the list of skills installed in a workspace
- the file/package internals of one installed skill

The resulting UX should match the actual product model:

- a workspace agent can discover and install reusable skills from a library
- users can also install or remove those library skills from the web UI
- installed skills may be either:
  - library-backed and resettable
  - custom and not resettable
- file-level package details are an advanced detail view of one installed skill, not the primary product concept

The UX and copy should be brand-agnostic and should not depend on the name `Otto`.

## Scope

- redesign information architecture for the workspace Skills surface
- define product terminology for:
  - library skills
  - installed skills
  - custom skills
  - built-in or required skills where applicable
  - template defaults vs installed files vs runtime-local files
- define required API contract changes to support a real skill library/install model
- define route structure and page composition for the web app
- define how the agent should discover, install, remove, and reset skills through runtime tools
- define migration steps from the current “single managed skills list” UI

## Explicit Non-Goals

- implementing a marketplace with external publishing or billing
- changing the underlying OpenClaw filesystem skill model
- rewriting the managed-skills substrate again
- introducing arbitrary control-plane editing for companion files
- changing naming or DNS workflow semantics in this same increment

## Why This Needs Its Own Spec

The current workspace Skills UI conflates three different layers:

1. installed skill instances in a workspace
2. reusable template skills that should be discoverable and installable
3. runtime/package file internals for one installed skill

As a result:

- the current list page reads like an editor for low-level managed packages
- library-backed skills and custom skills are mixed together with backend provenance labels
- file/package concepts such as `seeded companion files` and `SKILL.md` are overexposed in the main workflow
- the top-level page has no proper library surface at all

This is primarily an information-architecture and separation-of-concerns problem, not a visual-polish problem.

## Product Model

The correct product split is:

### 1. Skill library

A library contains reusable template skills that may be relevant for a workspace agent.

Properties:

- discoverable even if not installed
- inspectable before install
- installable by:
  - the user in the workspace
  - the agent through runtime tools
- removable from the workspace later if not needed

Examples:

- `name-and-domain-research`
- future packaged starter skills contributed by integrations or platform defaults

### 2. Installed skills

Installed skills are what the workspace agent currently has available.

Installed skills have an origin:

- `from_library`
- `custom`
- optionally `built_in` or `required` if the product later needs non-removable defaults

Installed skills may also have capabilities such as:

- editable instructions
- removable
- resettable to library defaults

### 3. Skill package files

Package files are an advanced view of one installed skill.

This includes:

- the entry instructions file
- template/default companion files
- runtime-local files projected into the runtime

This is not a top-level product category. It is a detail surface under one installed skill.

## UX Separation Of Concerns

### Top-level workspace page

The top-level Skills area should have two first-class surfaces:

1. `Installed`
2. `Library`

The current single-page “managed skills” list should be replaced or evolved into this split.

### Installed view

The Installed view should answer:

- what skills are available to the workspace agent right now?
- where did each one come from?
- can I remove it?
- can I restore it to defaults?
- is it ready, disabled, or blocked by prerequisites?

This view should not foreground package-internal language.

### Library view

The Library view should answer:

- what reusable skills are available to install?
- what is each skill for?
- what dependencies does it need?
- is it already installed?

This is where template skills belong. The current UI has no proper equivalent.

### Installed skill detail

Installed skill detail should separate:

1. overview/status
2. instructions
3. files
4. restore/remove actions

The current `Status` tab mixes all of those concerns together.

## Product Language

The UI should use brand-agnostic terms.

Preferred terms:

- `Skill library`
- `Installed`
- `From library`
- `Custom`
- `Built in`
- `Required`
- `Restore defaults`
- `Instructions`
- `Files`
- `Available to the agent`
- `Installed in this workspace`

Avoid:

- `Otto provided`
- `System managed`
- `Workspace managed`
- `Integration starter`
- `managed SKILL.md metadata`
- `seeded companion files`
- `runtime projection`

Those are implementation or backend terms, not user-facing concepts.

## Information Architecture Recommendation

### Routes

Recommended workspace routes:

- `/$orgSlug/skills`
  - default redirect to `/$orgSlug/skills/installed`
- `/$orgSlug/skills/installed`
- `/$orgSlug/skills/library`
- `/$orgSlug/skills/$skillKey`
  - default redirect to `overview`
- `/$orgSlug/skills/$skillKey/overview`
- `/$orgSlug/skills/$skillKey/instructions`
- `/$orgSlug/skills/$skillKey/files`

Possible later route:

- `/$orgSlug/skills/library/$skillKey`
  - inspect template details before install

### Installed skills list

Each installed skill row/card should show:

- display name
- short description
- lifecycle badge:
  - `From library`
  - `Custom`
  - `Built in`
- status badge:
  - `Ready`
  - `Needs setup`
  - `Missing dependency`
  - `Disabled`
- concise actions:
  - open
  - remove if removable
  - restore defaults if library-backed and resettable

Do not show backend provenance labels directly.

### Library list

Each library skill row/card should show:

- display name
- what it helps with
- required integrations
- whether already installed
- install CTA

If already installed:

- show `Installed`
- allow open detail instead of install

### Skill detail layout

#### Overview

Show:

- description
- origin: `From library`, `Custom`, `Built in`
- status
- dependencies
- high-level actions:
  - install or remove
  - restore defaults if applicable

#### Instructions

Show:

- editable instruction body for custom/editable skills
- read-only instruction view for non-editable installed skills

This page should focus on the actual instructions, not package provenance.

#### Files

This should be explicitly advanced.

Separate visually:

- template/default files
- current runtime-visible files
- runtime-local or modified files if detectable

This is where file- and package-level details belong.

## Data Model Implications

The current data model is still biased toward one concept:

- a managed skill record in `tenant_skills`

The UX now needs two product-level concepts:

1. library entries
2. installed workspace skills

Recommended product contract:

### Library entry

Add a library-facing read model with fields such as:

- `skillKey`
- `displayName`
- `description`
- `origin`
- `templateAvailable`
- `dependencies`
- `installed`
- `resettable`
- `removable`

For the first pass, the library may be derived from the canonical system/template definitions rather than a separate DB table.

### Installed skill

Installed skills should expose product-facing fields such as:

- `skillKey`
- `displayName`
- `description`
- `origin`
  - `from_library`
  - `custom`
  - `built_in`
- `status`
- `editable`
- `removable`
- `resettable`
- `installedAt` or `updatedAt`

The UI should not need to infer these from `sourceType` and `fileClass`.

### File-level detail

Keep file metadata, but demote it to the detail/files surface.

User-facing fields should be closer to:

- `role`
  - `instructions`
  - `template_file`
  - `runtime_file`
- `resettable`
- `modifiedFromDefault` if detectable

The backend may still map these from `fileClass`, but the UI should not expose backend names directly.

## Runtime And Agent Surface

The runtime tools should reflect the same product split.

### Skill library tools

Add or evolve toward:

- `list_skill_library`
- `get_skill_library_entry`
- `install_skill_from_library`
- `remove_installed_skill`

### Installed skill tools

Keep or evolve:

- `list_managed_skills`
- `get_managed_skill`
- `create_managed_skill`
- `update_managed_skill`
- `delete_managed_skill`
- `reset_managed_skill_package`

The agent should be able to:

- discover template skills
- install a useful skill when needed
- remove a no-longer-needed skill later
- distinguish custom skills from library-backed ones

That aligns with the user requirement that the agent itself can discover and install relevant skills into the system when needed.

## Current UX Problems To Address

### Problem 1: no library surface

The current page only lists installed skills and treats creation as the primary top-level action.

Required fix:

- add a real library view
- make install/remove workflows first-class

### Problem 2: backend provenance labels leak into the UI

The current labels such as `System managed` and `Workspace managed` describe implementation, not user meaning.

Required fix:

- replace them with product labels such as `From library` and `Custom`

### Problem 3: detail page is overloaded

The current status page mixes:

- status
- editing
- provenance
- package maintenance

Required fix:

- split overview, instructions, and files

### Problem 4: file/package internals are too prominent

The current UI foregrounds:

- `SKILL.md`
- canonical package files
- seeded companion files

Required fix:

- move these to advanced/detail contexts
- use product language at the top level

### Problem 5: restore/reset semantics are unclear

Users should think in terms of:

- restoring a library-installed skill to defaults

not:

- resetting seeded companion files

Required fix:

- make reset a skill-level action
- explain what gets restored in user terms

## Proposed Increment Sequence

### Slice 1: terminology and IA cleanup on current installed-skills surface

- rename current labels and copy
- split `Status` into:
  - `Overview`
  - `Instructions`
  - `Files`
- move package/provenance content out of the primary editor framing
- change reset language to `Restore defaults` where appropriate

This is the smallest high-value UX fix.

### Slice 2: add a library view

- add `Installed` and `Library` tabs/routes
- expose library-backed skills separately from installed custom skills
- support install/remove actions from UI

### Slice 3: align runtime/agent tools

- expose library discovery/install/remove semantics to the agent
- keep file/package tools as a lower-level surface

### Slice 4: advanced files/provenance UX

- show default vs current files more clearly
- add modified-from-default indicators if possible
- add an inspect-before-install library detail page for reusable skills

## Implementation Notes

- Keep the canonical skill-definition source shared, not worker-only.
- Avoid introducing another separate package lifecycle concept unless needed.
- Prefer deriving the first library view from canonical system/template skill definitions already in the repo.
- Keep `tenant_skills` as the installed-state substrate.
- Do not conflate runtime file browsing with the install/remove lifecycle.
- Do not use brand-specific nouns in user-facing labels.

## Acceptance Criteria

- the workspace Skills area clearly separates library skills from installed skills
- users can distinguish library-backed skills from custom skills immediately
- users can install and remove library skills from the web UI
- the agent can discover and install library skills through runtime tools
- reset is presented as restoring defaults for library-backed installed skills
- file/package internals are no longer the primary top-level concept
- user-facing labels are brand-agnostic and implementation-agnostic

## Status Checklist

- [x] define product terminology for library vs installed skills
- [x] redesign top-level skills IA into `Installed` and `Library`
- [x] redesign installed skill detail into `Overview`, `Instructions`, and `Files`
- [x] add the first library-facing API contract for visible library skills
- [x] add install/remove flows for library-backed skills in the web UI
- [x] align runtime/agent tools with library vs installed skill lifecycle
- [x] simplify restore/reset language to skill-level defaults terminology
- [x] audit all skill-surface copy for brand neutrality and implementation leakage
- [x] add a library skill detail page with dependencies, included files, and instructions preview
- [x] improve the files page so it separates included package files from runtime-only files

## Open Questions

- `skill-creator` and other non-user-invocable helper skills should stay hidden from both `Library` and `Installed` user surfaces for now while remaining available internally to the runtime.
- Which current system skills should be removable versus always installed?
- Should “built-in” be a separate origin or only a `removable=false` property?
- How much of the library should be DB-backed versus derived from canonical code definitions in the first pass?
- Should integration-contributed starter skills appear directly in the library, or under the related integration detail pages first?
- Do we want a future modified-from-default signal based on file contents, not just path/provenance separation?
