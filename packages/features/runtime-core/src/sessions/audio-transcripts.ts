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
  return extractWorkspaceAudioTranscriptsFromText(rawText)[0] ?? null
}

export function extractWorkspaceAudioTranscriptsFromText(
  rawText: string,
): string[] {
  if (!rawText.includes("[Audio]")) {
    return []
  }

  const markerPattern = /(?:^|\n)Transcript:\s*/g
  const matches = [...rawText.matchAll(markerPattern)]
  if (matches.length === 0) {
    return []
  }

  return matches
    .map((match, index) => {
      const start = (match.index ?? 0) + match[0].length
      const nextMatch = matches[index + 1]
      const nextAudioSectionIndex = rawText.indexOf("\n[Audio]", start)
      const end = Math.min(
        nextMatch?.index ?? rawText.length,
        nextAudioSectionIndex >= 0 ? nextAudioSectionIndex : rawText.length,
      )
      return rawText.slice(start, end).trim()
    })
    .filter((transcript) => transcript.length > 0)
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
    const transcripts = extractWorkspaceAudioTranscriptsFromText(rawText)
    if (transcripts.length === 0) {
      continue
    }

    const conversationInfo = extractConversationInfo(rawText)
    const messageId = conversationInfo.message_id
    if (typeof messageId !== "string" || messageId.trim().length === 0) {
      continue
    }

    const normalizedMessageId = messageId.trim()
    let nextMessageTranscriptIndex =
      transcriptCountByMessageId.get(normalizedMessageId) ?? 0

    for (const transcript of transcripts) {
      observations.push({
        messageId: normalizedMessageId,
        messageTranscriptIndex: nextMessageTranscriptIndex,
        transcript,
      })
      nextMessageTranscriptIndex += 1
    }

    transcriptCountByMessageId.set(
      normalizedMessageId,
      nextMessageTranscriptIndex,
    )
  }

  return observations
}
