import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { buildWorkspaceChatActivityModel } from "./activity-model"

describe("workspace chat activity model", () => {
  it("derives grouped activity sections and entry visibility from raw events", () => {
    const model = buildWorkspaceChatActivityModel([
      {
        conversationId: "conv_1",
        createdAt: "2026-04-12T10:00:00.000Z",
        id: "evt_1",
        messageId: "msg_1",
        payload: {},
        sequence: 1,
        status: "running",
        title: "Started",
        type: "lifecycle.started",
      },
      {
        conversationId: "conv_1",
        createdAt: "2026-04-12T10:00:00.500Z",
        id: "evt_2",
        messageId: "msg_1",
        payload: {},
        sequence: 2,
        status: "running",
        title: "Assistant message",
        type: "assistant_message.started",
      },
      {
        conversationId: "conv_1",
        createdAt: "2026-04-12T10:00:01.000Z",
        id: "evt_3",
        itemId: "item_1",
        messageId: "msg_1",
        payload: {},
        sequence: 3,
        status: "running",
        title: "Read file",
        type: "item.started",
      },
      {
        conversationId: "conv_1",
        createdAt: "2026-04-12T10:00:01.200Z",
        id: "evt_4",
        messageId: "msg_1",
        payload: {},
        sequence: 4,
        status: "running",
        title: "read",
        type: "tool.started",
      },
      {
        conversationId: "conv_1",
        createdAt: "2026-04-12T10:00:02.000Z",
        id: "evt_5",
        itemId: "item_1",
        messageId: "msg_1",
        payload: {},
        sequence: 5,
        status: "completed",
        summary: "Loaded AGENTS.md",
        title: "Read file",
        type: "item.completed",
      },
      {
        conversationId: "conv_1",
        createdAt: "2026-04-12T10:00:02.500Z",
        id: "evt_6",
        messageId: "msg_1",
        payload: {
          text: "Inspecting the current code path",
        },
        sequence: 6,
        status: "running",
        title: "Thinking",
        type: "thinking.started",
      },
      {
        conversationId: "conv_1",
        createdAt: "2026-04-12T10:00:03.000Z",
        id: "evt_7",
        messageId: "msg_1",
        payload: {
          text: "Found the relevant workspace reducer",
        },
        sequence: 7,
        status: "completed",
        summary: "Found the relevant workspace reducer",
        title: "Thinking",
        type: "thinking.completed",
      },
      {
        conversationId: "conv_1",
        createdAt: "2026-04-12T10:00:03.500Z",
        id: "evt_8",
        itemId: "approval_1",
        messageId: "msg_1",
        payload: {},
        sequence: 8,
        status: "pending",
        title: "Run command",
        type: "approval.requested",
      },
      {
        conversationId: "conv_1",
        createdAt: "2026-04-12T10:00:04.000Z",
        id: "evt_9",
        messageId: "msg_1",
        payload: {},
        sequence: 9,
        status: "completed",
        title: "Completed",
        type: "lifecycle.completed",
      },
    ])

    assert.equal(model.eventCount, 9)
    assert.equal(model.status, "completed")
    assert.equal(model.activeCount, 1)
    assert.deepEqual(
      model.sections.map((section) => section.kind),
      ["work", "approvals", "thinking", "system"],
    )

    assert.deepEqual(
      model.sections[0]?.entries.map((entry) => ({
        events: entry.events.map((event) => event.type),
        id: entry.id,
        kind: entry.kind,
        status: entry.status,
        summary: entry.summary,
        title: entry.title,
        visibility: entry.visibility,
      })),
      [
        {
          events: ["item.started", "item.completed"],
          id: "item:item_1",
          kind: "item",
          status: "completed",
          summary: "Loaded AGENTS.md",
          title: "Read file",
          visibility: "primary",
        },
        {
          events: ["tool.started"],
          id: "tool:evt_4",
          kind: "tool",
          status: "running",
          summary: undefined,
          title: "read",
          visibility: "debug",
        },
      ],
    )

    assert.deepEqual(
      model.sections[1]?.entries.map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        status: entry.status,
        title: entry.title,
        visibility: entry.visibility,
      })),
      [
        {
          id: "approval:approval_1",
          kind: "approval",
          status: "pending",
          title: "Run command",
          visibility: "primary",
        },
      ],
    )

    assert.deepEqual(
      model.sections[2]?.entries.map((entry) => ({
        events: entry.events.map((event) => event.type),
        id: entry.id,
        kind: entry.kind,
        status: entry.status,
        summary: entry.summary,
        title: entry.title,
        visibility: entry.visibility,
      })),
      [
        {
          events: ["thinking.started", "thinking.completed"],
          id: "thinking",
          kind: "thinking",
          status: "completed",
          summary: "Found the relevant workspace reducer",
          title: "Thinking",
          visibility: "secondary",
        },
      ],
    )

    assert.deepEqual(
      model.sections[3]?.entries.map((entry) => ({
        events: entry.events.map((event) => event.type),
        id: entry.id,
        kind: entry.kind,
        status: entry.status,
        title: entry.title,
        visibility: entry.visibility,
      })),
      [
        {
          events: ["lifecycle.started", "lifecycle.completed"],
          id: "lifecycle",
          kind: "lifecycle",
          status: "completed",
          title: "Completed",
          visibility: "primary",
        },
        {
          events: ["assistant_message.started"],
          id: "assistant_message",
          kind: "assistant_message",
          status: "running",
          title: "Assistant message",
          visibility: "debug",
        },
      ],
    )
  })
})
