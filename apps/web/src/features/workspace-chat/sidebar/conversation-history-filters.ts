import type { WorkspaceChatConversationSummary } from "@otto/feature-workspace-chat"

export type ConversationHistoryFilter =
  | "all"
  | "team"
  | "personal"
  | "triggers"
  | "scheduled"

export interface ConversationHistoryFilterOption {
  label: string
  value: ConversationHistoryFilter
}

export const conversationHistoryFilterOptions: ConversationHistoryFilterOption[] =
  [
    { label: "All", value: "all" },
    { label: "Team", value: "team" },
    { label: "Personal", value: "personal" },
    { label: "Triggers", value: "triggers" },
    { label: "Scheduled", value: "scheduled" },
  ]

export function filterConversationHistory(
  conversations: WorkspaceChatConversationSummary[],
  filter: ConversationHistoryFilter,
) {
  return conversations.filter((conversation) => {
    switch (filter) {
      case "team":
        return conversation.visibility === "open"
      case "personal":
        return conversation.visibility === "personal"
      case "triggers":
        return conversation.originKind === "trigger"
      case "scheduled":
        return conversation.originKind === "scheduled"
      case "all":
      default:
        return true
    }
  })
}

export function formatConversationHistoryTitle(title: string) {
  return title.trim() || "Untitled conversation"
}

