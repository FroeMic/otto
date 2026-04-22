import type { WorkspaceChatRealtimeServerEvent } from "@otto/feature-workspace-chat"

type WorkspaceChatRealtimeConnection = {
  send: (event: WorkspaceChatRealtimeServerEvent) => void
  subscriptions: Set<string>
}

export class WorkspaceChatRealtimeHub {
  private readonly connections = new Map<
    string,
    WorkspaceChatRealtimeConnection
  >()

  private readonly connectionIdsByConversationId = new Map<
    string,
    Set<string>
  >()

  registerConnection(input: {
    connectionId: string
    send: (event: WorkspaceChatRealtimeServerEvent) => void
  }) {
    this.connections.set(input.connectionId, {
      send: input.send,
      subscriptions: new Set(),
    })
  }

  unregisterConnection(connectionId: string) {
    const connection = this.connections.get(connectionId)

    if (!connection) {
      return
    }

    for (const conversationId of connection.subscriptions) {
      this.unsubscribeConnection(connectionId, conversationId)
    }

    this.connections.delete(connectionId)
  }

  subscribeConnection(connectionId: string, conversationId: string) {
    const connection = this.connections.get(connectionId)

    if (!connection) {
      return false
    }

    connection.subscriptions.add(conversationId)
    const connectionIds =
      this.connectionIdsByConversationId.get(conversationId) ?? new Set()
    connectionIds.add(connectionId)
    this.connectionIdsByConversationId.set(conversationId, connectionIds)

    return true
  }

  unsubscribeConnection(connectionId: string, conversationId: string) {
    const connection = this.connections.get(connectionId)

    if (!connection) {
      return false
    }

    connection.subscriptions.delete(conversationId)
    const connectionIds =
      this.connectionIdsByConversationId.get(conversationId) ?? null

    if (!connectionIds) {
      return true
    }

    connectionIds.delete(connectionId)

    if (connectionIds.size === 0) {
      this.connectionIdsByConversationId.delete(conversationId)
    }

    return true
  }

  async publish(event: WorkspaceChatRealtimeServerEvent) {
    if (
      event.type === "subscribed" ||
      event.type === "unsubscribed" ||
      event.type === "subscription_denied" ||
      event.type === "pong"
    ) {
      return
    }

    const conversationId =
      event.type === "conversation.summary_updated"
        ? event.conversation.id
        : event.conversationId
    const connectionIds =
      this.connectionIdsByConversationId.get(conversationId) ?? null

    if (!connectionIds || connectionIds.size === 0) {
      return
    }

    for (const connectionId of connectionIds) {
      const connection = this.connections.get(connectionId)

      if (!connection) {
        continue
      }

      try {
        connection.send(event)
      } catch {
        this.unregisterConnection(connectionId)
      }
    }
  }
}

let globalWorkspaceChatRealtimeHub: WorkspaceChatRealtimeHub | null = null

export function createWorkspaceChatRealtimeHub() {
  return new WorkspaceChatRealtimeHub()
}

export function getWorkspaceChatRealtimeHub() {
  globalWorkspaceChatRealtimeHub ??= createWorkspaceChatRealtimeHub()
  return globalWorkspaceChatRealtimeHub
}
