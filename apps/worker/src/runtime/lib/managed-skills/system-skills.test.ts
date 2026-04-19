import assert from "node:assert/strict"
import { describe, it } from "vitest"

import { validateManagedSkillPackage } from "./package"
import { SYSTEM_MANAGED_SKILL_DEFINITIONS } from "./system-skills"

describe("system managed skill definitions", () => {
  it("registers the expected seeded Otto skills", () => {
    assert.deepEqual(
      SYSTEM_MANAGED_SKILL_DEFINITIONS.map((definition) => definition.skillKey),
      [
        "skill-creator",
        "otto-business-onboarding",
        "name-and-domain-research",
        "business-review",
      ],
    )
  })

  it("defines business onboarding as a default-installed project workspace skill", () => {
    const onboardingSkill = SYSTEM_MANAGED_SKILL_DEFINITIONS.find(
      (definition) => definition.skillKey === "otto-business-onboarding",
    )

    assert.ok(onboardingSkill)
    assert.equal(onboardingSkill.installMode, "default_installed")
    assert.equal(onboardingSkill.visibleInLibrary, false)
    assert.deepEqual(
      onboardingSkill.files.map((file) => file.path),
      ["SKILL.md"],
    )

    const skillMarkdown = onboardingSkill.files[0]?.contentText ?? ""

    assert.match(skillMarkdown, /new business idea/i)
    assert.match(skillMarkdown, /projects\/<project-key>\//)
    assert.match(skillMarkdown, /projects\/_index\.md/)
    assert.match(skillMarkdown, /greenfield/)
    assert.match(skillMarkdown, /brownfield/)
    assert.match(skillMarkdown, /projects\/<project-key>\/<project-key>\.md/)
    assert.match(skillMarkdown, /Business Profile/)
    assert.match(skillMarkdown, /Current Read/)
    assert.doesNotMatch(skillMarkdown, /Diarized Brief/)
    assert.match(skillMarkdown, /Contradictions And Tensions/)
    assert.match(skillMarkdown, /Confidence And Unknowns/)
    assert.match(skillMarkdown, /Supporting Context/)
    assert.match(skillMarkdown, /context\/onboarding\.md/)
    assert.match(skillMarkdown, /context\/roadmap\.md/)
    assert.match(skillMarkdown, /context\//)
    assert.match(skillMarkdown, /create `context\/` only when writing the first supporting file/i)
    assert.match(skillMarkdown, /Do not create empty supporting files/i)
    assert.doesNotMatch(skillMarkdown, /projects\/<project-key>\/project\.md/)
    assert.doesNotMatch(skillMarkdown, /projects\/<project-key>\/onboarding\.md/)
    assert.match(skillMarkdown, /guided compression/i)
    assert.match(skillMarkdown, /short, conversational turns/i)
    assert.match(skillMarkdown, /ask at most one focused question/i)
    assert.match(skillMarkdown, /One recommended next move/i)
    assert.match(skillMarkdown, /Do not write consultant-style essays/i)
    assert.doesNotMatch(skillMarkdown, /references\//)
  })

  it("defines the naming skill as a packaged skill with companion references", () => {
    const namingSkill = SYSTEM_MANAGED_SKILL_DEFINITIONS.find(
      (definition) => definition.skillKey === "name-and-domain-research",
    )

    assert.ok(namingSkill)
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
    )

    const allContent = namingSkill.files
      .map((file) => file.contentText ?? "")
      .join("\n")

    assert.match(allContent, /Name Generator/)
    assert.match(allContent, /\bramp\b/i)
    assert.doesNotMatch(allContent, /\bvertical\b/i)
    assert.match(allContent, /recommendedNames/)
    assert.match(allContent, /generate-domain-variants\.mjs/)
  })

  it("marks default-installed and library-installable skills explicitly", () => {
    const skillCreator = SYSTEM_MANAGED_SKILL_DEFINITIONS.find(
      (definition) => definition.skillKey === "skill-creator",
    )
    const namingSkill = SYSTEM_MANAGED_SKILL_DEFINITIONS.find(
      (definition) => definition.skillKey === "name-and-domain-research",
    )

    assert.ok(skillCreator)
    assert.equal(skillCreator.installMode, "default_installed")
    assert.equal(skillCreator.visibleInLibrary, false)

    const onboardingSkill = SYSTEM_MANAGED_SKILL_DEFINITIONS.find(
      (definition) => definition.skillKey === "otto-business-onboarding",
    )
    assert.ok(onboardingSkill)
    assert.equal(onboardingSkill.installMode, "default_installed")
    assert.equal(onboardingSkill.visibleInLibrary, false)

    assert.ok(namingSkill)
    assert.equal(namingSkill.installMode, "manual_install")
    assert.equal(namingSkill.visibleInLibrary, true)

    const businessReviewSkill = SYSTEM_MANAGED_SKILL_DEFINITIONS.find(
      (definition) => definition.skillKey === "business-review",
    )
    assert.ok(businessReviewSkill)
    assert.equal(businessReviewSkill.installMode, "manual_install")
    assert.equal(businessReviewSkill.visibleInLibrary, true)
  })

  it("defines business review as a separate pressure-testing skill", () => {
    const businessReviewSkill = SYSTEM_MANAGED_SKILL_DEFINITIONS.find(
      (definition) => definition.skillKey === "business-review",
    )

    assert.ok(businessReviewSkill)
    assert.deepEqual(
      businessReviewSkill.files.map((file) => file.path),
      [
        "SKILL.md",
        "references/anti-patterns.md",
        "references/question-patterns.md",
        "references/review-modes.md",
        "templates/review-summary.md",
      ],
    )

    const allContent = businessReviewSkill.files
      .map((file) => file.contentText ?? "")
      .join("\n")

    assert.match(allContent, /Business Review/)
    assert.match(allContent, /pressure-test/i)
    assert.match(allContent, /one focused question/i)
    assert.match(allContent, /interest from demand/i)
    assert.match(allContent, /not Business Onboarding/i)
    assert.doesNotMatch(allContent, /office hours/i)
  })

  it("keeps Otto system skill packages valid against the managed skill contract", () => {
    const knownSkillKeys = SYSTEM_MANAGED_SKILL_DEFINITIONS.map(
      (definition) => definition.skillKey,
    )

    for (const definition of SYSTEM_MANAGED_SKILL_DEFINITIONS) {
      const result = validateManagedSkillPackage({
        files: definition.files,
        knownSkillKeys,
        skillKey: definition.skillKey,
      })

      assert.equal(result.skillKey, definition.skillKey)
    }
  })
})
