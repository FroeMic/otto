# TODO 31: Skill Library Structure And Naming Skill Rollout

## Goal

Capture the implementation plan for three linked changes:

1. add managed skill package-file and reset functionality
2. restructure Otto-owned skills into a clean per-skill library layout
3. implement the founder naming skill as a rich packaged skill instead of one large inline `SKILL.md`

This spec is intentionally separate from `TODO_30`.

- `TODO_30` defines the substrate and lifecycle model
- this spec defines the practical implementation sequence and code organization for rolling it out

## Scope

- sequence the package-file/reset functionality from `TODO_30`
- define the target directory structure for Otto-owned seeded skills
- define how `name-and-domain-research` should move from inline content to a packaged skill
- define the implementation order so we do not mix framework work and product content in one unreviewable change

## Non-Goals

- inventing an installable skill catalog
- moving skills into a shared package before there is real cross-surface reuse
- changing the user-facing skill product model beyond what is required for richer packaged skills
- broadening the control-plane API into arbitrary companion-file editing

## Dependencies

- `TODO_18_managed_skills.md`
- `TODO_29_name_and_domain_research_workflow.md`
- `TODO_30_managed_skill_package_files_and_reset_tools.md`

## Why This Needs Its Own Spec

There are three different kinds of work here:

1. substrate changes to managed skill packages
2. code organization cleanup for Otto-owned seeded skills
3. product content for the founder naming skill

If they are done ad hoc, the likely failure modes are:

- too much implementation concentrated in `system-skills.ts`
- companion-file substrate added without a real consumer
- the naming skill content landing before the file lifecycle is stable
- `_specs` falling behind the actual implementation order

This spec keeps those changes explicit and reviewable.

## Current State

Today Otto-owned seeded skills are defined inline in:

- `apps/worker/src/runtime/lib/managed-skills/system-skills.ts`

That file currently acts as:

- registry
- content owner
- markdown builder

That is acceptable for one small system skill, but not for a growing Otto-owned skill library.

Current founder naming state:

- `name-and-domain-research` exists as a seeded system skill
- its content currently lives inline in `system-skills.ts`
- the current managed-skills framework does not yet support canonical companion files under `references/`, `scripts/`, `examples/`, or `templates/`

## Target Architecture

### 1. Substrate

Managed skills should support:

- `SKILL.md`
- canonical seeded companion files in approved subfolders
- runtime-local edits
- explicit workspace reset

That substrate is defined by `TODO_30`.

### 2. Code organization

Otto-owned seeded skills should move into a per-skill library layout:

```text
apps/worker/src/runtime/lib/managed-skills/
  system-skills.ts
  library/
    skill-creator/
      index.ts
      skill-content.ts
    name-and-domain-research/
      index.ts
      skill-content.ts
      references/
      scripts/
      templates/
```

The key rule:

- `system-skills.ts` should become a thin registry only

It should import skill definitions rather than storing long content bodies itself.

### 3. Naming skill package

The founder naming skill should become a proper packaged skill:

```text
name-and-domain-research/
  SKILL.md
  references/naming-strategies.md
  references/full-guide.md
  references/setup.md
  scripts/generate_variants.py       (optional in the first pass)
  templates/output-shape.json        (optional)
```

Examples in the skill package should use:

- `ramp`

and should not use:

- `vertical`

## Implementation Plan

## Phase 1: Add the package-file/reset functionality

This phase implements `TODO_30`.

### Deliverables

- package-file policy metadata for managed skills
- validation for seeded companion files in approved subfolders
- projection behavior that preserves local edits on normal apply
- explicit workspace reset API
- runtime plugin inspection and reset tools

### Main code areas

- `apps/worker/src/runtime/lib/managed-skills/package.ts`
- `apps/worker/src/runtime/db/managed-skills.ts`
- `apps/worker/src/runtime/lib/runtime/manager.ts`
- `apps/api/src/runtime/managed-skills-data.ts`
- `apps/api/src/runtime/routes.ts`
- `apps/api/src/skills/data.ts`
- `apps/api/src/skills/routes.ts`
- `runtime-plugins/otto-managed-skills/index.js`
- `apps/web/src/features/skills/*`

### Exit criteria

- seeded companion files can exist canonically
- normal apply does not overwrite runtime edits to those files
- user can explicitly reset one skill package from the workspace

## Phase 2: Restructure Otto-owned skill definitions

This phase is a code-organization refactor after the substrate exists.

### Deliverables

- a per-skill library directory for Otto-owned seeded skills
- `system-skills.ts` reduced to a registry
- a shared internal seeded-skill definition type

### Recommended structure

```text
apps/worker/src/runtime/lib/managed-skills/
  system-skills.ts
  types.ts                        (optional)
  library/
    skill-creator/
      index.ts
      skill-content.ts
      skill.test.ts
    name-and-domain-research/
      index.ts
      skill-content.ts
      skill.test.ts
```

### Rules

- each skill owns its own content and companion files
- shared helper types stay near the managed-skills substrate, not duplicated per skill
- tests live next to the skill they verify
- `system-skills.ts` contains no long markdown bodies

### Exit criteria

- Otto-owned skill definitions are no longer centralized in one monolithic file
- adding a second or third rich system skill does not require editing a giant string registry

## Phase 3: Implement the founder naming skill as a packaged skill

This phase uses the new substrate and the new directory structure.

### Deliverables

- `name-and-domain-research` moved out of inline `system-skills.ts`
- concise operational `SKILL.md`
- deeper guidance in companion docs
- dependency metadata on:
  - `brave`
  - `gandi`

### Planned content split

`SKILL.md`
- concise when-to-use guidance
- dependency notes
- step-by-step workflow
- how to interpret Gandi status fields

`references/naming-strategies.md`
- naming approaches
- phonetic heuristics
- industry patterns

`references/full-guide.md`
- scoring system
- output contract
- worked examples

`references/setup.md`
- dependency expectations
- optional helper script notes

Optional follow-up:

- `scripts/generate_variants.py`
- `templates/output-shape.json`

### Exit criteria

- the skill is materially more useful than a single giant markdown blob
- the package demonstrates the intended companion-file lifecycle end to end

## Testing Plan

### Phase 1 tests

- package validation for approved companion subfolders
- projection behavior:
  - install writes files
  - normal apply preserves runtime edits
  - reset restores canonical defaults
- runtime plugin inspection/reset tests
- workspace API reset tests

### Phase 2 tests

- registry tests for `SYSTEM_MANAGED_SKILL_DEFINITIONS`
- per-skill definition tests
- no regression in seeded system-skill discovery

### Phase 3 tests

- naming skill dependency metadata
- presence of companion files in canonical package
- use of `ramp` examples
- no `vertical` examples

## Recommended Commit Sequence

Keep this work in focused commits:

1. package-file policy and validation
2. projection behavior and reset plumbing
3. runtime plugin inspection/reset tools
4. workspace API/UI reset flow
5. `system-skills.ts` refactor into `library/`
6. migrate `skill-creator`
7. migrate `name-and-domain-research`
8. add optional starter scripts/templates if still justified

## Acceptance Criteria

- the managed-skills framework supports seeded companion files and explicit reset
- Otto-owned seeded skills live in a clean per-skill library structure
- `system-skills.ts` is a registry, not a monolith
- `name-and-domain-research` ships as a packaged skill with companion docs
- the runtime and workspace make reset semantics explicit to the user

## Status Checklist

- [ ] implement the package-file/reset substrate from `TODO_30`
- [ ] refactor Otto-owned seeded skills into `managed-skills/library/`
- [ ] make `system-skills.ts` a thin registry
- [ ] migrate `skill-creator` into the new structure
- [ ] migrate `name-and-domain-research` into the new structure
- [ ] split the naming skill into `SKILL.md` plus companion docs
- [ ] add tests that verify the packaged skill shape and reset behavior

## Open Questions

- Should `skill-creator` also gain companion files immediately, or stay simple until the substrate has been proven with the naming skill first?
- Should `scripts/generate_variants.py` be part of the first naming package rollout, or should the first pass stop at `references/` files only?
- Should reset UI live directly on the skill status page first, or behind an advanced actions menu?
