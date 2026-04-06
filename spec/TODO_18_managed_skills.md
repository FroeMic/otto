# TODO 18: Managed Skills

## Executive Summary

This spec defines how managed Otto should support `Skills` as a first-class, workspace-managed concept while staying fully native to OpenClaw's filesystem-based skill model.

The key decisions are:

- A managed skill is a filesystem package rooted at `workspace/skills/<skill-key>/`.
- Every skill is anchored by `SKILL.md`.
- Skills may include additional managed files and folders as needed, but only `SKILL.md` is required.
- `state/` is the reserved directory for local runtime state created by the agent or tools.
- Skills may declare dependencies on integrations, but they do not create tools and they do not own integration setup.
- Managed skill files are stored canonically in the control plane and projected into the tenant runtime.
- Users and Otto should both be able to view and edit managed skill files through workspace-managed APIs.
- OpenClaw should discover these skills natively from `workspace/skills` without Otto-specific changes to the upstream skill loader.

At a product level:

- `Integrations` are workspace-managed connections to third-party systems.
- `Capabilities` are the agent-callable operations those integrations expose.
- `Skills` are managed instruction packages that teach Otto how to use those capabilities well.

This spec builds on `TODO_17_managed_integrations_architecture.md`. It does not replace the integration architecture; it adds the managed instructional layer that sits beside it.

## Goal And Purpose

The purpose of this system is to let users and Otto create, inspect, edit, and project reusable skill packages into the managed OpenClaw runtime without inventing a second skill model that diverges from OpenClaw itself.

This breaks into four separate requirements:

1. Users must be able to see and edit the skills their agent has in the workspace UI.
2. Otto must be able to create and update managed skills through control-plane-backed APIs, similar to managed bootstrap files.
3. The tenant runtime must receive those skills in a native OpenClaw location so upstream discovery works without custom glue.
4. Skills must be able to declare dependencies on integrations and show clear status when those prerequisites are not satisfied.

The system must also satisfy these goals:

- Managed skills should be the source of truth for workspace-owned instructional packages.
- OpenClaw should continue to load and present skills using its native filesystem and prompt model.
- Skill packages should support several files without forcing a large fixed folder taxonomy.
- Local runtime state should be allowed, but contained, visible, and clearly distinct from managed files.
- The skill UI should be semantic and managed-first, while the general file browser can remain a lower-level filesystem view.

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

So the correct Otto architecture is:

```text
Otto DB source of truth
  -> projected skill package in workspace/skills
  -> OpenClaw discovers it natively
  -> model sees name/description/location in prompt
  -> model reads SKILL.md on demand
```

## Relationship To TODO 17

`TODO_17_managed_integrations_architecture.md` remains the source of truth for:

- integration setup
- OAuth and provider auth
- runtime tool injection
- provider execution
- control-plane authority for integration state

This spec adds:

- the managed skill package model
- dependency declaration for skills
- skill projection into the runtime filesystem
- skill CRUD and editing surfaces
- workspace UI for browsing and editing skills

The important boundary is:

- an `integration` provides the runtime capability surface
- a `skill` provides the instruction package that tells Otto how to use that capability surface

Skills do not create tools. Skills do not own setup flows. Skills do not replace `otto-integrations`.

## Framework Recommendation

This spec should inherit the framework recommendation from `TODO_17`, not create a second framework strategy.

Managed outbound integrations should still start with `hosted Nango`.

Why that remains the recommendation:

- It solves OAuth, token refresh, and request proxying.
- It fits a model where the control plane remains the authority.
- It leaves Otto in control of capability definitions, settings, and policy.
- It provides the cleanest substrate for integration-linked skill packages that depend on a stable integration model.

Alternatives remain:

- `Pipedream Connect` if catalog breadth becomes more important than control.
- `Composio` for chat-first connect experiences, but not as the preferred substrate for Otto's managed workspace-owned lifecycle.

This matters for this spec only because some skills will declare integration prerequisites and some integration installations may add associated skill packages into the repository's `skills/` directory.

## Key Examples

### Linear

`Linear` is an integration defined by `TODO_17`.

A related skill in this spec might be:

- `linear-triage`

That skill may declare:

```json
{
  "dependsOn": {
    "integrations": ["linear"]
  }
}
```

When the Linear integration is installed, Otto may add one or more associated skill packages into the repository's `skills/` directory. Those packages remain normal managed skills. They do not become the integration mechanism itself.

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

Per `TODO_17`, integrations should reach the runtime through:

```text
workspace integration state
  -> otto-integrations manifest
  -> one tool per integration in runtime
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
      <additional managed files and folders as needed>
      state/
```

The rules should be:

- `SKILL.md` is required.
- `state/` is reserved for local runtime state created by the agent or tools.
- `state/` is optional, but if it exists, Otto treats it as local mutable state rather than managed source of truth.
- All other files and folders are optional managed package content.
- Otto should not require fixed subfolder names such as `references/`, `scripts/`, `examples/`, or `assets/`.
- Skills may still include those folders by convention when useful.

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

- managed files should keep text versions in Postgres
- `state/` files do not need full version history in v1
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

## Workspace APIs

The control plane should expose managed skill APIs analogous to the existing managed-config APIs.

The workspace-facing operations should include:

- list skills
- get skill summary
- create skill
- update skill metadata
- list skill files
- read managed skill file
- patch managed skill file
- enable or disable skill
- list `state/` files
- read or download `state/` files

The runtime-authenticated internal surface should support projection and runtime-side managed editing similar to the existing `otto-managed-config` pattern.

## Agent Self-Configuration

This is a skills spec, not an integration setup spec.

The agent should be able to:

- list managed skills
- inspect a skill's structured metadata
- create a new managed skill
- edit managed skill files
- detect whether a skill's declared prerequisites are satisfied
- use the skill's `state/` directory as the designated location for local skill runtime state

The agent should not be able to:

- provision integrations through the skills surface
- bypass integration setup or policy
- write arbitrary hidden projected files outside the skill package
- treat local `state/` files as managed source of truth

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
- treat it as read-only in v1

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

This allows Otto to present skills in a structured way without pretending they are something other than real files on disk.

## Validation Rules

The control plane should validate:

- valid `SKILL.md`
- valid `name` and `description`
- valid `metadata.dependsOn.integrations` shape
- valid relative paths within the skill package
- no path traversal or symlink escape through managed writes
- `state/` reserved for local runtime state

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

## Suggested Delivery Order

1. Add the managed skill data model and internal API shape.
2. Add projection into `workspace/skills/`.
3. Add a minimal workspace `Skills` UI with list, detail, tree, and editing for `SKILL.md`.
4. Add agent-managed skill CRUD through a runtime plugin surface.
5. Add `state/` visibility and download support.
6. Add integration-linked skill package contribution on top of `TODO_17`.

## Recommendation

The guiding principle for this spec should be:

```text
TODO 17 defines what the agent can connect to and call.
TODO 18 defines the managed instruction packages that teach the agent how to use those capabilities well.
OpenClaw remains the native runtime substrate for both.
```
