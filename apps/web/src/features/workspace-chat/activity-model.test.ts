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
        presentation: entry.presentation,
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
          presentation: undefined,
          status: "completed",
          summary: "Loaded AGENTS.md",
          title: "Read file",
          visibility: "primary",
        },
        {
          events: ["tool.started"],
          id: "tool:evt_4",
          kind: "tool",
          presentation: undefined,
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
          visibility: "debug",
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

  it("derives structured presentation metadata for internal file reads", () => {
    const model = buildWorkspaceChatActivityModel([
      {
        conversationId: "conv_1",
        createdAt: "2026-04-12T10:00:00.000Z",
        id: "evt_1",
        itemId: "tool:call_1",
        messageId: "msg_1",
        payload: {},
        sequence: 1,
        status: "completed",
        title: "read from ~/.openclaw/workspace/memory/2026-04-12.md",
        type: "item.completed",
      },
      {
        conversationId: "conv_1",
        createdAt: "2026-04-12T10:00:01.000Z",
        id: "evt_2",
        itemId: "tool:call_2",
        messageId: "msg_1",
        payload: {},
        sequence: 2,
        status: "completed",
        title: "read from ~/.openclaw/workspace/skills/linear-triage/SKILL.md",
        type: "item.completed",
      },
      {
        conversationId: "conv_1",
        createdAt: "2026-04-12T10:00:02.000Z",
        id: "evt_3",
        itemId: "tool:call_3",
        messageId: "msg_1",
        payload: {},
        sequence: 3,
        status: "completed",
        title:
          "read lines 1-250 from ~/.openclaw/workspace-chat-attachments/conv_1/78b7f653-7866-4fd0-8d17-da5ed100b93f-background-agents-deck.html",
        type: "item.completed",
      },
    ])

    assert.deepEqual(
      model.sections[0]?.entries.map((entry) => ({
        id: entry.id,
        presentation: entry.presentation,
        title: entry.title,
      })),
      [
        {
          id: "item:tool:call_1",
          presentation: {
            iconKey: "memory",
            kind: "memory",
            source: {
              kind: "memory_file",
              memoryKind: "daily_note",
              path: "~/.openclaw/workspace/memory/2026-04-12.md",
            },
            title: "Checked daily memory note",
          },
          title: "Checked daily memory note",
        },
        {
          id: "item:tool:call_2",
          presentation: {
            iconKey: "skill",
            kind: "skill",
            source: {
              documentKind: "skill",
              kind: "skill_document",
              path: "~/.openclaw/workspace/skills/linear-triage/SKILL.md",
              skillKey: "linear-triage",
            },
            title: "Reviewed linear-triage instructions",
          },
          title: "Reviewed linear-triage instructions",
        },
        {
          id: "item:tool:call_3",
          presentation: {
            kind: "read",
            title: "Reviewed attached file background-agents-deck.html",
          },
          title: "Reviewed attached file background-agents-deck.html",
        },
      ],
    )
  })

  it("hides raw internal execution entries from the user-facing trace", () => {
    const model = buildWorkspaceChatActivityModel([
      {
        conversationId: "conv_1",
        createdAt: "2026-04-12T10:00:00.000Z",
        id: "evt_1",
        itemId: "tool:call_1",
        messageId: "msg_1",
        payload: {},
        sequence: 1,
        status: "completed",
        title: "exec run python3 inline script (heredoc)",
        type: "item.completed",
      },
      {
        conversationId: "conv_1",
        createdAt: "2026-04-12T10:00:01.000Z",
        id: "evt_2",
        itemId: "tool:call_2",
        messageId: "msg_1",
        payload: {},
        sequence: 2,
        status: "completed",
        title: "canvas target deck, node abc123",
        type: "item.completed",
      },
      {
        conversationId: "conv_1",
        createdAt: "2026-04-12T10:00:02.000Z",
        id: "evt_3",
        messageId: "msg_1",
        payload: {},
        sequence: 3,
        status: "failed",
        summary: "ModuleNotFoundError: No module named 'bs4'",
        title: "command run python3 inline script (heredoc)",
        type: "command_output.completed",
      },
    ])

    assert.deepEqual(
      model.sections[0]?.entries.map((entry) => ({
        title: entry.title,
        visibility: entry.visibility,
      })),
      [
        {
          title: "exec run python3 inline script (heredoc)",
          visibility: "debug",
        },
        {
          title: "canvas target deck, node abc123",
          visibility: "debug",
        },
        {
          title: "command run python3 inline script (heredoc)",
          visibility: "debug",
        },
      ],
    )
  })
})
