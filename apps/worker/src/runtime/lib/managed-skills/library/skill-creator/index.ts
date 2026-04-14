import { buildManagedSkillMarkdown } from "../../markdown";
import type { SystemManagedSkillDefinition } from "../../system-skill-definition";

function buildSkillCreatorMarkdown() {
  const managedContent = buildManagedSkillMarkdown({
    description:
      "Create, refine, split, or audit Otto workspace skills using Otto's managed skill primitives.",
    integrationKeys: [],
    name: "skill-creator",
    skillKeys: [],
    skillBody: `# Skill Creator

This skill provides guidance for creating effective Otto workspace skills.

## About Otto skills

Otto skills are reusable packages that teach Otto how to handle recurring workspace-specific workflows. Keep the main operational guidance in \`SKILL.md\`, and use the local skill folders only when extra material is genuinely needed.

### Anatomy of an Otto skill

Every Otto skill consists of:

\`\`\`
skill-name/
├── SKILL.md (required, Otto-managed)
├── references/         (seeded or runtime-local supporting docs)
├── scripts/            (seeded or runtime-local helper scripts)
└── state/              (runtime-local generated data and caches)
\`\`\`

### Core contract

- Treat \`SKILL.md\` as the operational entrypoint for the skill.
- Put detailed supporting markdown into \`references/\` and point to it from \`SKILL.md\`.
- Put helper code in \`scripts/\`.
- Put generated snapshots, caches, and other runtime-local data in \`state/\`.
- Use reset only when the user explicitly wants to restore Otto's seeded defaults for a skill package.

## Skill creation process

### Step 1: Understand the skill with concrete examples

Clarify what should trigger the skill, what outcomes the user expects, and which workflows are actually recurring. If the skill already exists, inspect the current shape before restructuring it.

### Step 2: Plan the reusable skill contents

Decide what belongs in:

- \`SKILL.md\` for the main trigger description, dependencies, and workflow
- \`references/\` for longer examples, decision trees, and supporting markdown
- \`scripts/\` for helper code
- \`state/\` for generated or cached runtime data

### Step 3: Edit the skill

When writing or updating \`SKILL.md\`:

- Keep the frontmatter and instructions concise.
- Use \`metadata.dependsOn.integrations\` for required workspace integrations.
- Use \`metadata.dependsOn.skills\` for required managed skills.
- Keep dependency lists tight and accurate so Otto can reason about prerequisites.
- When splitting a skill, update \`SKILL.md\` so it explicitly tells Otto when to open the reference files.

### Step 4: Iterate

After using the skill on real tasks, refine the wording, dependency metadata, and supporting folders so the next run is more reliable.

## Writing guidance

- Prefer concise operational instructions over long explanations.
- Move bulky procedures, examples, and notes into \`references/*.md\`.
- Never put generated data or caches into \`SKILL.md\`.
- Summarize the resulting structure so the user knows where Otto will read and write.`,
  });

  return managedContent.replace("---\n", "---\nuser-invocable: false\n");
}

export const SKILL_CREATOR_SKILL_DEFINITION: SystemManagedSkillDefinition = {
  files: [
    {
      contentText: buildSkillCreatorMarkdown(),
      path: "SKILL.md",
    },
  ],
  skillKey: "skill-creator",
  summary: "Install Otto system skill-creator guidance",
};
