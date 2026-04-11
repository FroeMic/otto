import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { createAndDispatchWorkspaceChatMessage } from "./chat-service"

describe("workspace chat service", () => {
  it("returns queued when bridge dispatch succeeds", async () => {
    const result = await createAndDispatchWorkspaceChatMessage(
      {
        clientMessageId: "client-msg-1",
        conversationId: "conv_1",
        orgSlug: "otto",
        parts: [
          {
            text: "Summarize the latest notes.",
            type: "text",
          },
        ],
        userDisplayName: "Test User",
        userExternalId: "user_1",
      },
      {
        createMessageRecord: async () => ({
          conversationId: "conv_1",
          dispatch: {
            status: "pending_runtime_bridge",
          },
          message: {
            author: {
              kind: "user",
              name: "Test User",
              userId: "user_1",
            },
            createdAt: "2026-04-10T12:00:00.000Z",
            id: "msg_1",
            parts: [
              {
                text: "Summarize the latest notes.",
                type: "text",
              },
            ],
            status: "completed",
          },
          tenantId: "tenant_1",
        }),
        dispatchMessage: async () => ({
          status: "queued",
        }),
      },
    )

    assert.equal(result.dispatch.status, "queued")
  })

  it("keeps the message persisted when runtime dispatch fails", async () => {
    const result = await createAndDispatchWorkspaceChatMessage(
      {
        conversationId: "conv_1",
        orgSlug: "otto",
        parts: [
          {
            text: "Summarize the latest notes.",
            type: "text",
          },
        ],
        userDisplayName: "Test User",
        userExternalId: "user_1",
      },
      {
        createMessageRecord: async () => ({
          conversationId: "conv_1",
          dispatch: {
            status: "pending_runtime_bridge",
          },
          message: {
            author: {
              kind: "user",
              name: "Test User",
              userId: "user_1",
            },
            createdAt: "2026-04-10T12:00:00.000Z",
            id: "msg_1",
            parts: [
              {
                text: "Summarize the latest notes.",
                type: "text",
              },
            ],
            status: "completed",
          },
          tenantId: "tenant_1",
        }),
        dispatchMessage: async () => {
          throw new Error("tenant runtime unreachable")
        },
      },
    )

    assert.equal(result.dispatch.status, "pending_runtime_bridge")
  })
})
