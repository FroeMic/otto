import assert from "node:assert/strict";
import test from "node:test";

import { rewriteManagedSkillDependencySkillKey } from "@/db/managed-skills";
import { parseManagedSkillMarkdown } from "@/lib/managed-skills/package";

test("rewriteManagedSkillDependencySkillKey updates dependency references", () => {
  const currentContent = `---
name: random-color
description: Pick a color for the current asset.
metadata:
  dependsOn:
    integrations:
      - linear
    skills:
      - test-skill
      - style-guide
---

# Random Color

Follow the stored workflow.
`;

  const nextContent = rewriteManagedSkillDependencySkillKey({
    contentText: currentContent,
    fromSkillKey: "test-skill",
    toSkillKey: "random-color-base",
  });

  assert.notEqual(nextContent, currentContent);

  const parsed = parseManagedSkillMarkdown(nextContent);

  assert.equal(parsed.name, "random-color");
  assert.equal(parsed.description, "Pick a color for the current asset.");
  assert.deepEqual(parsed.integrationKeys, ["linear"]);
  assert.deepEqual(parsed.skillKeys, ["random-color-base", "style-guide"]);
  assert.equal(parsed.skillBody, "# Random Color\n\nFollow the stored workflow.");
});

test("rewriteManagedSkillDependencySkillKey leaves content unchanged when not referenced", () => {
  const currentContent = `---
name: random-color
description: Pick a color for the current asset.
metadata:
  dependsOn:
    integrations: []
    skills:
      - style-guide
---

# Random Color
`;

  assert.equal(
    rewriteManagedSkillDependencySkillKey({
      contentText: currentContent,
      fromSkillKey: "test-skill",
      toSkillKey: "random-color-base",
    }),
    currentContent,
  );
});
