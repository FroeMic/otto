import assert from "node:assert/strict"

import { describe, it } from "vitest"

import {
  buildWorkspaceChatAgentCommand,
  dispatchWorkspaceChatMessage,
} from "./chat-dispatch"

describe("workspace chat dispatch", () => {
  it("builds an OpenClaw agent command that targets the workspace channel", () => {
    const command = buildWorkspaceChatAgentCommand({
      conversationId: "conv_123",
      message: "Summarize the latest notes.",
    })

    assert.match(command, /docker exec openclaw-gateway node dist\/index\.js agent/)
    assert.match(command, /--message 'Summarize the latest notes\.'/)
    assert.match(command, /--to 'workspace:conv_123'/)
    assert.match(command, /--channel 'otto-workspace-chat'/)
    assert.match(command, /--reply-channel 'otto-workspace-chat'/)
    assert.match(command, /--reply-to 'workspace:conv_123'/)
    assert.match(command, /--deliver/)
    assert.match(command, /--json/)
  })

  it("dispatches a workspace chat turn through the resolved tenant runtime connection", async () => {
    let resolvedConnectionContext = ""
    let executedCommand = ""

    const result = await dispatchWorkspaceChatMessage(
      {
        conversationId: "conv_123",
        message: "Summarize the latest notes.",
        tenantId: "tenant_123",
      },
      {
        execRemoteCommand: async (_connection, command) => {
          executedCommand = command

          return {
            exitCode: 0,
            stderr: "",
            stdout: JSON.stringify({ ok: true }),
          }
        },
        resolveTenantRuntimeConnection: async (_tenantId, context) => {
          resolvedConnectionContext = context

          return {
            host: "203.0.113.20",
            username: "root",
          }
        },
      },
    )

    assert.equal(resolvedConnectionContext, "workspace chat dispatch")
    assert.match(executedCommand, /workspace:conv_123/)
    assert.equal(result.status, "sent")
  })
})
