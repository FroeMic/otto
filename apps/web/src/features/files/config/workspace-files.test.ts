import { describe, expect, it } from "vitest"

import {
  HIDDEN_WORKSPACE_FILE_PATHS,
  HIDDEN_WORKSPACE_FILE_PREFIXES,
} from "./workspace-files"

function isHiddenWorkspacePath(path: string) {
  return (
    HIDDEN_WORKSPACE_FILE_PATHS.includes(path) ||
    HIDDEN_WORKSPACE_FILE_PREFIXES.some((prefix) => path.startsWith(prefix))
  )
}

describe("workspace files hidden paths", () => {
  it("hides OpenClaw workspace-local runtime state from the files surface", () => {
    expect(isHiddenWorkspacePath(".openclaw")).toBe(true)
    expect(isHiddenWorkspacePath(".openclaw/state.json")).toBe(true)
  })
})
