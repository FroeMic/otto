import { buildManagedSkillMarkdown } from "./markdown";

export const DEFAULT_BUNDLED_SKILL_ALLOWLIST = ["slack"] as const;

export type SystemManagedSkillDefinition = {
  contentText: string;
  skillKey: string;
  summary: string;
};

export const SYSTEM_MANAGED_SKILL_DEFINITIONS: readonly SystemManagedSkillDefinition[] =
  [
    {
      contentText: buildSkillCreatorMarkdown(),
      skillKey: "skill-creator",
      summary: "Install Otto system skill-creator guidance",
    },
  ] as const;

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
├── references/         (runtime-local markdown and supporting docs)
├── scripts/            (runtime-local helper scripts)
└── state/              (runtime-local generated data and caches)
\`\`\`

### Core contract

- Treat \`SKILL.md\` as the only Otto-managed file in a skill package.
- Put detailed supporting markdown into \`references/\` and point to it from \`SKILL.md\`.
- Put helper code in \`scripts/\`.
- Put generated snapshots, caches, and other runtime-local data in \`state/\`.
- Do not create sibling managed files next to \`SKILL.md\`.

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
