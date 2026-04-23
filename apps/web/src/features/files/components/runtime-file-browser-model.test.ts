import assert from "node:assert/strict"

import { describe, it } from "vitest"

import {
  buildExplorerTree,
  filterRuntimeFilesForSearch,
  getInitialExpandedDirectories,
} from "./runtime-file-browser-model"

const files = [
  file("docs/guide.md"),
  file("docs/reference/api.md"),
  file("packages/agent/SKILL.md"),
  file("packages/billing/README.md"),
  file("logs/runtime.log"),
]

describe("runtime file browser model", () => {
  it("matches filenames against their full path", () => {
    const matches = filterRuntimeFilesForSearch(files, "reference/api")

    assert.deepEqual(
      matches.map((entry) => entry.path),
      ["docs/reference/api.md"],
    )
  })

  it("matches folder names and keeps the matched folder subtree", () => {
    const matches = filterRuntimeFilesForSearch(files, "packages")

    assert.deepEqual(
      matches.map((entry) => entry.path),
      ["packages/agent/SKILL.md", "packages/billing/README.md"],
    )
  })

  it("returns closed folders for the default tree state", () => {
    assert.deepEqual(getInitialExpandedDirectories(), [])
  })

  it("builds filtered trees with matching descendants", () => {
    const tree = buildExplorerTree(
      filterRuntimeFilesForSearch(files, "api.md"),
      {},
    )

    assert.deepEqual(tree, [
      {
        children: [
          {
            children: [
              {
                file: files[1],
                kind: "file",
                name: "api.md",
                path: "docs/reference/api.md",
              },
            ],
            kind: "directory",
            name: "reference",
            path: "docs/reference",
          },
        ],
        kind: "directory",
        name: "docs",
        path: "docs",
      },
    ])
  })
})

function file(path: string) {
  return {
    contentText: null,
    contentType: "text/markdown",
    path,
    sizeBytes: 12,
    storageEncoding: "utf8_text" as const,
    truncated: false,
  }
}
