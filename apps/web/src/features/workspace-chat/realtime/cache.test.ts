import assert from "node:assert/strict"

import { describe, it } from "vitest"

import {
  applyWorkspaceChatRealtimeEventToConversationDetail,
  applyWorkspaceChatRealtimeEventToConversationList,
} from "./cache"

describe("workspace chat realtime cache helpers", () => {
  it("replaces an existing message with the pushed canonical version", () => {
    const detail = applyWorkspaceChatRealtimeEventToConversationDetail(
      {
        conversation: {
          id: "conv_1",
          kind: "ad_hoc",
          lastActivityAt: "2026-04-11T18:00:00.000Z",
          latestMessagePreview: "hello",
          originKind: "manual",
          title: "New conversation",
          visibility: "open",
        },
        messageEvents: [],
        messages: [
          {
            author: {
              kind: "assistant",
              name: "Otto",
            },
            createdAt: "2026-04-11T18:00:00.000Z",
            id: "msg_1",
            parts: [],
            status: "pending",
          },
        ],
      },
      {
        conversationId: "conv_1",
        message: {
          author: {
            kind: "assistant",
            name: "Otto",
          },
          createdAt: "2026-04-11T18:00:00.000Z",
          id: "msg_1",
          parts: [
            {
              text: "Hello back",
              type: "text",
            },
          ],
          status: "completed",
        },
        type: "conversation.message_upserted",
      },
    )

    assert.equal(detail.messages[0]?.status, "completed")
    assert.equal(detail.messages[0]?.parts[0]?.type, "text")
  })

  it("updates an existing conversation summary in the list", () => {
    const conversations = applyWorkspaceChatRealtimeEventToConversationList(
      [
        {
          id: "conv_1",
          kind: "ad_hoc",
          lastActivityAt: "2026-04-11T18:00:00.000Z",
          latestMessagePreview: "old preview",
          originKind: "manual",
          title: "New conversation",
          visibility: "open",
        },
      ],
      {
        conversation: {
          id: "conv_1",
          kind: "ad_hoc",
          lastActivityAt: "2026-04-11T18:00:05.000Z",
          latestMessagePreview: "new preview",
          originKind: "manual",
          title: "New conversation",
          visibility: "open",
        },
        type: "conversation.summary_updated",
      },
    )

    assert.equal(conversations[0]?.latestMessagePreview, "new preview")
  })

  it("appends a message event to the active conversation detail", () => {
    const detail = applyWorkspaceChatRealtimeEventToConversationDetail(
      {
        conversation: {
          id: "conv_1",
          kind: "ad_hoc",
          lastActivityAt: "2026-04-11T18:00:00.000Z",
          latestMessagePreview: "hello",
          originKind: "manual",
          title: "New conversation",
          visibility: "open",
        },
        messageEvents: [],
        messages: [
          {
            author: {
              kind: "assistant",
              name: "Otto",
            },
            createdAt: "2026-04-11T18:00:00.000Z",
            id: "msg_1",
            parts: [],
            status: "pending",
          },
        ],
      },
      {
        conversationId: "conv_1",
        event: {
          conversationId: "conv_1",
          createdAt: "2026-04-11T18:00:01.000Z",
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
        type: "conversation.message_event_upserted",
      },
    )

    assert.equal(detail.messageEvents.length, 1)
    assert.equal(detail.messageEvents[0]?.messageId, "msg_1")
    assert.equal(detail.messageEvents[0]?.type, "tool.started")
  })
})
