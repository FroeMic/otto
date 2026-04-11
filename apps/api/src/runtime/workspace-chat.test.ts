import assert from "node:assert/strict"

import { describe, it } from "vitest"

import {
  createWorkspaceChatRuntimeRouter,
  type WorkspaceChatRuntimeRouteDependencies,
} from "./workspace-chat"

function createDependencies(): WorkspaceChatRuntimeRouteDependencies {
  return {
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
})
