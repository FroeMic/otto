import type { WorkspaceChatMessage } from "@otto/feature-workspace-chat"

import { useEffect, useState } from "react"

const STREAMING_TEXT_FRAME_DELAY_MS = 24
const STREAMING_TEXT_MAX_STEP = 12

export interface StreamingTextFrameInput {
  displayText: string
  status: WorkspaceChatMessage["status"]
  targetText: string
}

export function getStreamingTextStepSize(backlog: number) {
  if (backlog <= 0) {
    return 0
  }

  if (backlog <= 4) {
    return 1
  }

  if (backlog <= 12) {
    return 2
  }

  return Math.min(STREAMING_TEXT_MAX_STEP, Math.max(3, Math.ceil(backlog / 8)))
}

export function getNextStreamingTextFrame({
  displayText,
  status,
  targetText,
}: StreamingTextFrameInput) {
  if (status !== "streaming") {
    return targetText
  }

  if (
    targetText.length <= displayText.length ||
    !targetText.startsWith(displayText)
  ) {
    return targetText
  }

  const stepSize = getStreamingTextStepSize(targetText.length - displayText.length)

  return targetText.slice(0, displayText.length + stepSize)
}

export interface UseStreamingTextInput {
  isEnabled: boolean
  messageId: string
  status: WorkspaceChatMessage["status"]
  targetText: string
}

export function useStreamingText({
  isEnabled,
  messageId,
  status,
  targetText,
}: UseStreamingTextInput) {
  const [displayText, setDisplayText] = useState(targetText)

  useEffect(() => {
    setDisplayText((currentText) => {
      if (!isEnabled || status !== "streaming") {
        return targetText
      }

      if (
        currentText.length > targetText.length ||
        !targetText.startsWith(currentText)
      ) {
        return targetText
      }

      return currentText
    })
  }, [isEnabled, messageId, status, targetText])

  useEffect(() => {
    if (!isEnabled || status !== "streaming" || displayText === targetText) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setDisplayText((currentText) =>
        getNextStreamingTextFrame({
          displayText: currentText,
          status,
          targetText,
        }),
      )
    }, STREAMING_TEXT_FRAME_DELAY_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [displayText, isEnabled, status, targetText])

  return displayText
}
