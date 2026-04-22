import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { filterConversationHistory } from "./conversation-history-filters"

describe("conversation history filters", () => {
  const conversations = [
    {
      id: "conv_manual_team",
      kind: "ad_hoc",
      lastActivityAt: "2026-04-13T10:00:00.000Z",
      latestMessagePreview: "hello",
      originKind: "manual",
      title: "Team chat",
      visibility: "open",
    },
    {
      id: "conv_manual_personal",
      kind: "ad_hoc",
      lastActivityAt: "2026-04-13T10:00:00.000Z",
      latestMessagePreview: "hello",
      originKind: "manual",
      title: "Personal chat",
      visibility: "personal",
    },
    {
      id: "conv_trigger",
      kind: "external_surface",
      lastActivityAt: "2026-04-13T10:00:00.000Z",
      latestMessagePreview: "hello",
      originKind: "trigger",
      title: "Slack thread",
      visibility: "open",
    },
    {
      id: "conv_scheduled",
      kind: "durable_named",
      lastActivityAt: "2026-04-13T10:00:00.000Z",
      latestMessagePreview: "hello",
      originKind: "scheduled",
      title: "Scheduled follow-up",
      visibility: "open",
    },
  ] as const

  it("filters team, personal, trigger, and scheduled history independently", () => {
    assert.deepEqual(
      filterConversationHistory([...conversations], "team").map(
        (conversation) => conversation.id,
      ),
      ["conv_manual_team", "conv_trigger", "conv_scheduled"],
    )
    assert.deepEqual(
      filterConversationHistory([...conversations], "personal").map(
        (conversation) => conversation.id,
      ),
      ["conv_manual_personal"],
    )
    assert.deepEqual(
      filterConversationHistory([...conversations], "triggers").map(
        (conversation) => conversation.id,
      ),
      ["conv_trigger"],
    )
    assert.deepEqual(
      filterConversationHistory([...conversations], "scheduled").map(
        (conversation) => conversation.id,
      ),
      ["conv_scheduled"],
    )
  })
})
