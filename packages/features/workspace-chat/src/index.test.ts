import assert from "node:assert/strict"

import { describe, it } from "vitest"

import {
  handleWorkspaceChatConversationCreateRequest,
  handleWorkspaceChatConversationDetailRequest,
  handleWorkspaceChatConversationListRequest,
  handleWorkspaceChatMessageCreateRequest,
} from "./index"

const user = {
  email: "test@getyourotto.com",
  firstName: "Test",
  id: "user_123",
  lastName: "User",
}

describe("workspace chat feature", () => {
  it("lists the current user's conversations", async () => {
    const response = await handleWorkspaceChatConversationListRequest({
      listConversations: async () => [
        {
          id: "conv_1",
          kind: "ad_hoc",
          lastActivityAt: "2026-04-10T09:30:00.000Z",
          latestMessagePreview: "Hello from Otto",
          title: "Portfolio review",
          visibility: "open",
        },
      ],
      orgSlug: "otto",
      syncUserFromSession: async () => undefined,
      user,
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      conversations: [
        {
          id: "conv_1",
          kind: "ad_hoc",
          lastActivityAt: "2026-04-10T09:30:00.000Z",
          latestMessagePreview: "Hello from Otto",
          title: "Portfolio review",
          visibility: "open",
        },
      ],
    })
  })

  it("creates an open conversation with an initial title", async () => {
    const response = await handleWorkspaceChatConversationCreateRequest({
      createConversation: async ({ title, visibility }) => ({
        createdConversation: {
          id: "conv_1",
          kind: "ad_hoc",
          lastActivityAt: "2026-04-10T09:30:00.000Z",
          latestMessagePreview: null,
          title,
          visibility,
        },
      }),
      orgSlug: "otto",
      request: new Request(
        "https://otto.test/api/workspace/otto/chat/conversations",
        {
          body: JSON.stringify({
            kind: "ad_hoc",
            title: "Portfolio review",
            visibility: "open",
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      ),
      syncUserFromSession: async () => undefined,
      user,
    })

    assert.equal(response.status, 201)
    assert.deepEqual(await response.json(), {
      conversation: {
        id: "conv_1",
        kind: "ad_hoc",
        lastActivityAt: "2026-04-10T09:30:00.000Z",
        latestMessagePreview: null,
        title: "Portfolio review",
        visibility: "open",
      },
    })
  })

  it("returns the full conversation transcript payload", async () => {
    const response = await handleWorkspaceChatConversationDetailRequest({
      getConversationDetail: async () => ({
        conversation: {
          id: "conv_1",
          kind: "ad_hoc",
          lastActivityAt: "2026-04-10T09:30:00.000Z",
          latestMessagePreview: "How are things looking?",
          title: "Portfolio review",
          visibility: "open",
        },
        messages: [
          {
            author: {
              kind: "user",
              name: "Test User",
              userId: "user_123",
            },
            createdAt: "2026-04-10T09:31:00.000Z",
            id: "msg_1",
            parts: [
              {
                text: "How are things looking?",
                type: "text",
              },
            ],
            status: "completed",
          },
          {
            author: {
              kind: "assistant",
              name: "Otto",
            },
            createdAt: "2026-04-10T09:31:05.000Z",
            id: "msg_2",
            parts: [],
            status: "pending",
          },
        ],
      }),
      conversationId: "conv_1",
      orgSlug: "otto",
      syncUserFromSession: async () => undefined,
      user,
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      conversation: {
        id: "conv_1",
        kind: "ad_hoc",
        lastActivityAt: "2026-04-10T09:30:00.000Z",
        latestMessagePreview: "How are things looking?",
        title: "Portfolio review",
        visibility: "open",
      },
      messages: [
        {
          author: {
            kind: "user",
            name: "Test User",
            userId: "user_123",
          },
          createdAt: "2026-04-10T09:31:00.000Z",
          id: "msg_1",
          parts: [
            {
              text: "How are things looking?",
              type: "text",
            },
          ],
          status: "completed",
        },
        {
          author: {
            kind: "assistant",
            name: "Otto",
          },
          createdAt: "2026-04-10T09:31:05.000Z",
          id: "msg_2",
          parts: [],
          status: "pending",
        },
      ],
    })
  })

  it("accepts a message and records dispatch state for runtime ingress", async () => {
    const response = await handleWorkspaceChatMessageCreateRequest({
      createMessage: async ({ conversationId, parts }) => ({
        dispatch: {
          status: "queued",
        },
        message: {
          author: {
            kind: "user",
            name: "Test User",
            userId: "user_123",
          },
          createdAt: "2026-04-10T09:32:00.000Z",
          id: "msg_2",
          parts,
          status: "completed",
        },
        conversationId,
      }),
      conversationId: "conv_1",
      orgSlug: "otto",
      request: new Request(
        "https://otto.test/api/workspace/otto/chat/conversations/conv_1/messages",
        {
          body: JSON.stringify({
            clientMessageId: "client-msg-1",
            parts: [
              {
                text: "Summarize the latest notes",
                type: "text",
              },
            ],
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      ),
      syncUserFromSession: async () => undefined,
      user,
    })

    assert.equal(response.status, 202)
    assert.deepEqual(await response.json(), {
      conversationId: "conv_1",
      dispatch: {
        status: "queued",
      },
      message: {
        author: {
          kind: "user",
          name: "Test User",
          userId: "user_123",
        },
        createdAt: "2026-04-10T09:32:00.000Z",
        id: "msg_2",
        parts: [
          {
            text: "Summarize the latest notes",
            type: "text",
          },
        ],
        status: "completed",
      },
    })
  })
})
