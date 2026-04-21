import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { buildWorkspaceChatActivityModel } from "./activity-model"
import {
  formatWorkspaceChatActivityDuration,
  getActivityLeadLine,
  getActivityLeadTitle,
  getWorkspaceChatLoadingVerb,
  getWorkspaceChatPendingLabel,
} from "./trace-presentation"

describe("workspace chat trace presentation helpers", () => {
  it("chooses stable loading verbs with a longer interval between changes", () => {
    assert.equal(
      getWorkspaceChatLoadingVerb({
        elapsedMs: 0,
        seed: "msg_alpha",
      }),
      getWorkspaceChatLoadingVerb({
        elapsedMs: 0,
        seed: "msg_alpha",
      }),
    )
    assert.notEqual(
      getWorkspaceChatLoadingVerb({
        elapsedMs: 0,
        seed: "msg_alpha",
      }),
      getWorkspaceChatLoadingVerb({
        elapsedMs: 0,
        seed: "msg_beta",
      }),
    )
    assert.notEqual(
      getWorkspaceChatLoadingVerb({
        elapsedMs: 0,
        seed: "msg_alpha",
      }),
      getWorkspaceChatLoadingVerb({
        elapsedMs: 15_000,
        seed: "msg_alpha",
      }),
    )
    assert.equal(
      getWorkspaceChatLoadingVerb({
        elapsedMs: 5000,
        seed: "msg_alpha",
      }),
      getWorkspaceChatLoadingVerb({
        elapsedMs: 0,
        seed: "msg_alpha",
      }),
    )
  })

  it("uses the rotating verb for pending and streaming states", () => {
    const label = getWorkspaceChatPendingLabel({
      elapsedMs: 3200,
      seed: "msg_alpha",
      status: "pending",
    })

    assert.match(label ?? "", /^[A-Z][a-z]+…$/)
    assert.equal(
      getWorkspaceChatPendingLabel({
        elapsedMs: 0,
        status: "failed",
      }),
      "Otto could not complete this reply.",
    )
  })

  it("formats a human duration label for the trace header", () => {
    assert.equal(
      formatWorkspaceChatActivityDuration({
        now: Date.parse("2026-04-13T10:00:07.000Z"),
        startedAt: "2026-04-13T10:00:00.000Z",
      }),
      "Worked for 7 seconds",
    )
  })

  it("uses the latest visible activity entry for the lead line", () => {
    const activityModel = buildWorkspaceChatActivityModel([
      {
        conversationId: "conv_1",
        createdAt: "2026-04-13T10:00:00.000Z",
        id: "evt_1",
        messageId: "msg_1",
        payload: {},
        sequence: 1,
        status: "running",
        title: "Checked daily memory note",
        type: "item.started",
      },
      {
        conversationId: "conv_1",
        createdAt: "2026-04-13T10:00:03.000Z",
        id: "evt_2",
        messageId: "msg_1",
        payload: {},
        sequence: 2,
        status: "running",
        summary: "Looking through assigned issues",
        title: "Assessing user issues",
        type: "item.updated",
      },
      {
        conversationId: "conv_1",
        createdAt: "2026-04-13T10:00:05.000Z",
        id: "evt_3",
        messageId: "msg_1",
        payload: {},
        sequence: 3,
        status: "running",
        title: "Assistant message",
        type: "assistant_message.started",
      },
    ])

    assert.equal(
      getActivityLeadTitle({
        activityModel,
        fallback: "Working",
      }),
      "Assessing user issues",
    )
    assert.equal(
      getActivityLeadLine({
        activityModel,
        fallback: "Working",
      }),
      "Looking through assigned issues",
    )
  })

  it("uses a grouped memory-files label when several memory reads are active", () => {
    const activityModel = buildWorkspaceChatActivityModel([
      {
        conversationId: "conv_1",
        createdAt: "2026-04-13T10:00:00.000Z",
        id: "evt_1",
        itemId: "tool:call_1",
        messageId: "msg_1",
        payload: {},
        sequence: 1,
        status: "running",
        title: "read from ~/.openclaw/workspace/memory/2026-04-13.md",
        type: "item.started",
      },
      {
        conversationId: "conv_1",
        createdAt: "2026-04-13T10:00:01.000Z",
        id: "evt_2",
        itemId: "tool:call_2",
        messageId: "msg_1",
        payload: {},
        sequence: 2,
        status: "running",
        title: "read from ~/.openclaw/workspace/MEMORY.md",
        type: "item.started",
      },
    ])

    assert.equal(
      getActivityLeadTitle({
        activityModel,
        fallback: "Working",
      }),
      "Checking memory files",
    )
    assert.equal(
      getActivityLeadLine({
        activityModel,
        fallback: "Working",
      }),
      "Checking memory files",
    )
  })
})
