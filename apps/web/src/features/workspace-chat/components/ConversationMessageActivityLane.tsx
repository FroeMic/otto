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
      status={getActivityLaneStatus(events)}
    />
  )
}

function getActivityLaneStatus(
  events: WorkspaceChatMessageEvent[],
): "completed" | "failed" | "pending" | "streaming" {
  const latestStatus = events.at(-1)?.status

  if (latestStatus === "pending") {
    return "pending"
  }

  if (latestStatus === "failed") {
    return "failed"
  }

  if (latestStatus === "running") {
    return "streaming"
  }

  return "completed"
}
