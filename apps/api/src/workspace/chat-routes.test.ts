import assert from "node:assert/strict"

import { WorkspaceSessionAuthError } from "@otto/auth"
import { afterEach, describe, it, vi } from "vitest"

import {
  createWorkspaceChatRouter,
  type WorkspaceChatRouteDependencies,
} from "./chat-routes"

const user = {
  email: "test@getyourotto.com",
  firstName: "Test",
  id: "user_123",
  lastName: "User",
}

function createDependencies(): WorkspaceChatRouteDependencies {
  return {
    authenticateWorkspaceUser: async () => user,
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
    createMessage: async ({ conversationId, parts }) => ({
      conversationId,
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
    }),
    getConversationDetail: async () => ({
      conversation: {
        id: "conv_1",
        kind: "ad_hoc",
        lastActivityAt: "2026-04-10T09:30:00.000Z",
        latestMessagePreview: "How are things looking?",
        title: "Portfolio review",
        visibility: "open",
      },
      messages: [],
    }),
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
    syncUserFromSession: async () => undefined,
  }
}

describe("workspace chat routes", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns the workspace chat conversation list", async () => {
    const app = createWorkspaceChatRouter(createDependencies())
    const response = await app.request(
      "http://api.local/api/workspace/otto/chat/conversations",
    )

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

  it("creates a conversation through the workspace chat route", async () => {
    const app = createWorkspaceChatRouter(createDependencies())
    const response = await app.request(
      "http://api.local/api/workspace/otto/chat/conversations",
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
    )

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

  it("returns a conversation detail payload", async () => {
    const app = createWorkspaceChatRouter(createDependencies())
    const response = await app.request(
      "http://api.local/api/workspace/otto/chat/conversations/conv_1",
    )

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
      messages: [],
    })
  })

  it("accepts a message through the workspace chat route", async () => {
    const app = createWorkspaceChatRouter(createDependencies())
    const response = await app.request(
      "http://api.local/api/workspace/otto/chat/conversations/conv_1/messages",
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
    )

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

  it("logs when a workspace chat message create request reaches the API route", async () => {
    const logSpy = vi.spyOn(console, "info").mockImplementation(() => undefined)
    const app = createWorkspaceChatRouter(createDependencies())

    const response = await app.request(
      "http://api.local/api/workspace/otto/chat/conversations/conv_1/messages",
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
    )

    assert.equal(response.status, 202)
    assert.equal(logSpy.mock.calls.length, 1)
    assert.deepEqual(logSpy.mock.calls[0], [
      "[workspace-chat] message create request received",
      {
        conversationId: "conv_1",
        orgSlug: "otto",
        userId: "user_123",
      },
    ])
  })

  it("returns 401 when the workspace session is missing", async () => {
    const app = createWorkspaceChatRouter({
      ...createDependencies(),
      authenticateWorkspaceUser: async () => {
        throw new WorkspaceSessionAuthError(
          "missing_workspace_session",
          "Missing workspace session",
        )
      },
    })
    const response = await app.request(
      "http://api.local/api/workspace/otto/chat/conversations",
    )

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      code: "missing_workspace_session",
      message: "Missing workspace session",
    })
  })
})
