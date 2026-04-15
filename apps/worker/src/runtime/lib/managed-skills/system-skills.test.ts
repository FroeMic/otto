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
        "examples/ramp-shortlist.json",
        "references/naming-strategies.md",
        "references/full-guide.md",
        "references/setup.md",
        "scripts/generate-domain-variants.mjs",
        "templates/recommendation-schema.json",
      ],
    );

    const allContent = namingSkill.files
      .map((file) => file.contentText ?? "")
      .join("\n");

    assert.match(allContent, /\bramp\b/i);
    assert.doesNotMatch(allContent, /\bvertical\b/i);
    assert.match(allContent, /recommendedNames/);
    assert.match(allContent, /generate-domain-variants\.mjs/);
  });

  it("marks default-installed and library-installable skills explicitly", () => {
    const skillCreator = SYSTEM_MANAGED_SKILL_DEFINITIONS.find(
      (definition) => definition.skillKey === "skill-creator",
    );
    const namingSkill = SYSTEM_MANAGED_SKILL_DEFINITIONS.find(
      (definition) => definition.skillKey === "name-and-domain-research",
    );

    assert.ok(skillCreator);
    assert.equal(skillCreator.installMode, "default_installed");
    assert.equal(skillCreator.visibleInLibrary, false);

    assert.ok(namingSkill);
    assert.equal(namingSkill.installMode, "manual_install");
    assert.equal(namingSkill.visibleInLibrary, true);
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
