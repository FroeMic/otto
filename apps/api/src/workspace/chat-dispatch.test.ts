import assert from "node:assert/strict"
import type { WorkspaceChatMessagePart } from "@otto/feature-workspace-chat"

import { describe, it } from "vitest"

import { dispatchWorkspaceChatMessage } from "./chat-dispatch"

describe("workspace chat dispatch", () => {
  it("enqueues a workspace chat worker job for the tenant runtime", async () => {
    let queuedPayload: {
      assistantMessageId?: string
      conversationKind: "ad_hoc" | "durable_named" | "external_surface"
      conversationId: string
      conversationTitle: string
      conversationVisibility: "open" | "personal"
      parts: WorkspaceChatMessagePart[]
      senderDisplayName: string
      senderExternalId: string
      tenantId: string
      userMessageId: string
    } | null = null

    const result = await dispatchWorkspaceChatMessage(
      {
        assistantMessageId: "assistant_msg_123",
        conversationKind: "ad_hoc",
        conversationId: "conv_123",
        conversationTitle: "Portfolio review",
        conversationVisibility: "open",
        parts: [
          {
            text: "Summarize the latest notes.",
            type: "text",
          },
        ],
        senderDisplayName: "Michael Froehlich",
        senderExternalId: "user_123",
        tenantId: "tenant_123",
        userMessageId: "msg_user_123",
      },
      {
        enqueueRunJob: async (input) => {
          queuedPayload = input

          return {
            jobId: "job_123",
            status: "queued",
          }
        },
      },
    )

    assert.deepEqual(queuedPayload, {
      assistantMessageId: "assistant_msg_123",
      conversationKind: "ad_hoc",
      conversationId: "conv_123",
      conversationTitle: "Portfolio review",
      conversationVisibility: "open",
      parts: [
        {
          text: "Summarize the latest notes.",
          type: "text",
        },
      ],
      senderDisplayName: "Michael Froehlich",
      senderExternalId: "user_123",
      tenantId: "tenant_123",
      userMessageId: "msg_user_123",
    })
    assert.equal(result.status, "queued")
  })
})
