import type { WorkspaceChatMessageEvent } from "@otto/feature-workspace-chat"

import { ConversationAssistantTrace } from "./ConversationAssistantTrace"

export interface ConversationMessageActivityLaneProps {
  events: WorkspaceChatMessageEvent[]
}

export function ConversationMessageActivityLane({
  events,
}: ConversationMessageActivityLaneProps) {
  return (
    <ConversationAssistantTrace
      events={events}
      startedAt={events[0]?.createdAt ?? new Date().toISOString()}
    />
  )
}
