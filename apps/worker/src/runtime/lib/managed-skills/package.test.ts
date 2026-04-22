import assert from "node:assert/strict"
import { describe, it } from "vitest"

import {
  classifyManagedSkillFile,
  MANAGED_SKILL_ENTRY_FILE_PATH,
  validateManagedSkillPackage,
} from "./package"

const baseSkillContent = `---
name: Name Generator
description: Help founders find good company names.
metadata:
  dependsOn:
    integrations:
      - brave
      - gandi
    skills: []
---

# Name Generator
`

describe("managed skill package", () => {
  it("classifies approved companion files as managed seeded files", () => {
    assert.deepEqual(
      classifyManagedSkillFile({
        contentText: "# Naming strategies",
        path: "references/naming-strategies.md",
      }),
      {
        editability: "download_only",
        fileKind: "managed_seeded",
        path: "references/naming-strategies.md",
        storageEncoding: "utf8_text",
      },
    )
  })

  it("accepts canonical seeded companion files in approved subfolders", () => {
    const result = validateManagedSkillPackage({
      files: [
        {
          contentText: baseSkillContent,
          path: MANAGED_SKILL_ENTRY_FILE_PATH,
        },
        {
          contentText: "# Naming strategies",
          path: "references/naming-strategies.md",
        },
        {
          contentText: "# Full guide",
          path: "templates/output-shape.md",
        },
        {
          contentText: '{"recommendedNames":[]}',
          path: "examples/example-output.json",
        },
        {
          contentText: "#!/usr/bin/env node\nconsole.log('ok')\n",
          path: "scripts/generate-domain-variants.mjs",
        },
      ],
      knownIntegrationKeys: ["brave", "gandi"],
      knownSkillKeys: [],
      skillKey: "name-and-domain-research",
    })

    assert.deepEqual(
      result.files.map((file) => ({
        editability: file.editability,
        fileKind: file.fileKind,
        path: file.path,
      })),
      [
        {
          editability: "download_only",
          fileKind: "managed_seeded",
          path: "examples/example-output.json",
        },
        {
          editability: "download_only",
          fileKind: "managed_seeded",
          path: "references/naming-strategies.md",
        },
        {
          editability: "download_only",
          fileKind: "managed_seeded",
          path: "scripts/generate-domain-variants.mjs",
        },
        {
          editability: "editable",
          fileKind: "managed_entry",
          path: "SKILL.md",
        },
        {
          editability: "download_only",
          fileKind: "managed_seeded",
          path: "templates/output-shape.md",
        },
      ],
    )
  })

  it("rejects canonical files in unsupported skill subfolders", () => {
    assert.throws(
      () =>
        validateManagedSkillPackage({
          files: [
            {
              contentText: baseSkillContent,
              path: MANAGED_SKILL_ENTRY_FILE_PATH,
            },
            {
              contentText: "top secret",
              path: "notes/private.md",
            },
          ],
          knownIntegrationKeys: ["brave", "gandi"],
          knownSkillKeys: [],
          skillKey: "name-and-domain-research",
        }),
      /Unsupported managed skill file path: notes\/private\.md/,
    )
  })
})
