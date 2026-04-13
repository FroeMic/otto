import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { createAndDispatchWorkspaceChatMessage } from "./chat-service"

describe("workspace chat service", () => {
  it("returns queued when runtime ingress enqueue succeeds", async () => {
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
          shouldDispatch: true,
          tenantId: "tenant_1",
        }),
        dispatchMessage: async (input) => {
          dispatchInput = input

          return {
            status: "queued",
          }
        },
        validateAttachmentOwnership: async () => undefined,
      },
    )

    assert.equal(result.dispatch.status, "queued")
    assert.deepEqual(dispatchInput, {
      conversationKind: "ad_hoc",
      conversationId: "conv_1",
      conversationTitle: "Portfolio review",
      conversationVisibility: "open",
      parts: [
        {
          text: "Summarize the latest notes.",
          type: "text",
        },
      ],
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
          shouldDispatch: true,
          tenantId: "tenant_1",
        }),
        dispatchMessage: async () => {
          throw new Error("tenant runtime unreachable")
        },
        validateAttachmentOwnership: async () => undefined,
      },
    )

    assert.equal(result.dispatch.status, "failed")
  })

  it("does not redispatch a duplicate client message that already has runtime dispatch state", async () => {
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
        validateAttachmentOwnership: async () => undefined,
      },
    )

    assert.equal(dispatchCalled, false)
    assert.equal(result.dispatch.status, "queued")
  })

  it("validates uploaded attachment ownership before persisting the message", async () => {
    let validatedAttachmentIds: string[] | null = null

    await createAndDispatchWorkspaceChatMessage(
      {
        conversationId: "conv_1",
        orgSlug: "otto",
        parts: [
          {
            attachmentId: "att_1",
            fileName: "notes.txt",
            mimeType: "text/plain",
            type: "file",
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
                attachmentId: "att_1",
                fileName: "notes.txt",
                mimeType: "text/plain",
                type: "file",
              },
            ],
            status: "completed",
          },
          shouldDispatch: false,
          tenantId: "tenant_1",
        }),
        validateAttachmentOwnership: async ({ attachmentIds }) => {
          validatedAttachmentIds = attachmentIds
        },
      },
    )

    assert.deepEqual(validatedAttachmentIds, ["att_1"])
  })
})
