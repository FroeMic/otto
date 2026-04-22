import assert from "node:assert/strict"

import type { WorkspaceChatMessage } from "@otto/feature-workspace-chat"
import { describe, it } from "vitest"

import { isGroupedWithPreviousMessage } from "./ConversationMessageList"

function buildUserMessage(input: {
  createdAt: string
  id: string
  userId: string
}): WorkspaceChatMessage {
  return {
    author: {
      kind: "user",
      name: "User",
      userId: input.userId,
    },
    createdAt: input.createdAt,
    id: input.id,
    parts: [{ text: input.id, type: "text" }],
    status: "completed",
  }
}

describe("isGroupedWithPreviousMessage", () => {
  it("groups messages from the same sender within one minute", () => {
    assert.equal(
      isGroupedWithPreviousMessage({
        currentMessage: buildUserMessage({
          createdAt: "2026-04-22T12:00:59.000Z",
          id: "message_2",
          userId: "user_1",
        }),
        currentUserId: "user_1",
        previousMessage: buildUserMessage({
          createdAt: "2026-04-22T12:00:00.000Z",
          id: "message_1",
          userId: "user_1",
        }),
      }),
      true,
    )
  })

  it("starts a new visible turn after more than one minute", () => {
    assert.equal(
      isGroupedWithPreviousMessage({
        currentMessage: buildUserMessage({
          createdAt: "2026-04-22T12:01:01.000Z",
          id: "message_2",
          userId: "user_1",
        }),
        currentUserId: "user_1",
        previousMessage: buildUserMessage({
          createdAt: "2026-04-22T12:00:00.000Z",
          id: "message_1",
          userId: "user_1",
        }),
      }),
      false,
    )
  })
})
