import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { validateManagedSkillPackage } from "./package";
import { SYSTEM_MANAGED_SKILL_DEFINITIONS } from "./system-skills";

describe("system managed skill definitions", () => {
  it("registers the expected seeded Otto skills", () => {
    assert.deepEqual(
      SYSTEM_MANAGED_SKILL_DEFINITIONS.map((definition) => definition.skillKey),
      ["skill-creator", "name-and-domain-research"],
    );
  });

  it("defines the naming skill as a packaged skill with companion references", () => {
    const namingSkill = SYSTEM_MANAGED_SKILL_DEFINITIONS.find(
      (definition) => definition.skillKey === "name-and-domain-research",
    );

    assert.ok(namingSkill);
    assert.deepEqual(
      namingSkill.files.map((file) => file.path),
      [
        "SKILL.md",
        "references/naming-strategies.md",
        "references/full-guide.md",
        "references/setup.md",
      ],
    );

    const allContent = namingSkill.files
      .map((file) => file.contentText ?? "")
      .join("\n");

    assert.match(allContent, /\bramp\b/i);
    assert.doesNotMatch(allContent, /\bvertical\b/i);
  });

  it("keeps Otto system skill packages valid against the managed skill contract", () => {
    const knownSkillKeys = SYSTEM_MANAGED_SKILL_DEFINITIONS.map(
      (definition) => definition.skillKey,
    );

    for (const definition of SYSTEM_MANAGED_SKILL_DEFINITIONS) {
      const result = validateManagedSkillPackage({
        files: definition.files,
        knownSkillKeys,
        skillKey: definition.skillKey,
      });

      assert.equal(result.skillKey, definition.skillKey);
    }
  });
});
