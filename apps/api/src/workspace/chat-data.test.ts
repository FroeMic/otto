import assert from "node:assert/strict"

import { describe, it } from "vitest"

import {
  deriveWorkspaceChatConversationOriginKind,
  generateWorkspaceConversationTitle,
  shouldAutoGenerateWorkspaceConversationTitle,
} from "./chat-data"

describe("workspace chat data helpers", () => {
  it("derives sidebar origin filters from the stored conversation kind", () => {
    assert.equal(
      deriveWorkspaceChatConversationOriginKind("ad_hoc"),
      "manual",
    )
    assert.equal(
      deriveWorkspaceChatConversationOriginKind("durable_named"),
      "scheduled",
    )
    assert.equal(
      deriveWorkspaceChatConversationOriginKind("external_surface"),
      "trigger",
    )
  })

  it("marks the placeholder title for auto-generation", () => {
    assert.equal(shouldAutoGenerateWorkspaceConversationTitle("New conversation"), true)
    assert.equal(shouldAutoGenerateWorkspaceConversationTitle("Portfolio review"), false)
  })

  it("generates a compact title from the first text message", () => {
    assert.equal(
      generateWorkspaceConversationTitle([
        {
          text: "Please review the API key segmentation plan for the launch.",
          type: "text",
        },
      ]),
      "Please review the API key segmentation plan..."
    )
  })
})
