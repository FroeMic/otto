import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { getActiveWorkspaceChatAssistantMessageToStop } from "./presentation"

describe("active workspace chat assistant message", () => {
  it("returns the latest pending or streaming assistant message", () => {
    const message = getActiveWorkspaceChatAssistantMessageToStop([
      {
        author: {
          kind: "user",
          userId: "user_1",
        },
        createdAt: "2026-04-18T10:00:00.000Z",
        id: "msg_user",
        parts: [{ text: "Work on this", type: "text" }],
        status: "completed",
      },
      {
        author: {
          kind: "assistant",
          name: "Otto",
        },
        createdAt: "2026-04-18T10:00:01.000Z",
        id: "msg_assistant_1",
        parts: [],
        status: "pending",
      },
    ])

    assert.equal(message?.id, "msg_assistant_1")
  })

  it("ignores completed, failed, and canceled assistant messages", () => {
    const message = getActiveWorkspaceChatAssistantMessageToStop([
      {
        author: {
          kind: "assistant",
          name: "Otto",
        },
        createdAt: "2026-04-18T10:00:01.000Z",
        id: "msg_assistant_1",
        parts: [],
        status: "canceled",
      },
    ])

    assert.equal(message, null)
  })
})
