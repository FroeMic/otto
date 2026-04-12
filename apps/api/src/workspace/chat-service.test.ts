import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { createAndDispatchWorkspaceChatMessage } from "./chat-service"

describe("workspace chat service", () => {
  it("returns queued when bridge dispatch succeeds", async () => {
    let dispatchInput: Record<string, unknown> | null = null

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
          conversationKind: "ad_hoc",
          conversationTitle: "Portfolio review",
          conversationVisibility: "open",
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
          shouldDispatch: true,
          tenantId: "tenant_1",
        }),
        dispatchMessage: async (input) => {
          dispatchInput = input

          return {
            status: "queued",
          }
        },
      },
    )

    assert.equal(result.dispatch.status, "queued")
    assert.deepEqual(dispatchInput, {
      conversationKind: "ad_hoc",
      conversationId: "conv_1",
      conversationTitle: "Portfolio review",
      conversationVisibility: "open",
      message: "Summarize the latest notes.",
      senderDisplayName: "Test User",
      senderExternalId: "user_1",
      tenantId: "tenant_1",
      userMessageId: "msg_1",
    })
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
          conversationKind: "ad_hoc",
          conversationTitle: "Portfolio review",
          conversationVisibility: "open",
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
          shouldDispatch: true,
          tenantId: "tenant_1",
        }),
        dispatchMessage: async () => {
          throw new Error("tenant runtime unreachable")
        },
      },
    )

    assert.equal(result.dispatch.status, "pending_runtime_bridge")
  })

  it("does not redispatch a duplicate client message that already has bridge state", async () => {
    let dispatchCalled = false

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
            status: "queued",
          },
          conversationKind: "ad_hoc",
          conversationTitle: "Portfolio review",
          conversationVisibility: "open",
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
          shouldDispatch: false,
          tenantId: "tenant_1",
        }),
        dispatchMessage: async () => {
          dispatchCalled = true

          return {
            status: "queued",
          }
        },
      },
    )

    assert.equal(dispatchCalled, false)
    assert.equal(result.dispatch.status, "queued")
  })
})
