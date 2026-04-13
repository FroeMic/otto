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
        originKind: "manual",
        title,
        visibility,
      },
    }),
    createAttachment: async (payload) => ({
      fileName: payload.file.name,
      id: "att_1",
      mimeType: payload.file.type || "application/octet-stream",
      sizeBytes: payload.file.size,
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
        originKind: "manual",
        title: "Portfolio review",
        visibility: "open",
      },
      messageEvents: [],
      messages: [],
    }),
    listConversations: async () => ({
      conversations: [
        {
          id: "conv_1",
          kind: "ad_hoc",
          lastActivityAt: "2026-04-10T09:30:00.000Z",
          latestMessagePreview: "Hello from Otto",
          originKind: "manual",
          title: "Portfolio review",
          visibility: "open",
        },
      ],
      nextCursor: null,
    }),
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
          originKind: "manual",
          title: "Portfolio review",
          visibility: "open",
        },
      ],
      nextCursor: null,
    })
  })

  it("forwards pagination query params for conversation history", async () => {
    const listConversations = vi.fn(async () => ({
      conversations: [],
      nextCursor: null,
    }))
    const app = createWorkspaceChatRouter({
      ...createDependencies(),
      listConversations,
    })

    const response = await app.request(
      "http://api.local/api/workspace/otto/chat/conversations?cursor=cursor_123&limit=20",
    )

    assert.equal(response.status, 200)
    assert.equal(listConversations.mock.calls.length, 1)
    assert.deepEqual(
      ((listConversations.mock.calls[0] as unknown as [unknown]) ?? [])[0],
      {
      cursor: "cursor_123",
      limit: 20,
      orgSlug: "otto",
      userExternalId: "user_123",
      },
    )
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
        originKind: "manual",
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
        originKind: "manual",
        title: "Portfolio review",
        visibility: "open",
      },
      messageEvents: [],
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

  it("uploads a workspace chat attachment through the workspace route", async () => {
    const app = createWorkspaceChatRouter(createDependencies())
    const formData = new FormData()
    formData.set(
      "file",
      new File(["hello world"], "notes.txt", { type: "text/plain" }),
    )

    const response = await app.request(
      "http://api.local/api/workspace/otto/chat/attachments",
      {
        body: formData,
        method: "POST",
      },
    )

    assert.equal(response.status, 201)
    assert.deepEqual(await response.json(), {
      attachment: {
        fileName: "notes.txt",
        id: "att_1",
        mimeType: "text/plain",
        sizeBytes: 11,
      },
    })
  })

  it("returns 400 when a workspace chat attachment upload omits the file", async () => {
    const app = createWorkspaceChatRouter(createDependencies())

    const response = await app.request(
      "http://api.local/api/workspace/otto/chat/attachments",
      {
        body: new FormData(),
        method: "POST",
      },
    )

    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), {
      error: "Workspace chat attachment file is required.",
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
