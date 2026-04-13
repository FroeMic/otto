# TODO 18: Managed Skills

## Executive Summary

This spec defines how managed Otto should support `Skills` as a first-class, workspace-managed concept while staying fully native to OpenClaw's filesystem-based skill model.

The key decisions are:

- Every skill visible in the Otto workspace should correspond to a managed control-plane record. Otto-managed runtimes should not rely on unmanaged workspace skills as a supported product path.
- A managed skill is a filesystem package rooted at `workspace/skills/<skill-key>/`.
- Every skill is anchored by `SKILL.md`.
- `SKILL.md` is the only Otto-managed file in the skill package.
- Otto should always create `references/`, `scripts/`, and `state/` inside each projected skill package.
- `references/`, `scripts/`, and `state/` are runtime-local writable directories, not control-plane-managed source of truth.
- `state/` is the reserved directory for local runtime state created by the agent or tools.
- Skills may declare dependencies on integrations, but they do not create tools and they do not own integration setup.
- Managed skill files are stored canonically in the control plane and projected into the tenant runtime.
- Users and Otto should both be able to view managed skill packages through workspace-managed APIs.
- Only `SKILL.md` should be editable through an explicit managed editing flow.
- Split skill documentation should live under `references/` and be referenced from `SKILL.md`.
- `state/` should be visible, previewable when text-like, downloadable, and read-only in the workspace and runtime-managed UI, while remaining runtime-writable on disk.
- OpenClaw should discover these skills natively from `workspace/skills` without Otto-specific changes to the upstream skill loader.
- Otto should explicitly control which upstream bundled skills remain visible to end users, and override same-named bundled skills in `workspace/skills` when Otto needs a workspace-specific system version.
- Otto should manage the lifecycle of workspace-visible skills, while OpenClaw continues to own native loading, precedence, gating, prompt visibility, and on-demand reading behavior.
- The managed-skills runtime plugin should stay narrow and lifecycle-oriented: `list_managed_skills`, `get_managed_skill`, `create_managed_skill`, `update_managed_skill`, and `delete_managed_skill`.
- `references/`, `scripts/`, and `state/` should use the normal workspace file surface rather than a second managed-skills file API.

At a product level:

- `Integrations` are workspace-managed connections to third-party systems.
- `Capabilities` are the agent-callable operations those integrations expose.
- `Skills` are managed instruction packages that teach Otto how to use those capabilities well.

This spec does not replace the integration architecture; it adds the managed instructional layer that sits beside it.

## Goal And Purpose

The purpose of this system is to let users and Otto create, inspect, edit, and project reusable skill packages into the managed OpenClaw runtime without inventing a second skill model that diverges from OpenClaw itself.

The important product invariant is:

- every skill that Otto exposes as part of the managed workspace experience should be a managed skill
- no unmanaged `SKILL.md` write path should exist in the Otto product flow
- OpenClaw remains the native runtime loader and prompt builder for those projected skills

This breaks into four separate requirements:

1. Users must be able to see and edit the skills their agent has in the workspace UI.
2. Otto must be able to create and update managed skills through control-plane-backed APIs, similar to managed bootstrap files.
3. The tenant runtime must receive those skills in a native OpenClaw location so upstream discovery works without custom glue.
4. Skills must be able to declare dependencies on integrations and show clear status when those prerequisites are not satisfied.

The system must also satisfy these goals:

- Managed skills should be the source of truth for workspace-owned instructional packages.
- OpenClaw should continue to load and present skills using its native filesystem and prompt model.
- Skill packages should support local companion material without making those files managed source of truth.
- Local runtime state and helper files should be allowed, but contained, visible, and clearly distinct from managed files.
- The skill UI should be semantic and managed-first, while the general file browser can remain a lower-level filesystem view.
- Otto should be able to hide or override inappropriate upstream bundled skills instead of exposing the raw OpenClaw defaults directly to workspace users.
- Otto should not create a second "effective skills" registry that competes with OpenClaw's native precedence and visibility rules.

## Architecture

The architecture has four relevant layers:

- `workspace UI`: user-facing list, detail, and editing surfaces for skills.
- `web` and `worker`: control-plane APIs, persistence, validation, and projection.
- `projected workspace filesystem`: the host-side directory Otto owns and mounts into the runtime.
- `tenant OpenClaw runtime`: native skill discovery, prompt catalog generation, and on-demand reading of `SKILL.md`.

The high-level topology should be:

```text
+------------------------+
| Workspace UI           |
| list/edit skills       |
+-----------+------------+
            |
            v
+------------------------+      +------------------------+
| web / worker           |----->| postgres               |
| validation + APIs      |      | skill source of truth  |
| projection orchestration|     +------------------------+
+-----------+------------+
            |
            v
+--------------------------------------------------------+
| projected workspace on tenant host                     |
| /opt/openclaw/home/workspace/skills/<skill-key>/...    |
+------------------------+-------------------------------+
                         |
                         v
+--------------------------------------------------------+
| tenant OpenClaw runtime                                |
| ~/.openclaw/workspace/skills/<skill-key>/...           |
| native skill discovery -> prompt catalog -> read on use|
+--------------------------------------------------------+
```

For Otto's specific managed runtime, this maps directly onto the existing runtime layout:

- Otto owns `/opt/openclaw/home` on the tenant server.
- Otto mounts that directory into the runtime container as `/home/node/.openclaw`.
- Otto already projects managed files into `/opt/openclaw/home/workspace`.
- This spec extends that projection mechanism into `/opt/openclaw/home/workspace/skills`.

OpenClaw is already aligned with this approach:

- `workspace/skills` is the highest-precedence standard skill root.
- OpenClaw scans that directory for skill packages.
- OpenClaw builds an `<available_skills>` catalog from skill frontmatter.
- The model reads the actual `SKILL.md` only when the skill is selected.

That means the Otto boundary must stay narrow:

- Otto owns canonical managed skill storage and projection into `workspace/skills`
- OpenClaw owns native source precedence, agent allowlists, frontmatter gating, and prompt visibility
- Otto should not present a competing answer to "which skills are effectively available to the model right now" unless that answer is explicitly delegated to OpenClaw-native state

So the correct Otto architecture is:

```text
Otto DB source of truth
  -> projected skill package in workspace/skills
  -> OpenClaw discovers it natively
  -> model sees name/description/location in prompt
  -> model reads SKILL.md on demand
```

## Relationship To TODO 17

The important boundary is simple:

- an `integration` provides capabilities the agent can call
- a `skill` provides instructions for how to use those capabilities well

Skills do not create tools. Skills do not own setup flows. Skills do not replace the managed integration runtime surface.

## Framework Recommendation

This spec should not introduce a second runtime or projection model.

Managed skills should reuse the same control-plane-owned mutation, versioning, and projection approach already used for managed instruction files:

- canonical rows in Postgres
- explicit validation on write
- desired-state versioning and projection
- runtime-authenticated lifecycle tools for the managed subset

For skills, the managed subset should stay intentionally narrow:

- `SKILL.md` only for managed writes
- runtime-local `references/`, `scripts/`, and `state/` directories for non-managed skill files
- normal workspace file tools for local file reads and writes inside those directories
- no second managed-skills file-editing surface for local directories

This matters because some skills will declare integration prerequisites and some integrations may later contribute starter skill packages. Those contributions should create normal managed skill records that project into `workspace/skills/<skill-key>/`. They should not write ad hoc files into a separate repository-level skills directory.

## Key Examples

### Linear

`Linear` is an integration defined by `TODO_17`.

A related skill in this spec might be:

- `linear-triage`

That skill may declare:

```json
{
  "dependsOn": {
    "integrations": ["linear"],
    "skills": ["incident-triage-base"]
  }
}
```

When the Linear integration is installed, Otto may add one or more associated managed skill packages under `workspace/skills/`. Those packages remain normal managed skills. They do not become the integration mechanism itself.

The result is:

```text
Linear integration installed
  -> runtime tool `linear` becomes available through TODO 17
  -> associated skill package may be added to workspace/skills/linear-triage
  -> model can use the skill to decide how to call the linear tool
```

### Slack

`Slack` remains a hybrid integration with control-plane-native transport and ingress as described in `TODO_17`.

A Slack-related skill might describe:

- how to summarize a channel thread
- how to decide when to post a follow-up
- naming conventions for escalation channels

That skill may depend on `slack`, but Slack setup, auth, and transport still belong to `TODO_17`, not to this spec.

### Self-built Integration

A self-built integration should still be modeled as a workspace-visible integration under `TODO_17`, not as "just a skill with scripts."

If that integration needs instructions, Otto can pair it with a managed skill package that explains:

- when to use it
- what conventions to follow
- what outputs to produce

The integration still owns the runtime capability surface. The skill only owns the instructional surface.

## How Integrations Reach The Runtime

This section is included only because skills depend on it.

Integrations should reach the runtime through the fixed managed integration plugin surface:

```text
workspace integration state
  -> static otto-integrations metatools plus control-plane discovery
  -> execution through integration-gateway
```

The agent calls integrations through runtime tools, not through skills.

Skills only influence:

- when to use a tool
- how to use a tool
- what conventions to follow while using a tool

Example:

```text
User asks Otto to triage a bug
  -> runtime tool `linear` exists
  -> skill `linear-triage` exists
  -> model sees the skill in <available_skills>
  -> model reads SKILL.md
  -> skill instructs how to use the linear tool correctly
```

## How OpenClaw Loads Skills

OpenClaw does not require a separate manual registration step for skills.

Instead, it:

1. scans skill roots for directories containing `SKILL.md`
2. reads skill frontmatter
3. builds a prompt-facing catalog of available skills
4. tells the model to read the actual skill file on demand when one is relevant

That means Otto should not create a second runtime registry. The correct Otto behavior is:

- store canonical managed skill content in Postgres
- project it into `workspace/skills/<skill-key>/`
- let OpenClaw discover it naturally

## Skill Package Model

Each managed skill should project to:

```text
workspace/
  skills/
    <skill-key>/
      SKILL.md
      references/
      scripts/
      state/
```

The rules should be:

- `SKILL.md` is required.
- `references/`, `scripts/`, and `state/` should always exist after projection.
- `references/`, `scripts/`, and `state/` are runtime-writable local directories, not managed source of truth.
- `state/` is reserved for local runtime state created by the agent or tools.
- `references/` is the preferred location for split markdown details that `SKILL.md` references.
- `scripts/` is the preferred location for skill-local helper scripts.
- Otto-managed writes should apply only to `SKILL.md`.
- Otto should preserve local contents under `references/`, `scripts/`, and `state/` across applies and reprojection.
- Otto should not require additional fixed subfolder names beyond these defaults, but these three directories define the supported writable local primitives.

This gives the system a minimal but powerful workspace primitive:

- one required instruction file
- one reserved place for runtime state
- freedom for multi-file skills without filesystem sprawl

## Skill Metadata

The managed skill format should stay mostly portable and OpenClaw-native.

Use generic dependency metadata for skill semantics:

```yaml
---
name: linear-triage
description: Triage bugs and create Linear issues using our team conventions.
metadata:
  {
    "dependsOn": {
      "integrations": ["linear", "slack"]
    }
  }
---
```

The required fields should be:

- `name`
- `description`

The supported structured metadata should include:

- `metadata.dependsOn.integrations`
- optional required properties if a skill needs structured runtime expectations later
- `metadata.openclaw.*` only for OpenClaw-specific runtime gates

The spec should avoid introducing `metadata.otto.*` unless a future requirement truly needs Otto-private management metadata.

## Managed Versus Local Files

This distinction must be explicit in the model, projection rules, and UI.

Managed files:

- `SKILL.md`
- any additional package files and folders outside `state/`

Local files:

- any contents under `state/`

The product principle should be:

- managed files are workspace-owned configuration and instructions
- local files are runtime-generated artifacts or state

Otto may show local files and allow downloads, but should not treat them as the canonical source of truth.

## Data Model

Extend the control-plane schema with managed skill records.

Core records should include:

- `tenant_skills`
- `tenant_skill_versions`
- `tenant_skill_files`
- `tenant_skill_file_versions`

A conceptual schema shape:

```text
tenant_skills
- tenant_id
- skill_key
- display_name
- status
- source_type
- enabled
- depends_on_json
- created_by_type
- created_by_external_id
- updated_by_type
- updated_by_external_id
- created_at
- updated_at

tenant_skill_versions
- tenant_skill_id
- version
- summary
- created_at
- created_by_type
- created_by_external_id

tenant_skill_files
- tenant_skill_id
- relative_path
- file_kind          // managed | state
- content_type
- content_encoding   // utf8_text | binary
- content_sha256
- last_seen_at
- updated_at

tenant_skill_file_versions
- tenant_skill_file_id
- version
- content_text
- content_sha256
- created_at
- created_by_type
- created_by_external_id
```

Implementation direction:

- managed UTF-8 text files should keep text versions in Postgres
- non-text managed files may start as metadata plus blob-backed download storage without editable versions
- `state/` files do not need full version history in `v1`
- `state/` can start as metadata plus on-demand reads/downloads

## Projection Model

Projection should mirror the existing managed-config pattern.

The control plane remains the source of truth. The runtime gets a projected copy.

```text
workspace edit
  -> control-plane validation
  -> Postgres write
  -> projection into /opt/openclaw/home/workspace/skills/<skill-key>/
  -> runtime sees ~/.openclaw/workspace/skills/<skill-key>/
  -> OpenClaw discovers skill package
```

Projection behavior should be:

- atomic writes for managed files
- safe delete of removed managed files
- never overwrite or delete unknown contents under `state/`
- idempotent re-projection on changes
- no full runtime restart by default when OpenClaw skill watching is sufficient

## Dataflow

The end-to-end dataflow should be:

```text
1. user or Otto creates/edits a managed skill in the workspace
2. web validates package structure and metadata
3. Postgres stores canonical skill rows and managed file versions
4. worker or projector syncs package to /opt/openclaw/home/workspace/skills/<skill-key>/
5. runtime sees files at ~/.openclaw/workspace/skills/<skill-key>/
6. OpenClaw includes skill name/description/location in the session skill snapshot
7. model selects the skill when relevant
8. model reads SKILL.md on demand
9. model uses runtime tools exposed by TODO 17 as instructed by the skill
10. runtime writes any mutable local artifacts into state/
```

The key separation is:

- managed content flows from Otto to runtime
- local skill state flows from runtime to disk only

## Managed Runtime Source Policy

Managed Otto should treat `workspace/skills` as the only supported mutable skill root for the workspace experience.

OpenClaw natively supports additional skill roots and precedence layers. In Otto-managed runtimes, those roots should not become a parallel product path for user-visible skill creation or mutation.

The policy should be:

- workspace-visible Otto skills must correspond to managed records in Postgres
- Otto must not create or update workspace-visible skills through direct unmanaged `SKILL.md` writes
- bundled skills should only remain visible when Otto explicitly allows them or seeds an overriding system-managed copy
- other mutable skill roots such as `~/.openclaw/skills`, `~/.agents/skills`, and `<workspace>/.agents/skills` should be treated as unsupported for managed Otto product behavior
- if an unexpected skill directory appears under `workspace/skills` without a matching managed record, that is drift and should be surfaced or reconciled explicitly rather than silently becoming the supported product state

## Workspace APIs

The control plane should expose a narrow managed-skill lifecycle API.

The workspace-facing operations should include:

- list managed skills
- get managed skill
- create managed skill
- update managed skill
- delete managed skill

The managed runtime plugin should map to those same lifecycle operations:

- `list_managed_skills`
- `get_managed_skill`
- `create_managed_skill`
- `update_managed_skill`
- `delete_managed_skill`

`update_managed_skill` should behave like a surgical patch API rather than a full replace API. It should support:

- patching `SKILL.md` content directly
- patching structured metadata fields that rebuild `SKILL.md`
- enabling or disabling the skill via a narrow lifecycle field

The managed-skills plugin should not become a general file browser. Reads and writes inside `references/`, `scripts/`, and `state/` should use the normal workspace file surface.

## Agent Self-Configuration

This is a skills spec, not an integration setup spec.

The agent should be able to:

- list managed skills
- inspect a skill's structured metadata
- create a new managed skill
- update `SKILL.md`
- delete a managed skill
- detect whether a skill's declared prerequisites are satisfied
- use `references/`, `scripts/`, and `state/` as the designated local writable directories for skill-owned files
- store split markdown details under `references/` and refer to them from `SKILL.md`

The agent should not be able to:

- provision integrations through the skills surface
- bypass integration setup or policy
- write arbitrary hidden projected files outside the skill package
- create ad hoc sibling managed files next to `SKILL.md` through the managed-skills surface
- create or mutate workspace-visible `SKILL.md` files by bypassing the managed skill APIs
- treat local `state/` files as managed source of truth
- treat local `references/` or `scripts/` files as managed source of truth

If a skill depends on an integration that is unavailable, the skill should show a status like `Missing prerequisite`. The actual setup flow remains in `TODO_17`.

## Workspace UI

The workspace should have a dedicated `Skills` section separate from the general file browser.

The recommended layout is:

```text
+----------------------------------------------------------------------------------+
| Skills                                                         [New skill]       |
+-----------------------------+----------------------------------------------------+
| skill list                  | skill detail                                       |
|                             |                                                    |
| linear-triage       Ready   | header: name, status, dependency badges           |
| support-routing     Missing | description block                                  |
| release-checklist   Ready   |                                                    |
| custom-research     Local   | files tree          editor / preview               |
|                             |                                                    |
|                             | inspector: dependsOn, required properties, source  |
+-----------------------------+----------------------------------------------------+
```

The preferred detail page is an integrated view rather than a tabs-only layout:

- metadata summary at the top
- file tree on the left
- editor or preview in the center
- structured inspector on the side or bottom

This is the best fit because both the structured fields and the actual package files matter at the same time.

If a simpler v1 is needed, a two-tab detail page is acceptable:

- `Overview`
- `Files`

But even then:

- `Overview` should surface description, dependency badges, and required properties
- `Files` should show the real skill package tree

## How To Show State Files

State files should be visible, but clearly demoted.

In the skill tree:

- show `state/`
- label it as `Local state`
- treat it as read-only in `v1`

For file behavior:

- text-like files may be previewed and downloaded
- binary or DB files should show metadata and download only

Example:

```text
linear-triage/
  SKILL.md
  references/
  scripts/
  state/   [Local state]
```

Selected local state file:

```text
+----------------------------------------------------------------------------------+
| state/cache.json                                             [Local state]       |
| Runtime-generated file. Not managed by workspace settings.   [Download]          |
+----------------------------------------------------------------------------------+
| Preview                                                                          |
| {                                                                                |
|   "lastSync": "2026-04-06T10:12:00Z",                                            |
|   "knownTeams": ["ENG", "SUPPORT"]                                               |
| }                                                                                |
+----------------------------------------------------------------------------------+
```

This keeps the runtime transparent without confusing managed package files with runtime-generated state.

## Workspace Structure And File Handling

This spec should also define the workspace organization rules Otto follows when creating or handling files.

The recommended workspace structure is:

```text
/
  AGENTS.md
  MEMORY.md
  memory/
  skills/
  work/
  inbox/
```

These rules are operationally important for managed skills, but they should not block the first managed-skills vertical slices.

The important rule is:

- do not create arbitrary files or folders at the workspace root

Only these top-level paths should be treated as approved writable roots for normal workspace behavior:

- `memory/`
- `skills/`
- `work/`
- `inbox/`

The role of each path should be:

- `memory/` for memory-related supporting files
- `skills/` for managed skill packages
- `work/` for normal working files, outputs, scripts, data, and deliverables
- `inbox/` for files explicitly provided by the user or imported as user-facing input

The intended prompt policy for Otto should be:

- treat the workspace as the canonical location for durable files
- do not create files or folders at the workspace root except through managed workspace surfaces
- do not create new top-level folders outside the approved paths
- prefer placing new work into an existing relevant folder under `work/`
- do not store secrets, credentials, tokens, or provider auth material in workspace files
- do not treat transport caches or provider-specific staging files as user-visible workspace files

### Inbox handling

`inbox/` should be treated as a staging area for user-provided input files, not as a provider cache directory.

The rules should be:

- if the user shares a file that is relevant to the task, materialize it into `inbox/`
- internal transport caches, temporary attachment downloads, and provider-specific staging files should remain hidden from the visible workspace model
- Otto should not silently delete user-provided files during active work
- in v1, `inbox/` should be retained by default rather than auto-cleared
- later, Otto may add an explicit archive or retention policy, but that should be a product decision rather than implicit agent behavior

This gives a clean distinction:

```text
explicit user working input -> inbox/
internal transport or cache files -> hidden runtime internals
```

### Naming and directory conventions under work

The spec should standardize conventions under `work/`, not at the workspace root.

Recommended structure:

```text
work/
  <task-or-topic>/
    scripts/
    data/
    outputs/
```

The rules should be:

- normal work should go into `work/<task-or-topic>/`
- one-time scripts should go into `work/<task-or-topic>/scripts/`
- reusable task-local scripts should also stay in `work/<task-or-topic>/scripts/` unless they are promoted into a skill package
- task-local data files should go into `work/<task-or-topic>/data/`
- generated deliverables may go into `work/<task-or-topic>/outputs/` when that improves organization
- only promote logic into `skills/` when it is truly reusable as part of a skill package

This avoids the need for top-level `scripts/` or `data/` directories while still giving Otto a strong organization primitive for one-off and reusable task files.

## Relationship To The General File Browser

The general file browser should show `skills/` because they are real workspace files, but it should not replace the dedicated `Skills` section.

The product boundary should be:

- `Skills` is the semantic managed UI for skill packages
- `Files` is the lower-level filesystem UI for the workspace
- `SKILL.md` lifecycle changes flow through the managed-skills API
- `references/`, `scripts/`, and `state/` use the normal file surface

This allows Otto to present skills in a structured way without pretending they are something other than real files on disk.

## Validation Rules

The control plane should validate:

- valid `SKILL.md`
- valid `name` and `description`
- valid `metadata.dependsOn.integrations` shape
- valid `metadata.dependsOn.skills` shape
- dependency keys that resolve to known integration keys
- dependency keys that resolve to known managed skill keys in the same workspace
- no self-dependency and no dependency cycles across managed skills
- valid relative paths within the skill package
- no path traversal or symlink escape through managed writes
- `state/` reserved for local runtime state
- editable writes only to managed UTF-8 text files
- version-checked patch semantics for create, update, disable, and delete
- direct unmanaged `SKILL.md` drift should be detectable against the managed record set

Suggested skill status values:

- `ready`
- `disabled`
- `missing_prerequisite`
- `invalid`
- `projection_failed`

## Non-Goals

This spec should not:

- define integration setup flows
- define runtime tool injection
- expose OpenClaw plugin management as a user-facing concept
- turn skills into the integration mechanism
- turn local `state/` files into managed source of truth
- define a generic host-level filesystem browser

## Vertical Increments

### Increment 1: Managed skill package model and validation

Status:

- done on `main`
- the first slice includes schema, validation, dependency-key checks, and managed file classification
- binary managed-file persistence remains intentionally deferred; the first create path is text-first
- local skill-to-skill dependency metadata is the next extension on the same validation model

Scope:

- add the managed skill schema and canonical package model
- validate `SKILL.md`, dependency metadata, path rules, and reserved `state/`
- classify managed files as editable UTF-8 text versus download-only non-text

Acceptance criteria:

- a managed skill can be created with a stable `skill_key` and required `SKILL.md`
- dependency metadata is validated against known integration keys
- invalid paths and writes into `state/` are rejected
- the control plane can classify package files into editable text, download-only managed files, and local `state/`

Follow-up note:

- the same dependency model should extend to `metadata.dependsOn.skills` so skills can declare prerequisites on other managed skills and the workspace can render a dependency tree

Parallel note:

- safe to implement in parallel with the separate integrations-surface workstream because it depends only on stable integration keys, not on that UI

### Increment 2: Projection into `workspace/skills/`

Status:

- done on `main`
- desired-state compilation now snapshots exact managed skill versions instead of projecting only the latest mutable rows at apply time
- provisioning and apply now project managed skill packages into `workspace/skills/<skill-key>/` through the existing runtime file writer
- managed skill re-projection now uses a runtime manifest so removed managed files are pruned safely without touching unknown local `state/` contents

Scope:

- project managed skills into `workspace/skills/<skill-key>/`
- preserve unknown local files under `state/`
- make re-projection idempotent and safe for managed-file deletes

Acceptance criteria:

- managed skill packages project into the runtime-visible workspace path
- removed managed files are safely deleted from the projected package
- unknown `state/` contents are never overwritten or removed
- reapplying the same package is idempotent

Parallel note:

- safe to implement in parallel with the separate integrations-surface workstream

### Increment 3: Minimal workspace Skills UI

Status:

- done on `main` for the current text-first managed-skills slice
- the workspace now has a dedicated `/skills` list plus `/skills/<skill-key>` detail page with URL-backed tabs modeled on the newer integration surfaces
- users can create a first skill from `SKILL.md`, inspect package files, and edit `SKILL.md` directly from the workspace
- non-text file metadata is surfaced in the viewer, while true binary download remains coupled to the still-deferred binary managed-file persistence work

Scope:

- add a dedicated `Skills` section in the workspace
- show list, detail, package tree, dependency badges, and status
- add viewer support for the whole package
- allow explicit editing for `SKILL.md`
- allow `SKILL.md` to declare both integration prerequisites and managed-skill prerequisites through structured controls

Acceptance criteria:

- users can browse managed skills in a dedicated workspace section
- the package tree clearly distinguishes editable managed files, download-only managed files, and local `state/`
- users can edit `SKILL.md` through an explicit edit action
- local `references/`, `scripts/`, and `state/` directories are visible as local, runtime-owned areas
- the Skills UI can show both integration and skill prerequisites as the basis for a dependency tree

Parallel note:

- safe to implement in parallel with the separate integrations-surface workstream because it is its own workspace surface

### Increment 4: Runtime-authenticated managed-skill CRUD surface

Status:

- done in this slice
- the tenant runtime now has a dedicated managed-skills plugin and runtime-authenticated route for list, inspect, read, and patch operations on `SKILL.md`

Scope:

- add runtime-authenticated list/read/patch tools for managed skills
- reuse the managed bootstrap-file mutation/version/apply pipeline
- restrict patch operations to `SKILL.md`

Acceptance criteria:

- Otto can list managed skills and inspect package files through runtime-authenticated APIs
- Otto can patch `SKILL.md` with version checks
- Otto cannot patch `references/`, `scripts/`, `state/`, or non-text files through the managed-skills surface

Parallel note:

- safe to implement in parallel with the separate integrations-surface workstream

### Increment 5: Local directory visibility through the normal file surface

Status:

- partially done on `main`
- projected skills now create and preserve writable runtime-local `references/`, `scripts/`, and `state/` directories
- workspace and runtime-managed edits are already restricted away from those local directories
- read-only listing, preview, and download for local directory contents are still open

Scope:

- make `references/`, `scripts/`, and `state/` durable runtime-local writable directories in projected skills
- expose `references/`, `scripts/`, and `state/` through the normal workspace file surface
- preview text-like `references/`, `scripts/`, and `state/` files
- allow download for text and binary local files across those directories
- preserve local contents in those directories across applies and reprojection

Acceptance criteria:

- `references/`, `scripts/`, and `state/` appear in the package tree as local runtime-owned directories
- the tenant runtime can write new files under those directories without permission errors
- text-like local files can be previewed
- binary local files can be downloaded
- the managed-skills API never becomes the general file API for those directories

### Increment 8: Bundled skill policy and Otto system overrides

Status:

- done on `main`
- Otto now renders an explicit bundled-skill allowlist into tenant OpenClaw config instead of passing through the entire upstream bundled catalog
- Otto now seeds a system-managed `skill-creator` skill with higher precedence than the bundled OpenClaw copy
- the Otto `skill-creator` override stays visible to Otto and in the workspace list, but it is non-editable through Otto's managed-skills surfaces

Scope:

- explicitly control which upstream bundled OpenClaw skills are visible to end users
- allow Otto to override same-named bundled skills by projecting workspace/system-managed skills with higher precedence
- seed Otto-owned system skills such as `skill-creator` as non-editable managed skills

Acceptance criteria:

- Otto can suppress bundled skills that should not be exposed in the workspace experience
- Otto can project a same-named workspace skill that overrides a bundled OpenClaw skill
- Otto-owned system skills remain visible in the available skills list while staying non-editable in the workspace UI

### Increment 6: Integration-linked starter skills

Scope:

- allow integrations to contribute starter managed skill packages
- derive prerequisite status from current workspace integration state
- keep contributed packages as normal managed skills after creation

Acceptance criteria:

- an integration can contribute a starter managed skill package under `workspace/skills/`
- prerequisite status is derived automatically from current workspace state
- contributed skills behave like normal managed skills after creation

### Increment 9: Reduced managed lifecycle surface

Status:

- planned

Scope:

- narrow the runtime plugin contract to lifecycle operations only
- support runtime-authenticated create, update-as-patch, enable or disable, and delete
- remove the need for managed-skills file-browsing tools beyond the managed `SKILL.md` lifecycle

Acceptance criteria:

- Otto can create a new managed skill through the managed-skills plugin
- Otto can patch content, metadata, and enabled-state through one surgical update surface
- Otto can delete a managed skill through an explicit delete action
- companion files continue to use the normal workspace file surface

### Increment 10: Unmanaged skill-source enforcement and drift handling

Status:

- planned

Scope:

- make Otto-managed runtimes treat unmanaged workspace-visible skills as unsupported
- define how bundled skills, personal skill roots, and project skill roots are treated in managed Otto
- detect or reconcile drift when `workspace/skills` contains skills without managed records

Acceptance criteria:

- Otto-managed runtimes have an explicit policy for non-managed skill roots
- workspace-visible skills always correspond to managed records
- unmanaged `workspace/skills/<skill-key>/SKILL.md` drift is surfaced or reconciled explicitly

### Increment 11: Managed skill rename without copy-and-recreate

Status:

- planned

Scope:

- support a first-class managed-skill rename flow in the control plane rather than modeling rename as create-new plus delete-old
- treat rename as an in-place identity update on the existing `tenant_skills.id` record so version history, audit lineage, and file metadata stay attached to one skill record
- reserve the destination `skill_key` before commit and reject rename when the target key is already claimed by another managed skill
- move the projected runtime package directory from `workspace/skills/<old-skill-key>/` to `workspace/skills/<new-skill-key>/` without copying local runtime-owned contents under `references/`, `scripts/`, or `state/`
- optionally support renaming the skill's frontmatter `name` in the same action, but keep `skill_key` rename and human-facing skill-name edits as distinct fields in the API and UI
- automatically rewrite `metadata.dependsOn.skills` references in other managed skills that point at the renamed skill so the dependency graph stays valid after the rename

Implementation notes:

- the control plane should expose an explicit rename action such as `rename_managed_skill`; this should not be hidden inside generic patch semantics because it affects identity, filesystem projection paths, and dependent skill packages
- the first supported scope should be user-managed skills only; system-managed and integration-contributed skills should stay non-renamable until there is a stronger policy for those sources
- the rename transaction should lock the renamed skill plus any dependent managed skills it rewrites, then:
  - validate and reserve the new `skill_key`
  - rewrite dependent `metadata.dependsOn.skills` references from old key to new key
  - create new versions for every touched `SKILL.md`
  - update the renamed row's `skill_key`
- runtime-local companion directories are the main reason rename cannot be modeled as create and delete:
  - `references/`, `scripts/`, and `state/` are not canonical control-plane files
  - the current managed-skill manifest only tracks projected managed files such as `SKILL.md`
  - a plain create/delete flow would either strand the old local directory or require ad hoc file copying
- the worker apply path should consume a pending rename operation and perform an idempotent host-side directory move before writing managed files:
  - if old exists and new does not, move old to new
  - if old is missing and new exists, treat it as already moved
  - if both exist, fail with a clear conflict instead of trying to merge directories automatically
- desired-state or worker-job payloads should carry explicit rename operations until apply marks them complete; rename should not rely on inferring moves only from the final version map

Acceptance criteria:

- a managed skill can be renamed to a new reserved `skill_key` without creating a second skill record
- the renamed skill keeps its version lineage and canonical `SKILL.md` history on the same `tenant_skills.id`
- dependent managed skills that reference the old key are rewritten transactionally to the new key
- projected runtime skill folders move from old key to new key without copying `references/`, `scripts/`, or `state/`
- the worker handles rename retries idempotently and reports a clear failure when the destination folder already exists
- the workspace redirects to the new skill route after a successful rename and no longer treats the old key as the canonical path

### Increment 7: Managed skill dependency graph metadata

Status:

- done in this slice
- `metadata.dependsOn.skills` now validates against current workspace skills, rejects self-dependencies and cycles, and renders alongside integration prerequisites in the workspace

Scope:

- add `metadata.dependsOn.skills`
- validate referenced skill keys against the current workspace skill set
- reject self-dependencies and dependency cycles
- show local skill prerequisites in the Skills UI alongside integration prerequisites

Acceptance criteria:

- `SKILL.md` can declare `metadata.dependsOn.skills`
- create and update validate those keys against known managed skills in the same workspace
- self-dependencies and cycles are rejected
- the detail and status UI render both dependency lists so a tree view can be built on top

## Status Checklist

- [x] Increment 1: managed skill package model and validation
- [x] Increment 2: projection into `workspace/skills/`
- [x] Increment 3: minimal workspace Skills UI
- [x] Increment 4: runtime-authenticated managed-skill CRUD surface
- [ ] Increment 5: local directory visibility through the normal file surface
- [ ] Increment 6: integration-linked starter skills
- [x] Increment 7: managed skill dependency graph metadata
- [x] Increment 8: bundled skill policy and Otto system overrides
- [ ] Increment 9: reduced managed lifecycle surface
- [ ] Increment 10: unmanaged skill-source enforcement and drift handling
- [ ] Increment 11: managed skill rename without copy-and-recreate

## Recommendation

The guiding principle for this spec should be:

```text
TODO 17 defines what the agent can connect to and call.
TODO 18 defines the managed instruction packages that teach the agent how to use those capabilities well.
OpenClaw remains the native runtime substrate for both.
```

Next:

- Increment 9 first. Narrow the plugin and runtime API contract to `list`, `get`, `create`, `update`, and `delete`, with patch-oriented updates for content, metadata, and enabled-state.
- Then finish Increment 5 by exposing `references/`, `scripts/`, and `state/` through the normal workspace file surface rather than a second managed-skills file API.
- Then implement Increment 10 so Otto-managed runtimes have an explicit no-unmanaged-skills policy and drift handling model before starter-skill work expands the surface again.
- Then implement Increment 11 so managed skill keys can be renamed in place without create-and-delete churn, while preserving local runtime-owned skill folders through an explicit worker-side move operation.
