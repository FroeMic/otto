import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { buildWorkspaceChatActivityView } from "./activity"

describe("workspace chat activity view", () => {
  it("groups related message events into stable activity rows", () => {
    const view = buildWorkspaceChatActivityView([
      {
        conversationId: "conv_1",
        createdAt: "2026-04-12T10:00:00.000Z",
        id: "evt_1",
        itemId: "tool_1",
        messageId: "msg_1",
        payload: {},
        sequence: 1,
        status: "running",
        title: "Read file",
        type: "tool.started",
      },
      {
        conversationId: "conv_1",
        createdAt: "2026-04-12T10:00:02.000Z",
        id: "evt_2",
        itemId: "tool_1",
        messageId: "msg_1",
        payload: {},
        sequence: 2,
        status: "completed",
        summary: "Loaded AGENTS.md",
        title: "Read file",
        type: "tool.completed",
      },
      {
        conversationId: "conv_1",
        createdAt: "2026-04-12T10:00:03.000Z",
        id: "evt_3",
        itemId: "approval_1",
        messageId: "msg_1",
        payload: {},
        sequence: 3,
        status: "pending",
        title: "Run command",
        type: "approval.requested",
      },
    ])

    assert.equal(view.totalEvents, 3)
    assert.equal(view.rows.length, 2)
    assert.equal(view.activeCount, 1)
    assert.equal(view.summaryLabel, "Activity (1 active)")
    assert.deepEqual(view.rows[0], {
      events: ["tool.started", "tool.completed"],
      id: "tool:tool_1",
      kind: "tool",
      status: "completed",
      summary: "Loaded AGENTS.md",
      title: "Read file",
    })
    assert.deepEqual(view.rows[1], {
      events: ["approval.requested"],
      id: "approval:approval_1",
      kind: "approval",
      status: "pending",
      summary: undefined,
      title: "Run command",
    })
  })
})
