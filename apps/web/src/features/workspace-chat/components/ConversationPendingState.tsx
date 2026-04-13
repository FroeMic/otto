import type { WorkspaceChatMessage } from "@otto/feature-workspace-chat"
import { useEffect, useState } from "react"

import { getWorkspaceChatPendingLabel } from "../trace-presentation"
import { ConversationLiveTraceLine } from "./ConversationLiveTraceLine"

export interface ConversationPendingStateProps {
  startedAt: string
  status: WorkspaceChatMessage["status"]
}

export function ConversationPendingState({
  startedAt,
  status,
}: ConversationPendingStateProps) {
  const isActive = status === "pending" || status === "streaming"
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!isActive) {
      return
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, 1200)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [isActive])

  const startedAtMs = Date.parse(startedAt)
  const elapsedMs =
    Number.isFinite(startedAtMs) && now >= startedAtMs ? now - startedAtMs : 0
  const label = getWorkspaceChatPendingLabel({
    elapsedMs,
    status,
  })

  if (!label) {
    return null
  }

  return <ConversationLiveTraceLine label={label} sequenceKey={label} />
}
