import assert from "node:assert/strict"
import { describe, it } from "vitest"

import { validateManagedSkillPackage } from "./package"
import { SYSTEM_MANAGED_SKILL_DEFINITIONS } from "./system-skills"

describe("system managed skill definitions", () => {
  it("registers the expected seeded system skills", () => {
    assert.deepEqual(
      SYSTEM_MANAGED_SKILL_DEFINITIONS.map((definition) => definition.skillKey),
      [
        "skill-creator",
        "business-idea-onboarding",
        "name-and-domain-research",
        "business-review",
      ],
    )
  })

  it("defines business idea onboarding as a default-installed project workspace skill", () => {
    const onboardingSkill = SYSTEM_MANAGED_SKILL_DEFINITIONS.find(
      (definition) => definition.skillKey === "business-idea-onboarding",
    )

    assert.ok(onboardingSkill)
    assert.equal(onboardingSkill.installMode, "default_installed")
    assert.equal(onboardingSkill.visibleInLibrary, true)
    assert.deepEqual(
      onboardingSkill.files.map((file) => file.path),
      [
        "SKILL.md",
        "examples/antique-books-marketplace.md",
        "references/project-structure.md",
        "references/question-priorities.md",
        "templates/business-profile.md",
        "templates/onboarding.md",
        "templates/roadmap.md",
      ],
    )

    const skillMarkdown = onboardingSkill.files[0]?.contentText ?? ""
    const allContent = onboardingSkill.files
      .map((file) => file.contentText ?? "")
      .join("\n")

    assert.match(skillMarkdown, /new business idea/i)
    assert.match(skillMarkdown, /Reference files/)
    assert.match(skillMarkdown, /references\/project-structure\.md/)
    assert.match(skillMarkdown, /templates\/business-profile\.md/)
    assert.match(skillMarkdown, /examples\/antique-books-marketplace\.md/)
    assert.match(skillMarkdown, /projects\/<project-key>\//)
    assert.doesNotMatch(skillMarkdown, /```markdown\n# Business Profile/)
    assert.doesNotMatch(skillMarkdown, /## Done Recently/)
    assert.match(allContent, /projects\/<project-key>\//)
    assert.match(skillMarkdown, /projects\/PROJECTS\.md/)
    assert.match(allContent, /greenfield/)
    assert.match(allContent, /brownfield/)
    assert.match(allContent, /projects\/<project-key>\/<project-key>\.md/)
    assert.match(allContent, /Business Profile/)
    assert.match(allContent, /Current Read/)
    assert.doesNotMatch(allContent, /Diarized Brief/)
    assert.match(allContent, /Contradictions And Tensions/)
    assert.match(allContent, /Confidence And Unknowns/)
    assert.match(allContent, /Supporting Context/)
    assert.match(allContent, /context\/onboarding\.md/)
    assert.match(allContent, /context\/roadmap\.md/)
    assert.match(allContent, /context\//)
    assert.match(allContent, /create `context\/` only when writing the first supporting file/i)
    assert.match(allContent, /Do not create empty supporting files/i)
    assert.doesNotMatch(allContent, /projects\/<project-key>\/project\.md/)
    assert.doesNotMatch(allContent, /projects\/<project-key>\/onboarding\.md/)
    assert.match(allContent, /guided compression/i)
    assert.match(skillMarkdown, /short, conversational turns/i)
    assert.match(skillMarkdown, /ask at most one focused question/i)
    assert.match(allContent, /One recommended next move/i)
    assert.match(skillMarkdown, /Do not write consultant-style essays/i)
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
      (definition) => definition.skillKey === "business-idea-onboarding",
    )
    assert.ok(onboardingSkill)
    assert.equal(onboardingSkill.installMode, "default_installed")
    assert.equal(onboardingSkill.visibleInLibrary, true)

    assert.ok(namingSkill)
    assert.equal(namingSkill.installMode, "manual_install")
    assert.equal(namingSkill.visibleInLibrary, true)

    const businessReviewSkill = SYSTEM_MANAGED_SKILL_DEFINITIONS.find(
      (definition) => definition.skillKey === "business-review",
    )
    assert.ok(businessReviewSkill)
    assert.equal(businessReviewSkill.installMode, "default_installed")
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
    assert.match(allContent, /not Business Idea Onboarding/i)
    assert.doesNotMatch(allContent, /office hours/i)
  })

  it("keeps system skill packages valid against the managed skill contract", () => {
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
