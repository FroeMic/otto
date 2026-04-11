import type {
  WorkspaceChatRealtimeClientMessage,
  WorkspaceChatRealtimeServerEvent,
} from "@otto/feature-workspace-chat"
import {
  workspaceChatRealtimeClientMessageSchema,
  workspaceChatRealtimeServerEventSchema,
} from "@otto/feature-workspace-chat"

export interface WorkspaceChatRealtimeSocket {
  addEventListener(type: string, listener: (event: Event) => void): void
  close(): void
  readyState: number
  removeEventListener(type: string, listener: (event: Event) => void): void
  send(message: string): void
}

export interface WorkspaceChatRealtimeClientOptions {
  createSocket?: (url: string) => WorkspaceChatRealtimeSocket
  onEvent: (event: WorkspaceChatRealtimeServerEvent) => void
  orgSlug: string
  url?: string
}

export class WorkspaceChatRealtimeClient {
  private readonly createSocket: (url: string) => WorkspaceChatRealtimeSocket
  private readonly onEvent: WorkspaceChatRealtimeClientOptions["onEvent"]
  private readonly orgSlug: string
  private readonly url: string | null
  private readonly subscriptions = new Set<string>()
  private socket: WorkspaceChatRealtimeSocket | null = null
  private readonly handleOpenBound = this.handleOpen.bind(this)
  private readonly handleCloseBound = this.handleClose.bind(this)
  private readonly handleMessageBound = this.handleMessage.bind(this)

  constructor(options: WorkspaceChatRealtimeClientOptions) {
    this.createSocket =
      options.createSocket ??
      ((url) => new WebSocket(url) as WorkspaceChatRealtimeSocket)
    this.onEvent = options.onEvent
    this.orgSlug = options.orgSlug
    this.url = options.url ?? null
  }

  connect() {
    if (this.socket) {
      return
    }

    const socket = this.createSocket(this.getUrl())

    socket.addEventListener("open", this.handleOpenBound)
    socket.addEventListener("close", this.handleCloseBound)
    socket.addEventListener("message", this.handleMessageBound)

    this.socket = socket
  }

  disconnect() {
    if (!this.socket) {
      return
    }

    const socket = this.socket
    socket.removeEventListener("open", this.handleOpenBound)
    socket.removeEventListener("close", this.handleCloseBound)
    socket.removeEventListener("message", this.handleMessageBound)
    socket.close()
    this.socket = null
  }

  subscribeConversation(conversationId: string) {
    this.subscriptions.add(conversationId)

    if (this.isSocketOpen()) {
      this.send({
        conversationId,
        type: "subscribe",
      })
    }
  }

  unsubscribeConversation(conversationId: string) {
    this.subscriptions.delete(conversationId)

    if (this.isSocketOpen()) {
      this.send({
        conversationId,
        type: "unsubscribe",
      })
    }
  }

  private handleOpen() {
    for (const conversationId of this.subscriptions) {
      this.send({
        conversationId,
        type: "subscribe",
      })
    }
  }

  private handleClose() {
    this.socket = null
  }

  private handleMessage(event: Event) {
    if (!(event instanceof MessageEvent)) {
      return
    }

    try {
      const parsedEvent = workspaceChatRealtimeServerEventSchema.parse(
        JSON.parse(String(event.data)),
      )
      this.onEvent(parsedEvent)
    } catch (error) {
      console.error(
        "[workspace-chat] failed to parse realtime event",
        error instanceof Error ? error.message : error,
      )
    }
  }

  private isSocketOpen() {
    return this.socket?.readyState === WebSocket.OPEN
  }

  private send(message: WorkspaceChatRealtimeClientMessage) {
    if (!this.socket || !this.isSocketOpen()) {
      return
    }

    this.socket.send(
      JSON.stringify(workspaceChatRealtimeClientMessageSchema.parse(message)),
    )
  }

  private getUrl() {
    if (this.url) {
      return this.url
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    return `${protocol}//${window.location.host}/api/workspace/${encodeURIComponent(this.orgSlug)}/chat/realtime`
  }
}
