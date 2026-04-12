import assert from "node:assert/strict"

import { describe, it } from "vitest"

import {
  parseWorkspaceChatConversationDetail,
  parseWorkspaceChatConversationList,
} from "./chat"

describe("workspace chat api helpers", () => {
  it("parses a workspace chat conversation list with the shared contract", () => {
    const conversations = parseWorkspaceChatConversationList({
      conversations: [
        {
          id: "conv_1",
          kind: "ad_hoc",
          lastActivityAt: "2026-04-10T12:00:00.000Z",
          latestMessagePreview: "Hello from Otto",
          title: "Portfolio review",
          visibility: "open",
        },
      ],
    })

    assert.equal(conversations.length, 1)
    assert.equal(conversations[0]?.id, "conv_1")
  })

  it("parses a workspace chat conversation detail response", () => {
    const detail = parseWorkspaceChatConversationDetail({
      conversation: {
        id: "conv_1",
        kind: "ad_hoc",
        lastActivityAt: "2026-04-10T12:00:00.000Z",
        latestMessagePreview: "Hello from Otto",
        title: "Portfolio review",
        visibility: "open",
      },
      messageEvents: [
        {
          conversationId: "conv_1",
          createdAt: "2026-04-10T12:00:30.000Z",
          id: "evt_1",
          messageId: "msg_1",
          payload: {
            toolName: "read_file",
          },
          sequence: 1,
          status: "running",
          title: "Read file",
          type: "tool.started",
        },
      ],
      messages: [
        {
          author: {
            kind: "assistant",
            name: "Otto",
          },
          createdAt: "2026-04-10T12:01:00.000Z",
          id: "msg_1",
          parts: [
            {
              text: "Hello from Otto",
              type: "text",
            },
          ],
          status: "completed",
        },
      ],
    })

    assert.equal(detail.conversation.id, "conv_1")
    assert.equal(detail.messageEvents[0]?.type, "tool.started")
    assert.equal(detail.messages[0]?.author.kind, "assistant")
  })
})
