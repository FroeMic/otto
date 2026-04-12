import assert from "node:assert/strict"

import { describe, it } from "vitest"

import {
  createWorkspaceChatRuntimeRouter,
  type WorkspaceChatRuntimeRouteDependencies,
} from "./workspace-chat"

function createDependencies(): WorkspaceChatRuntimeRouteDependencies {
  return {
    applyAssistantDelta: async ({ conversationId, tenantId }) => ({
      applied: true,
      conversationId,
      messageId: "msg_assistant_1",
      tenantId,
    }),
    applyAssistantEvent: async ({
      assistantMessageId,
      conversationId,
      tenantId,
    }) => ({
      conversationId,
      eventId: "evt_1",
      messageId: assistantMessageId,
      tenantId,
    }),
    authenticateTenantRuntime: async () => ({
      tenantId: "tenant_1",
    }),
    completeAssistantMessage: async ({ conversationId, tenantId }) => ({
      conversationId,
      messageId: "msg_assistant_1",
      runtimeSegmentId: "segment_1",
      tenantId,
    }),
  }
}

describe("workspace chat runtime routes", () => {
  it("accepts an assistant completion callback from a tenant runtime", async () => {
    let receivedAssistantMessageId: string | undefined
    const appWithSpy = createWorkspaceChatRuntimeRouter({
      ...createDependencies(),
      completeAssistantMessage: async ({
        assistantMessageId,
        conversationId,
        tenantId,
      }) => {
        receivedAssistantMessageId = assistantMessageId

        return {
          conversationId,
          messageId: assistantMessageId ?? "msg_assistant_1",
          runtimeSegmentId: "segment_1",
          tenantId,
        }
      },
    })

    const response = await appWithSpy.request(
      "http://api.local/api/internal/runtime/workspace-chat/messages/complete",
      {
        body: JSON.stringify({
          assistantMessageId: "msg_assistant_1",
          conversationId: "conv_1",
          message: {
            parts: [
              {
                text: "Here is the answer.",
                type: "text",
              },
            ],
          },
          session: {
            externalSessionId: "external_session_1",
            sessionKey: "workspace:conv_1",
            status: "completed",
          },
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      conversationId: "conv_1",
      messageId: "msg_assistant_1",
      ok: true,
      runtimeSegmentId: "segment_1",
      tenantId: "tenant_1",
    })
    assert.equal(receivedAssistantMessageId, "msg_assistant_1")
  })

  it("accepts an assistant delta callback from a tenant runtime", async () => {
    let receivedAssistantMessageId: string | undefined
    let receivedSequence = -1
    const appWithSpy = createWorkspaceChatRuntimeRouter({
      ...createDependencies(),
      applyAssistantDelta: async ({
        assistantMessageId,
        conversationId,
        sequence,
        tenantId,
      }) => {
        receivedAssistantMessageId = assistantMessageId
        receivedSequence = sequence

        return {
          applied: true,
          conversationId,
          messageId: assistantMessageId,
          tenantId,
        }
      },
    })

    const response = await appWithSpy.request(
      "http://api.local/api/internal/runtime/workspace-chat/messages/delta",
      {
        body: JSON.stringify({
          assistantMessageId: "msg_assistant_1",
          conversationId: "conv_1",
          message: {
            text: "Here is the partial answer.",
          },
          sequence: 3,
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      applied: true,
      conversationId: "conv_1",
      messageId: "msg_assistant_1",
      ok: true,
      tenantId: "tenant_1",
    })
    assert.equal(receivedAssistantMessageId, "msg_assistant_1")
    assert.equal(receivedSequence, 3)
  })

  it("returns 404 when the conversation is not available to the tenant", async () => {
    const app = createWorkspaceChatRuntimeRouter({
      ...createDependencies(),
      completeAssistantMessage: async () => null,
    })

    const response = await app.request(
      "http://api.local/api/internal/runtime/workspace-chat/messages/complete",
      {
        body: JSON.stringify({
          conversationId: "conv_missing",
          message: {
            parts: [
              {
                text: "Here is the answer.",
                type: "text",
              },
            ],
          },
          session: {
            sessionKey: "workspace:conv_missing",
            status: "completed",
          },
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      },
    )

    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), {
      error: "Workspace chat conversation not found for this tenant runtime.",
    })
  })

  it("returns 404 when a delta targets a conversation that is not available to the tenant", async () => {
    const app = createWorkspaceChatRuntimeRouter({
      ...createDependencies(),
      applyAssistantDelta: async () => null,
    })

    const response = await app.request(
      "http://api.local/api/internal/runtime/workspace-chat/messages/delta",
      {
        body: JSON.stringify({
          assistantMessageId: "msg_assistant_missing",
          conversationId: "conv_missing",
          message: {
            text: "Here is the partial answer.",
          },
          sequence: 1,
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      },
    )

    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), {
      error: "Workspace chat conversation not found for this tenant runtime.",
    })
  })

  it("accepts a failed assistant callback from a tenant runtime", async () => {
    let receivedAssistantMessageId: string | undefined
    let receivedError: string | undefined
    const appWithSpy = createWorkspaceChatRuntimeRouter({
      ...createDependencies(),
      failAssistantMessage: async ({
        assistantMessageId,
        conversationId,
        error,
        tenantId,
      }) => {
        receivedAssistantMessageId = assistantMessageId
        receivedError = error

        return {
          conversationId,
          messageId: assistantMessageId,
          tenantId,
        }
      },
    })

    const response = await appWithSpy.request(
      "http://api.local/api/internal/runtime/workspace-chat/messages/fail",
      {
        body: JSON.stringify({
          assistantMessageId: "msg_assistant_1",
          conversationId: "conv_1",
          error: "embedded run failed",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      conversationId: "conv_1",
      messageId: "msg_assistant_1",
      ok: true,
      tenantId: "tenant_1",
    })
    assert.equal(receivedAssistantMessageId, "msg_assistant_1")
    assert.equal(receivedError, "embedded run failed")
  })

  it("accepts an assistant activity event callback from a tenant runtime", async () => {
    let receivedSequence = -1
    let receivedType = ""
    const appWithSpy = createWorkspaceChatRuntimeRouter({
      ...createDependencies(),
      applyAssistantEvent: async ({
        assistantMessageId,
        conversationId,
        event,
        tenantId,
      }) => {
        receivedSequence = event.sequence
        receivedType = event.type

        return {
          conversationId,
          eventId: "evt_1",
          messageId: assistantMessageId,
          tenantId,
        }
      },
    })

    const response = await appWithSpy.request(
      "http://api.local/api/internal/runtime/workspace-chat/messages/events",
      {
        body: JSON.stringify({
          assistantMessageId: "msg_assistant_1",
          conversationId: "conv_1",
          event: {
            payload: {
              toolName: "read_file",
            },
            sequence: 1,
            status: "running",
            title: "Read file",
            type: "tool.started",
          },
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      conversationId: "conv_1",
      eventId: "evt_1",
      messageId: "msg_assistant_1",
      ok: true,
      tenantId: "tenant_1",
    })
    assert.equal(receivedSequence, 1)
    assert.equal(receivedType, "tool.started")
  })

  it("accepts richer assistant activity event types from a tenant runtime", async () => {
    let receivedType = ""
    const appWithSpy = createWorkspaceChatRuntimeRouter({
      ...createDependencies(),
      applyAssistantEvent: async ({
        assistantMessageId,
        conversationId,
        event,
        tenantId,
      }) => {
        receivedType = event.type

        return {
          conversationId,
          eventId: "evt_2",
          messageId: assistantMessageId,
          tenantId,
        }
      },
    })

    const response = await appWithSpy.request(
      "http://api.local/api/internal/runtime/workspace-chat/messages/events",
      {
        body: JSON.stringify({
          assistantMessageId: "msg_assistant_1",
          conversationId: "conv_1",
          event: {
            payload: {
              text: "Inspecting the code path",
            },
            sequence: 2,
            status: "running",
            title: "Thinking",
            type: "thinking.delta",
          },
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      },
    )

    assert.equal(response.status, 200)
    assert.equal(receivedType, "thinking.delta")
  })
})
