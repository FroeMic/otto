import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { summarizeSkillFileProvenance } from "./file-provenance"

describe("skill file provenance", () => {
  it("separates default package files from runtime-only files", () => {
    const result = summarizeSkillFileProvenance({
      managedFiles: [
        {
          contentSha256: "entry",
          contentText: "---\nname: Demo\n---\n",
          contentType: "text/markdown",
          editability: "download_only",
          fileClass: "managed_entry",
          path: "SKILL.md",
          resettable: false,
          storageEncoding: "utf8_text",
        },
        {
          contentSha256: "guide",
          contentText: "# Setup",
          contentType: "text/markdown",
          editability: "download_only",
          fileClass: "managed_seeded",
          path: "references/setup.md",
          resettable: true,
          storageEncoding: "utf8_text",
        },
        {
          contentSha256: "schema",
          contentText: "{}",
          contentType: "application/json",
          editability: "download_only",
          fileClass: "managed_seeded",
          path: "templates/schema.json",
          resettable: true,
          storageEncoding: "utf8_text",
        },
      ],
      runtimeFiles: [
        {
          contentText: "---\nname: Demo\n---\n",
          contentType: "text/markdown",
          path: "SKILL.md",
          sizeBytes: 20,
          storageEncoding: "utf8_text",
          truncated: false,
        },
        {
          contentText: "# Setup",
          contentType: "text/markdown",
          path: "references/setup.md",
          sizeBytes: 7,
          storageEncoding: "utf8_text",
          truncated: false,
        },
        {
          contentText: "{\"lastRun\":true}",
          contentType: "application/json",
          path: "state/cache.json",
          sizeBytes: 16,
          storageEncoding: "utf8_text",
          truncated: false,
        },
        {
          contentText: "notes",
          contentType: "text/plain",
          path: "scratch/ideas.txt",
          sizeBytes: 5,
          storageEncoding: "utf8_text",
          truncated: false,
        },
      ],
    })

    assert.equal(result.instructionsFile?.path, "SKILL.md")
    assert.deepEqual(
      result.templateFiles.map((file) => file.path),
      ["references/setup.md", "templates/schema.json"],
    )
    assert.deepEqual(
      result.runtimeOnlyFiles.map((file) => file.path),
      ["scratch/ideas.txt", "state/cache.json"],
    )
    assert.deepEqual(
      result.missingFromRuntime.map((file) => file.path),
      ["templates/schema.json"],
    )
  })
})
