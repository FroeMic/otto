import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { extractWorkspaceChatDropFiles } from "./drop-files"

describe("workspace chat drop files", () => {
  it("prefers file items from a drag event", () => {
    const file = new File(["hello"], "hello.txt", {
      type: "text/plain",
    })

    const files = extractWorkspaceChatDropFiles({
      items: [
        {
          getAsFile: () => file,
          kind: "file",
        },
      ],
    })

    assert.deepEqual(files, [file])
  })

  it("falls back to the direct file list", () => {
    const first = new File(["a"], "a.txt", { type: "text/plain" })
    const second = new File(["b"], "b.txt", { type: "text/plain" })

    const files = extractWorkspaceChatDropFiles({
      files: [first, second],
      items: [],
    })

    assert.deepEqual(files, [first, second])
  })
})
