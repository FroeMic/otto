import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { dispatchWorkspaceChatMessage } from "./chat-dispatch"

describe("workspace chat dispatch", () => {
  it("enqueues a workspace chat worker job for the tenant runtime", async () => {
    let queuedPayload:
      | {
          assistantMessageId?: string
          conversationId: string
          message: string
          tenantId: string
        }
      | null = null

    const result = await dispatchWorkspaceChatMessage(
      {
        assistantMessageId: "assistant_msg_123",
        conversationId: "conv_123",
        message: "Summarize the latest notes.",
        tenantId: "tenant_123",
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
      conversationId: "conv_123",
      message: "Summarize the latest notes.",
      tenantId: "tenant_123",
    })
    assert.equal(result.status, "queued")
  })
})
