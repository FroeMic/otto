import assert from "node:assert/strict"

import { renderToStaticMarkup } from "react-dom/server"
import { describe, it } from "vitest"

import { RuntimeFileBrowser } from "./RuntimeFileBrowser"

describe("RuntimeFileBrowser", () => {
  it("uses search as the explorer toolbar and keeps folders closed by default", () => {
    const html = renderToStaticMarkup(
      <RuntimeFileBrowser
        buildDownloadUrl={({ path }) => `/download/${path}`}
        explorerLabel="Workspace files"
        missingRootMessage="Missing workspace."
        onRefresh={() => undefined}
        rootPathFallback="/workspace"
        snapshot={{
          files: [
            file("docs/guide.md"),
            file("docs/reference/api.md"),
            file("README.md"),
          ],
          rootExists: true,
          rootPath: "/workspace",
        }}
      />,
    )

    assert.match(html, /Search files and folders…/)
    assert.doesNotMatch(html, /Browse the runtime file tree/)
    assert.doesNotMatch(html, />Refresh</)
    assert.match(html, />docs</)
    assert.doesNotMatch(html, />guide\.md</)
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
