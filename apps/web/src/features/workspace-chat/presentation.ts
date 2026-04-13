import type { WorkspaceChatMessage } from "@otto/feature-workspace-chat"

export type WorkspaceConversationTurnKind =
  | "assistant"
  | "current_user"
  | "other_user"
  | "system"

export function getWorkspaceConversationTurnKind(input: {
  currentUserId?: string
  message: WorkspaceChatMessage
}): WorkspaceConversationTurnKind {
  const { currentUserId, message } = input

  if (message.author.kind === "assistant") {
    return "assistant"
  }

  if (
    message.author.kind === "user" &&
    currentUserId &&
    message.author.userId === currentUserId
  ) {
    return "current_user"
  }

  if (
    message.author.kind === "system" ||
    message.author.kind === "automation"
  ) {
    return "system"
  }

  return "other_user"
}

export function getWorkspaceConversationTurnName(input: {
  message: WorkspaceChatMessage
  turnKind: WorkspaceConversationTurnKind
}) {
  const { message, turnKind } = input

  if (message.author.name?.trim()) {
    return message.author.name.trim()
  }

  if (turnKind === "assistant") {
    return "Otto"
  }

  if (turnKind === "current_user") {
    return "You"
  }

  if (turnKind === "system") {
    return "System"
  }

  return "Workspace member"
}
