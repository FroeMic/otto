import { describe, expect, it, vi } from "vitest"

import { processRunWorkspaceChatTurnJob } from "./workspace-chat"

describe("workspace chat worker job", () => {
  it("invokes the tenant gateway method for a queued workspace turn", async () => {
    const appendJobEvent = vi.fn(async () => undefined)
    const invokeWorkspaceChatTurn = vi.fn(async () => ({
      ok: true as const,
      sessionKey: "workspace:conv_1?assistantMessageId=msg_1",
    }))
    const markJobSucceeded = vi.fn(async () => undefined)

    await processRunWorkspaceChatTurnJob(
      {
        attempt: 1,
        id: "job_1",
        jobType: "run_workspace_chat_turn",
        payload: {
          assistantMessageId: "msg_1",
          conversationId: "conv_1",
          message: "Summarize the latest notes.",
          tenantId: "tenant_1",
        },
        tenantId: "tenant_1",
      },
      {
        appendJobEvent,
        getTenantRuntimeConnection: async () => ({
          host: "203.0.113.10",
          port: 22,
          username: "root",
        }),
        getTenantRuntimeGatewayToken: async () => "gateway-token",
        getTenantRuntimeTenantToken: async () => "tenant-token",
        invokeWorkspaceChatTurn,
        markAssistantMessageFailed: vi.fn(async () => undefined),
        markJobFailed: vi.fn(async () => undefined),
        markJobSucceeded,
      },
    )

    expect(invokeWorkspaceChatTurn).toHaveBeenCalledWith({
      assistantMessageId: "msg_1",
      connection: {
        host: "203.0.113.10",
        port: 22,
        username: "root",
      },
      conversationId: "conv_1",
      gatewayToken: "gateway-token",
      message: "Summarize the latest notes.",
    })
    expect(markJobSucceeded).toHaveBeenCalledWith("job_1", {
      conversationId: "conv_1",
      sessionKey: "workspace:conv_1?assistantMessageId=msg_1",
      tenantId: "tenant_1",
    })
    expect(appendJobEvent).toHaveBeenCalled()
  })

  it("marks the assistant placeholder failed when tenant trigger startup fails", async () => {
    const markAssistantMessageFailed = vi.fn(async () => undefined)
    const markJobFailed = vi.fn(async () => undefined)

    await processRunWorkspaceChatTurnJob(
      {
        attempt: 1,
        id: "job_1",
        jobType: "run_workspace_chat_turn",
        payload: {
          assistantMessageId: "msg_1",
          conversationId: "conv_1",
          message: "Summarize the latest notes.",
          tenantId: "tenant_1",
        },
        tenantId: "tenant_1",
      },
      {
        appendJobEvent: vi.fn(async () => undefined),
        getTenantRuntimeConnection: async () => ({
          host: "203.0.113.10",
          port: 22,
          username: "root",
        }),
        getTenantRuntimeGatewayToken: async () => "gateway-token",
        getTenantRuntimeTenantToken: async () => "tenant-token",
        invokeWorkspaceChatTurn: vi.fn(async () => {
          throw new Error("gateway call failed")
        }),
        markAssistantMessageFailed,
        markJobFailed,
        markJobSucceeded: vi.fn(async () => undefined),
      },
    )

    expect(markAssistantMessageFailed).toHaveBeenCalledWith({
      assistantMessageId: "msg_1",
      conversationId: "conv_1",
      error: "gateway call failed",
      tenantId: "tenant_1",
    })
    expect(markJobFailed).toHaveBeenCalledWith("job_1", "gateway call failed")
  })
})
