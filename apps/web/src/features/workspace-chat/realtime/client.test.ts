import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { WorkspaceChatRealtimeClient } from "./client"

class FakeSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  readyState = FakeSocket.CONNECTING
  readonly sentMessages: string[] = []
  readonly listeners = new Map<string, Set<(event: Event) => void>>()
  closed = false

  addEventListener(type: string, listener: (event: Event) => void) {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: (event: Event) => void) {
    const listeners = this.listeners.get(type)
    listeners?.delete(listener)
  }

  send(message: string) {
    this.sentMessages.push(message)
  }

  close() {
    this.closed = true
    this.readyState = FakeSocket.CLOSED
  }

  emit(type: "open" | "close" | "message", data?: string) {
    if (type === "open") {
      this.readyState = FakeSocket.OPEN
    }

    const listeners = this.listeners.get(type)

    if (!listeners) {
      return
    }

    if (type === "message") {
      const event = new MessageEvent("message", {
        data: data ?? "",
      })
      for (const listener of listeners) {
        listener(event)
      }
      return
    }

    const event = new Event(type)
    for (const listener of listeners) {
      listener(event)
    }
  }
}

describe("workspace chat realtime client", () => {
  it("reuses one websocket and sends subscribe and unsubscribe messages", () => {
    const sockets: FakeSocket[] = []
    const events: string[] = []
    const client = new WorkspaceChatRealtimeClient({
      createSocket() {
        const socket = new FakeSocket()
        sockets.push(socket)
        return socket
      },
      onEvent(event) {
        events.push(event.type)
      },
      orgSlug: "otto",
      url: "ws://test.local/api/workspace/otto/chat/realtime",
    })

    client.connect()
    client.subscribeConversation("conv_1")
    client.subscribeConversation("conv_2")

    assert.equal(sockets.length, 1)

    const [socket] = sockets
    assert.ok(socket)

    socket.emit("open")

    assert.deepEqual(
      socket.sentMessages.map((message) => JSON.parse(message)),
      [
        { conversationId: "conv_1", type: "subscribe" },
        { conversationId: "conv_2", type: "subscribe" },
      ],
    )

    client.unsubscribeConversation("conv_1")

    assert.deepEqual(JSON.parse(socket.sentMessages[2] ?? ""), {
      conversationId: "conv_1",
      type: "unsubscribe",
    })

    socket.emit(
      "message",
      JSON.stringify({
        conversationId: "conv_2",
        type: "subscribed",
      }),
    )

    assert.deepEqual(events, ["subscribed"])

    client.disconnect()
    assert.equal(socket.closed, true)
  })
})
