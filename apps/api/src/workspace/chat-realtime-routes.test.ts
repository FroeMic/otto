import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { WorkspaceSessionAuthError } from "@otto/auth"

import { createWorkspaceChatRealtimeHub } from "./chat-realtime-hub"
import { createWorkspaceChatRealtimeRouter } from "./chat-realtime-routes"

const user = {
  email: "test@getyourotto.com",
  firstName: "Test",
  id: "user_123",
  lastName: "User",
}

describe("workspace chat realtime routes", () => {
  it("returns 401 when the workspace session is missing", async () => {
    const app = createWorkspaceChatRealtimeRouter({
      authenticateWorkspaceUser: async () => {
        throw new WorkspaceSessionAuthError(
          "missing_workspace_session",
          "Missing workspace session",
        )
      },
      canAccessConversation: async () => false,
      realtimeHub: createWorkspaceChatRealtimeHub(),
      syncUserFromSession: async () => undefined,
    })

    const response = await app.request(
      "http://api.local/api/workspace/otto/chat/realtime",
    )

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      code: "missing_workspace_session",
      message: "Missing workspace session",
    })
  })

  it("upgrades an authenticated websocket and delivers events after subscribe", async () => {
    const realtimeHub = createWorkspaceChatRealtimeHub()
    const app = createWorkspaceChatRealtimeRouter({
      authenticateWorkspaceUser: async () => user,
      canAccessConversation: async () => true,
      realtimeHub,
      syncUserFromSession: async () => undefined,
    })

    const receivedMessages: string[] = []
    let capturedEvents:
      | {
          onMessage?: (event: MessageEvent, ws: { send: (data: string) => void }) => void
          onOpen?: (event: Event, ws: { send: (data: string) => void }) => void
        }
      | undefined

    const response = await app.fetch(
      new Request("http://api.local/api/workspace/otto/chat/realtime"),
      {
        upgrade(_request: Request, options: { data: { events: typeof capturedEvents } }) {
          capturedEvents = options.data.events
          return true
        },
      } as never,
    )

    assert.equal(response.status, 200)
    assert.ok(capturedEvents)

    const ws = {
      send(data: string) {
        receivedMessages.push(data)
      },
    }

    capturedEvents?.onOpen?.(new Event("open"), ws)
    capturedEvents?.onMessage?.(
      new MessageEvent("message", {
        data: JSON.stringify({
          conversationId: "conv_1",
          type: "subscribe",
        }),
      }),
      ws,
    )

    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    await realtimeHub.publish({
      conversationId: "conv_1",
      message: {
        author: {
          kind: "assistant",
          name: "Otto",
        },
        createdAt: "2026-04-11T18:00:00.000Z",
        id: "msg_1",
        parts: [],
        status: "streaming",
      },
      type: "conversation.message_upserted",
    })

    assert.equal(receivedMessages.length, 2)

    const subscribedMessage = JSON.parse(receivedMessages[0] ?? "")
    const publishedMessage = JSON.parse(receivedMessages[1] ?? "")

    assert.equal(subscribedMessage.type, "subscribed")
    assert.equal(subscribedMessage.conversationId, "conv_1")
    assert.equal(publishedMessage.type, "conversation.message_upserted")
    assert.equal(publishedMessage.message.id, "msg_1")
  })

  it("calls Bun server upgrade with the server as this binding", async () => {
    const app = createWorkspaceChatRealtimeRouter({
      authenticateWorkspaceUser: async () => user,
      canAccessConversation: async () => true,
      realtimeHub: createWorkspaceChatRealtimeHub(),
      syncUserFromSession: async () => undefined,
    })
    const server = {
      upgrade(
        this: { upgrade: unknown },
        _request: Request,
        _options: { data: { events: unknown } },
      ) {
        assert.equal(this, server)
        return true
      },
    }

    const response = await app.fetch(
      new Request("http://api.local/api/workspace/otto/chat/realtime"),
      server as never,
    )

    assert.equal(response.status, 200)
  })

  it("sends subscription_denied when the conversation is not accessible", async () => {
    const app = createWorkspaceChatRealtimeRouter({
      authenticateWorkspaceUser: async () => user,
      canAccessConversation: async () => false,
      realtimeHub: createWorkspaceChatRealtimeHub(),
      syncUserFromSession: async () => undefined,
    })

    const receivedMessages: string[] = []
    let capturedEvents:
      | {
          onMessage?: (event: MessageEvent, ws: { send: (data: string) => void }) => void
          onOpen?: (event: Event, ws: { send: (data: string) => void }) => void
        }
      | undefined

    const response = await app.fetch(
      new Request("http://api.local/api/workspace/otto/chat/realtime"),
      {
        upgrade(_request: Request, options: { data: { events: typeof capturedEvents } }) {
          capturedEvents = options.data.events
          return true
        },
      } as never,
    )

    assert.equal(response.status, 200)
    assert.ok(capturedEvents)

    const ws = {
      send(data: string) {
        receivedMessages.push(data)
      },
    }

    capturedEvents?.onOpen?.(new Event("open"), ws)
    capturedEvents?.onMessage?.(
      new MessageEvent("message", {
        data: JSON.stringify({
          conversationId: "conv_denied",
          type: "subscribe",
        }),
      }),
      ws,
    )

    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    assert.equal(receivedMessages.length, 1)
    assert.deepEqual(JSON.parse(receivedMessages[0] ?? ""), {
      conversationId: "conv_denied",
      type: "subscription_denied",
    })
  })
})
