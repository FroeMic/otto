import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { createWorkspaceChatRealtimeHub } from "./chat-realtime-hub"

describe("workspace chat realtime hub", () => {
  it("publishes events only to subscribed websocket connections", async () => {
    const hub = createWorkspaceChatRealtimeHub()
    const received: string[] = []

    hub.registerConnection({
      connectionId: "conn_1",
      send(event) {
        received.push(event.type)
      },
    })
    hub.subscribeConnection("conn_1", "conv_1")

    await hub.publish({
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
    await hub.publish({
      conversation: {
        id: "conv_2",
        kind: "ad_hoc",
        lastActivityAt: "2026-04-11T18:00:01.000Z",
        latestMessagePreview: "ignore me",
        originKind: "manual",
        title: "Other conversation",
        visibility: "open",
      },
      type: "conversation.summary_updated",
    })

    hub.unregisterConnection("conn_1")

    assert.deepEqual(received, ["conversation.message_upserted"])
  })

  it("removes dead connections when sending a pushed event fails", async () => {
    const hub = createWorkspaceChatRealtimeHub()
    const received: string[] = []

    hub.registerConnection({
      connectionId: "dead_conn",
      send() {
        throw new Error("socket closed")
      },
    })
    hub.registerConnection({
      connectionId: "healthy_conn",
      send(event) {
        received.push(event.type)
      },
    })

    hub.subscribeConnection("dead_conn", "conv_1")
    hub.subscribeConnection("healthy_conn", "conv_1")

    await hub.publish({
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

    await hub.publish({
      conversationId: "conv_1",
      message: {
        author: {
          kind: "assistant",
          name: "Otto",
        },
        createdAt: "2026-04-11T18:00:01.000Z",
        id: "msg_2",
        parts: [],
        status: "streaming",
      },
      type: "conversation.message_upserted",
    })

    assert.deepEqual(received, [
      "conversation.message_upserted",
      "conversation.message_upserted",
    ])
  })
})
