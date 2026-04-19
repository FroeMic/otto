---
user-invocable: false
name: skill-creator
description: Create, refine, split, or audit workspace skills using managed skill primitives.
metadata:
  dependsOn:
    integrations: []
    skills: []
---

# Skill Creator

This skill provides guidance for creating effective workspace skills.

## About workspace skills

Workspace skills are reusable packages that teach you how to handle recurring workspace-specific workflows. Keep the main operational guidance in `SKILL.md`, and use the local skill folders only when extra material is genuinely needed.

### Anatomy of a workspace skill

Every workspace skill consists of:

```
skill-name/
├── SKILL.md (required, managed)
├── references/         (seeded or runtime-local supporting docs)
├── scripts/            (seeded or runtime-local helper scripts)
└── state/              (runtime-local generated data and caches)
```

### Core contract

- Treat `SKILL.md` as the operational entrypoint for the skill.
- Put detailed supporting markdown into `references/` and point to it from `SKILL.md`.
- Put helper code in `scripts/`.
- Put generated snapshots, caches, and other runtime-local data in `state/`.
- Use reset only when the user explicitly wants to restore seeded defaults for a skill package.

## Skill creation process

### Step 1: Understand the skill with concrete examples

Clarify what should trigger the skill, what outcomes the user expects, and which workflows are actually recurring. If the skill already exists, inspect the current shape before restructuring it.

### Step 2: Plan the reusable skill contents

Decide what belongs in:

- `SKILL.md` for the main trigger description, dependencies, and workflow
- `references/` for longer examples, decision trees, and supporting markdown
- `scripts/` for helper code
- `state/` for generated or cached runtime data

### Step 3: Edit the skill

When writing or updating `SKILL.md`:

- Keep the frontmatter and instructions concise.
- Use `metadata.dependsOn.integrations` for required workspace integrations.
- Use `metadata.dependsOn.skills` for required managed skills.
- Keep dependency lists tight and accurate so you can reason about prerequisites.
- When splitting a skill, update `SKILL.md` so it explicitly tells you when to open the reference files.

### Step 4: Iterate

After using the skill on real tasks, refine the wording, dependency metadata, and supporting folders so the next run is more reliable.

## Writing guidance

- Prefer concise operational instructions over long explanations.
- Move bulky procedures, examples, and notes into `references/*.md`.
- Never put generated data or caches into `SKILL.md`.
- Summarize the resulting structure so the user knows where you will read and write.
