import type {
  WorkspaceChatConversationDetailResponse,
  WorkspaceChatConversationSummary,
  WorkspaceChatRealtimeEvent,
} from "@otto/feature-workspace-chat"

export function applyWorkspaceChatRealtimeEventToConversationDetail(
  detail: WorkspaceChatConversationDetailResponse,
  event: WorkspaceChatRealtimeEvent,
): WorkspaceChatConversationDetailResponse {
  if (event.type === "conversation.summary_updated") {
    if (event.conversation.id !== detail.conversation.id) {
      return detail
    }

    return {
      ...detail,
      conversation: event.conversation,
    }
  }

  if (
    event.type === "subscribed" ||
    event.type === "unsubscribed" ||
    event.type === "subscription_denied" ||
    event.type === "pong" ||
    event.conversationId !== detail.conversation.id
  ) {
    return detail
  }

  if (event.type === "conversation.message_event_upserted") {
    const existingIndex = detail.messageEvents.findIndex(
      (messageEvent) => messageEvent.id === event.event.id,
    )

    if (existingIndex === -1) {
      return {
        ...detail,
        messageEvents: [...detail.messageEvents, event.event].sort(
          (left, right) => left.sequence - right.sequence,
        ),
      }
    }

    const nextMessageEvents = [...detail.messageEvents]
    nextMessageEvents[existingIndex] = event.event

    return {
      ...detail,
      messageEvents: nextMessageEvents,
    }
  }

  const existingIndex = detail.messages.findIndex(
    (message) => message.id === event.message.id,
  )

  if (existingIndex === -1) {
    return {
      ...detail,
      messages: [...detail.messages, event.message].sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt),
      ),
    }
  }

  const nextMessages = [...detail.messages]
  nextMessages[existingIndex] = event.message

  return {
    ...detail,
    messages: nextMessages,
  }
}

export function applyWorkspaceChatRealtimeEventToConversationList(
  conversations: WorkspaceChatConversationSummary[],
  event: WorkspaceChatRealtimeEvent,
) {
  if (event.type !== "conversation.summary_updated") {
    return conversations
  }

  const existingIndex = conversations.findIndex(
    (conversation) => conversation.id === event.conversation.id,
  )

  if (existingIndex === -1) {
    return [event.conversation, ...conversations].sort((left, right) =>
      right.lastActivityAt.localeCompare(left.lastActivityAt),
    )
  }

  const nextConversations = [...conversations]
  nextConversations[existingIndex] = event.conversation

  return nextConversations.sort((left, right) =>
    right.lastActivityAt.localeCompare(left.lastActivityAt),
  )
}
