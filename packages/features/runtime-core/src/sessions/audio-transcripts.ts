export type WorkspaceAudioTranscriptObservation = {
  messageId: string
  transcript: string
}

type RawTranscriptLine = {
  message?: {
    content?: string | Array<Record<string, unknown>>
    role?: string
  }
  type?: string
}

function extractTextContent(
  content: string | Array<Record<string, unknown>> | undefined,
): string {
  if (!content) return ""
  if (typeof content === "string") return content

  return content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("\n")
}

function extractConversationInfo(rawText: string): Record<string, unknown> {
  const match = rawText.match(
    /Conversation info \(untrusted metadata\):\n```json\n([\s\S]*?)\n```/,
  )

  if (!match?.[1]) {
    return {}
  }

  try {
    return JSON.parse(match[1]) as Record<string, unknown>
  } catch {
    return {}
  }
}

export function extractWorkspaceAudioTranscriptFromText(
  rawText: string,
): string | null {
  if (!rawText.includes("[Audio]")) {
    return null
  }

  const marker = "Transcript:"
  const markerIndex = rawText.indexOf(marker)
  if (markerIndex < 0) {
    return null
  }

  const transcript = rawText.slice(markerIndex + marker.length).trim()
  return transcript.length > 0 ? transcript : null
}

export function extractWorkspaceAudioTranscriptsFromSessionJsonl(
  transcriptJsonl: string | null | undefined,
): WorkspaceAudioTranscriptObservation[] {
  if (!transcriptJsonl?.trim()) {
    return []
  }

  const observations: WorkspaceAudioTranscriptObservation[] = []

  for (const line of transcriptJsonl.split("\n")) {
    if (!line.trim()) {
      continue
    }

    let parsed: RawTranscriptLine
    try {
      parsed = JSON.parse(line) as RawTranscriptLine
    } catch {
      continue
    }

    if (parsed.type !== "message" || parsed.message?.role !== "user") {
      continue
    }

    const rawText = extractTextContent(parsed.message.content)
    const transcript = extractWorkspaceAudioTranscriptFromText(rawText)
    if (!transcript) {
      continue
    }

    const conversationInfo = extractConversationInfo(rawText)
    const messageId = conversationInfo.message_id
    if (typeof messageId !== "string" || messageId.trim().length === 0) {
      continue
    }

    observations.push({
      messageId: messageId.trim(),
      transcript,
    })
  }

  return observations
}
