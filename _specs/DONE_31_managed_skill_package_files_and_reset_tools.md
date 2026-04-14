# DONE 31: Managed Skill Package Files And Reset Tools

## Goal

Extend the managed-skills framework so Otto can ship richer skill packages with companion files under skill subfolders, while preserving a clear split between:

- canonical package defaults stored in the control plane
- runtime-local edits the agent can make on disk
- explicit user-initiated reset behavior from the workspace

This spec adds package-file lifecycle support for managed skills. It does not turn the managed-skills API into a general-purpose file editor.

## Why This Exists

Today managed skills are intentionally narrow:

- only `SKILL.md` is canonical and managed
- `references/`, `scripts/`, and `state/` exist only as runtime-local directories

That is too narrow for richer Otto-owned skills such as founder naming, where we want to ship:

- `SKILL.md` as the concise operational entrypoint
- deeper guides in `references/`
- starter helper scripts in `scripts/`
- optional example state snapshots or caches under `state/`

At the same time, we do **not** want automatic re-projection to silently destroy agent-authored runtime edits. The correct contract is:

- Otto can seed canonical package files once
- the agent can edit those files locally at runtime
- Otto does not auto-overwrite them during normal apply
- only a user-initiated reset from the workspace may restore canonical defaults

## Scope

- define the lifecycle model for managed skill package files beyond `SKILL.md`
- define which subfolders may contain control-plane-seeded files
- define the user-facing reset semantics
- define the runtime and workspace tools needed for inspection and reset
- define projection behavior for first install, normal apply, and explicit reset

## Non-Goals

- full control-plane editing of arbitrary companion files
- a general-purpose git-like sync or diff/merge workflow for skill packages
- automatic background reconciliation that overwrites local runtime edits
- binary asset management for v1
- catalog/install UX for uninstalled skills

## Dependencies

- `TODO_18_managed_skills.md`
- `TODO_29_name_and_domain_research_workflow.md`

## Product Intent

The user should be able to rely on three simple truths:

1. Otto-owned skills may ship with rich companion files.
2. Otto and the agent may edit those files locally in the runtime.
3. Otto will only restore the original package files when the user explicitly requests a reset in the workspace.

This keeps the system practical for agent work without making the control plane the editor for every file in the package.

## Package File Model

Each managed skill package continues to live at:

```text
workspace/skills/<skill-key>/
```

The package may include:

```text
workspace/skills/<skill-key>/
  SKILL.md
  references/
  scripts/
  state/
```

### File classes

The framework should distinguish three classes of files:

### 1. Managed entry file

- `SKILL.md`
- canonical in the control plane
- existing editability rules remain

### 2. Managed seeded companion files

Canonical defaults owned by Otto and projected into the runtime, but not editable through the managed-skills control-plane surfaces.

Allowed paths in v1:

- `references/**`
- `scripts/**`
- `examples/**`
- `templates/**`

These files may be edited locally by the agent at runtime, but they are considered resettable workspace defaults, not workspace-edited source of truth.

### 3. Runtime-local files

Files that exist only in the runtime and are never canonical in the control plane.

Always runtime-local:

- `state/**`

Optionally runtime-local:

- ad hoc files the agent creates under any allowed subfolder that were never part of the seeded package manifest

## Core Lifecycle Rules

### Install / first projection

On first install or first projection of a skill package:

- create the package root
- create standard directories if missing
- write `SKILL.md`
- write any seeded companion files from the canonical package definition

### Normal apply / reprojection

During normal apply:

- ensure required directories still exist
- ensure `SKILL.md` follows the current managed-skill rules
- do **not** overwrite seeded companion files that already exist
- do **not** delete runtime-local files
- do **not** silently reconcile local edits to seeded companion files

This is the critical behavior change from the current system-skill reseed model.

### Explicit reset

When the user triggers a skill reset from the workspace:

- overwrite seeded companion files with the canonical control-plane versions
- optionally restore `SKILL.md` if the selected reset mode includes it
- leave purely runtime-local files alone by default unless the reset mode explicitly includes local state cleanup

Reset is destructive and must be user-initiated.

## Reset Semantics

Reset should support explicit scopes rather than a single opaque action.

Recommended reset scopes:

- `companion_files`
  - resets seeded files under `references/`, `scripts/`, `examples/`, `templates/`
  - leaves `SKILL.md` unchanged
  - leaves `state/` unchanged

- `skill_entry_and_companion_files`
  - resets `SKILL.md` plus seeded companion files
  - leaves `state/` unchanged

- `full_package_except_state`
  - resets `SKILL.md` plus seeded companion files
  - removes runtime-local files in seeded companion folders that are not present in the canonical manifest
  - leaves `state/` unchanged

- `full_package_including_state`
  - everything above
  - also clears `state/`
  - should require stronger UI confirmation

Default recommended action for normal users:

- `companion_files`

## Canonical Manifest Model

The control plane should store a package manifest for skills that ship seeded companion files.

Conceptually:

```text
managed_skill_package_defaults
- skill_key
- source_type
- file_path
- file_class
- content_text
- content_sha256
- content_type
```

Or the same idea can be represented inside existing managed-skill version/file tables with explicit file policy metadata.

Each canonical seeded file should carry policy metadata such as:

- `fileClass`
  - `entry`
  - `seeded_companion`
  - `runtime_local`

- `projectionMode`
  - `install_if_missing`
  - `managed_entry`

- `resettable`
  - boolean

For v1, this can stay simple:

- `SKILL.md` uses the current managed-entry rules
- seeded companion files use `install_if_missing` on normal apply and `overwrite_on_reset`

## Workspace And Runtime Tools

This spec adds **reset and inspection tools**, not arbitrary file editing tools.

### Workspace-facing control-plane actions

The workspace should gain:

- `reset skill companion files`
- optional advanced reset modes for power users

Suggested API surface:

- `POST /api/workspace/:orgSlug/skills/:skillKey/reset`

Suggested request shape:

```json
{
  "scope": "companion_files",
  "expectedVersion": 3
}
```

Suggested response shape:

```json
{
  "skillKey": "name-and-domain-research",
  "resetQueued": true,
  "desiredStateVersion": 12
}
```

### Runtime plugin tools

The managed-skills runtime plugin should gain read/reset tools for package defaults.

Recommended additions:

- `list_managed_skill_package_files`
  - list canonical seeded files, local files, and file classes for one skill

- `get_managed_skill_package_file`
  - read one package file with its classification and provenance

- `reset_managed_skill_package`
  - queue a reset for one skill package with an explicit scope

These are lifecycle tools, not editing tools.

We should **not** add:

- `patch_managed_skill_package_file`
- `create_managed_skill_package_file`
- `delete_managed_skill_package_file`

through the control-plane-managed runtime plugin in v1.

The agent should continue to use normal file tools inside the runtime filesystem for local edits.

## File Classification Contract

When listing package files, each file should report:

- `path`
- `classification`
  - `managed_entry`
  - `managed_seeded`
  - `runtime_local`
- `existsInCanonicalPackage`
- `existsInRuntime`
- `locallyModified`
- `resettable`
- `contentType`
- `storageEncoding`

That gives the workspace and agent enough context to explain what reset will do.

## UI Plan

### Skill detail page

The skill detail page should eventually show:

- `SKILL.md`
- seeded companion files
- runtime-local files
- whether a file has diverged from Otto’s default

### Reset UX

The skill detail page should expose:

- `Reset companion files`
- optional advanced reset menu

The confirmation copy should state clearly:

- Otto will overwrite the shipped companion files for this skill
- agent edits to those files in the runtime will be lost
- local runtime state in `state/` will not be touched unless the user picks the stronger reset mode

## Projection And Worker Behavior

Worker/apply logic should change as follows:

### Current system-skill reseed behavior

Current behavior for system skills effectively re-seeds canonical content whenever Otto’s default content changes.

That is acceptable for `SKILL.md` today, but it is **not** acceptable for companion files under this new model.

### New behavior

For seeded companion files:

- on install: write canonical files
- on normal apply: preserve runtime copy if it already exists
- on explicit reset: overwrite runtime copy with canonical content

This requires package projection to become policy-aware per file instead of treating all canonical files as ordinary reconciliation targets.

## Suggested Implementation Shape

### Domain ownership

- worker/runtime package owns package projection and reset semantics
- `apps/api/src/skills` owns workspace HTTP routes and auth adapters
- `apps/web/src/features/skills` owns UI for reset and file presentation
- runtime plugin `otto-managed-skills` owns lifecycle tools for the runtime

### Code-level split

- package/file policy logic:
  - `apps/worker/src/runtime/lib/managed-skills/package.ts`
- projection/runtime sync:
  - `apps/worker/src/runtime/lib/runtime/manager.ts`
  - `apps/worker/src/runtime/db/managed-skills.ts`
- runtime HTTP handlers:
  - `apps/api/src/runtime/managed-skills-data.ts`
  - `apps/api/src/runtime/routes.ts`
- workspace skills HTTP:
  - `apps/api/src/skills/data.ts`
  - `apps/api/src/skills/routes.ts`
- runtime plugin:
  - `runtime-plugins/otto-managed-skills/index.js`

## Founder Naming Skill Follow-up

Once this substrate exists, `name-and-domain-research` should be refactored from a single large `SKILL.md` into:

- `SKILL.md`
- `references/naming-strategies.md`
- `references/full-guide.md`
- optionally starter helper files under `scripts/`

Those files should ship as seeded companion files and be resettable from the workspace.

## Acceptance Criteria

- managed skills may ship canonical seeded companion files under allowed subfolders
- normal apply does not overwrite locally edited seeded companion files
- users can explicitly reset one skill package from the workspace
- runtime plugin can inspect package file classification and queue a reset
- reset behavior is scope-aware and does not wipe `state/` by default
- agent can continue to edit companion files locally with normal file tools
- the founder naming skill can later be split into `SKILL.md` plus companion files without inventing a second skill model

## Status Checklist

- [x] define package-file policy metadata for companion files
- [x] extend managed-skill validation to allow canonical seeded files in allowed subfolders
- [x] update projection behavior to preserve local edits on normal apply
- [x] add workspace reset API and queued reset behavior
- [x] add runtime plugin inspection/reset tools
- [x] add workspace UI for reset and file provenance
- [x] migrate `name-and-domain-research` to use seeded companion files

## Open Questions

- Should `scripts/**` be allowed as canonical seeded defaults in v1, or should v1 start with `references/**` plus `templates/**` only?
- Should `SKILL.md` participate in the default reset action, or stay separate so users do not accidentally lose instruction edits?
- Should locally created files inside seeded folders be preserved by default even during `companion_files` reset?
- Do we want a lightweight divergence indicator based on content hash, modified timestamp, or both?
- Should runtime plugin reset actions always require an `expectedVersion`, or is the skill key enough for reset scopes that do not edit `SKILL.md`?
