export type WorkspaceAudioTranscriptObservation = {
  messageId: string
  messageTranscriptIndex: number
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

export function extractWorkspaceAudioUserTextFromText(
  rawText: string,
): string | null {
  if (!rawText.includes("[Audio]")) {
    return null
  }

  const userTextMarker = "User text:"
  const transcriptMarker = "Transcript:"
  const userTextIndex = rawText.indexOf(userTextMarker)
  if (userTextIndex < 0) {
    return null
  }

  const transcriptIndex = rawText.indexOf(transcriptMarker, userTextIndex)
  const rawUserText = rawText
    .slice(
      userTextIndex + userTextMarker.length,
      transcriptIndex >= 0 ? transcriptIndex : undefined,
    )
    .trim()
  if (!rawUserText) {
    return null
  }

  const withoutWorkspacePrefix = rawUserText.replace(/^\[[^\]]+\]\s*/, "")
  return withoutWorkspacePrefix.trim() || rawUserText
}

export function extractWorkspaceAudioTranscriptsFromSessionJsonl(
  transcriptJsonl: string | null | undefined,
): WorkspaceAudioTranscriptObservation[] {
  if (!transcriptJsonl?.trim()) {
    return []
  }

  const observations: WorkspaceAudioTranscriptObservation[] = []
  const transcriptCountByMessageId = new Map<string, number>()

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

    const normalizedMessageId = messageId.trim()
    const messageTranscriptIndex =
      transcriptCountByMessageId.get(normalizedMessageId) ?? 0
    transcriptCountByMessageId.set(
      normalizedMessageId,
      messageTranscriptIndex + 1,
    )

    observations.push({
      messageId: normalizedMessageId,
      messageTranscriptIndex,
      transcript,
    })
  }

  return observations
}
