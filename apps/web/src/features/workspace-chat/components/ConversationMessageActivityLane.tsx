import type { WorkspaceChatMessageEvent } from "@otto/feature-workspace-chat"

import { buildWorkspaceChatActivityModel } from "../activity-model"
import { ConversationAssistantTrace } from "./ConversationAssistantTrace"

export interface ConversationMessageActivityLaneProps {
  events: WorkspaceChatMessageEvent[]
}

export function ConversationMessageActivityLane({
  events,
}: ConversationMessageActivityLaneProps) {
  const activityModel = buildWorkspaceChatActivityModel(events)

  return (
    <ConversationAssistantTrace
      events={events}
      startedAt={events[0]?.createdAt ?? new Date().toISOString()}
      status={activityModel.status}
    />
  )
}
