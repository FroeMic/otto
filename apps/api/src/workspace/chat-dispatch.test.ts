import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { dispatchWorkspaceChatMessage } from "./chat-dispatch"

describe("workspace chat dispatch", () => {
  it("enqueues a workspace chat bridge command for the tenant runtime", async () => {
    let queuedPayload:
      | {
          conversationId: string
          message: string
          tenantId: string
        }
      | null = null

    const result = await dispatchWorkspaceChatMessage(
      {
        conversationId: "conv_123",
        message: "Summarize the latest notes.",
        tenantId: "tenant_123",
      },
      {
        enqueueBridgeCommand: async (input) => {
          queuedPayload = input

          return {
            commandId: "cmd_123",
            status: "queued",
          }
        },
      },
    )

    assert.deepEqual(queuedPayload, {
      conversationId: "conv_123",
      message: "Summarize the latest notes.",
      tenantId: "tenant_123",
    })
    assert.equal(result.status, "queued")
  })
})
