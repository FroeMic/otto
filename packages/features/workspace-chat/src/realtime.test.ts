import assert from "node:assert/strict"

import { describe, it } from "vitest"

import {
  workspaceChatRealtimeClientMessageSchema,
  workspaceChatRealtimeServerEventSchema,
} from "./realtime"

describe("workspace chat realtime client message schema", () => {
  it("parses subscribe messages", () => {
    const message = workspaceChatRealtimeClientMessageSchema.parse({
      conversationId: "conv_1",
      type: "subscribe",
    })

    assert.equal(message.type, "subscribe")
    assert.equal(message.conversationId, "conv_1")
  })
})

describe("workspace chat realtime server event schema", () => {
  it("parses message upserted events", () => {
    const event = workspaceChatRealtimeServerEventSchema.parse({
      conversationId: "conv_1",
      message: {
        author: {
          kind: "assistant",
          name: "Otto",
        },
        createdAt: "2026-04-11T18:00:00.000Z",
        id: "msg_1",
        parts: [],
        status: "pending",
      },
      type: "conversation.message_upserted",
    })

    assert.equal(event.type, "conversation.message_upserted")
    assert.equal(event.message.status, "pending")
  })

  it("parses subscribed events", () => {
    const event = workspaceChatRealtimeServerEventSchema.parse({
      conversationId: "conv_1",
      type: "subscribed",
    })

    assert.equal(event.type, "subscribed")
    assert.equal(event.conversationId, "conv_1")
  })

  it("parses subscription denied events", () => {
    const event = workspaceChatRealtimeServerEventSchema.parse({
      conversationId: "conv_1",
      type: "subscription_denied",
    })

    assert.equal(event.type, "subscription_denied")
    assert.equal(event.conversationId, "conv_1")
  })

  it("parses summary updated events", () => {
    const event = workspaceChatRealtimeServerEventSchema.parse({
      conversation: {
        id: "conv_1",
        kind: "ad_hoc",
        lastActivityAt: "2026-04-11T18:00:00.000Z",
        latestMessagePreview: "hello",
        title: "New conversation",
        visibility: "open",
      },
      type: "conversation.summary_updated",
    })

    assert.equal(event.type, "conversation.summary_updated")
    assert.equal(event.conversation.id, "conv_1")
  })
})
