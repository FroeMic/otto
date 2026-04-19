import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import assert from "node:assert/strict"
import { describe, it } from "vitest"

import { loadSystemManagedSkillDefinitionsFromDirectory } from "./file-library"

describe("file-based managed skill library", () => {
  it("loads skill package files and platform metadata from a directory", () => {
    const root = mkdtempSync(path.join(tmpdir(), "managed-skill-library-"))

    try {
      const skillRoot = path.join(root, "business-review")
      mkdirSync(path.join(skillRoot, "references"), { recursive: true })
      writeFileSync(
        path.join(skillRoot, "skill.json"),
        JSON.stringify(
          {
            installMode: "manual_install",
            skillKey: "business-review",
            summary: "Install business review guidance",
            visibleInLibrary: true,
          },
          null,
          2,
        ),
      )
      writeFileSync(
        path.join(skillRoot, "SKILL.md"),
        [
          "---",
          "name: Business Review",
          "description: Pressure-test a business direction.",
          "metadata:",
          "  dependsOn:",
          "    integrations: []",
          "    skills: []",
          "---",
          "",
          "# Business Review",
          "",
        ].join("\n"),
      )
      writeFileSync(
        path.join(skillRoot, "references/question-patterns.md"),
        "# Question Patterns\n",
      )

      const definitions = loadSystemManagedSkillDefinitionsFromDirectory(root)

      assert.deepEqual(definitions, [
        {
          files: [
            {
              contentText: [
                "---",
                "name: Business Review",
                "description: Pressure-test a business direction.",
                "metadata:",
                "  dependsOn:",
                "    integrations: []",
                "    skills: []",
                "---",
                "",
                "# Business Review",
                "",
              ].join("\n"),
              path: "SKILL.md",
            },
            {
              contentText: "# Question Patterns\n",
              path: "references/question-patterns.md",
            },
          ],
          installMode: "manual_install",
          skillKey: "business-review",
          summary: "Install business review guidance",
          visibleInLibrary: true,
        },
      ])
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })
})
