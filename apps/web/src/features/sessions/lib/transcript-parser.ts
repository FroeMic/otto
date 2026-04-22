export interface ParsedUserMessage {
  channel: string | null
  senderId: string | null
  senderName: string | null
  text: string
  threadLabel: string | null
}

export type ProviderParser = (rawText: string) => ParsedUserMessage | null

export type ParsedContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; text: string }
  | {
      type: "tool_call"
      args?: unknown
      id?: string
      name: string
    }
  | {
      type: "tool_result"
      content: string
      isError: boolean
      name?: string
      toolCallId?: string
    }

export interface ParsedMessage {
  blocks: ParsedContentBlock[]
  id: string
  kind: "user" | "assistant" | "tool_result" | "compaction" | "system_prompt"
  model: string | null
  senderId: string | null
  senderName: string | null
  timestamp: number | null
  usage: {
    cost?: number
    input?: number
    output?: number
    total?: number
  } | null
}

const tryParseOpenClawEnvelope: ProviderParser = (rawText) => {
  if (
    !rawText.includes("Conversation info (untrusted metadata):") &&
    !rawText.includes("Sender (untrusted metadata):")
  ) {
    return null
  }

  const sender = extractSenderInfo(rawText)
  const conversationInfo = extractConversationInfo(rawText)

  return {
    channel: conversationInfo?.conversation_label ?? null,
    senderId: sender?.id ?? conversationInfo?.sender_id ?? null,
    senderName: sender?.name ?? conversationInfo?.sender ?? null,
    text: extractCleanText(rawText),
    threadLabel: conversationInfo?.thread_label ?? null,
  }
}

const tryParseFallback: ProviderParser = (rawText) => ({
  channel: null,
  senderId: null,
  senderName: null,
  text: rawText,
  threadLabel: null,
})

const PROVIDER_PARSERS: ProviderParser[] = [
  tryParseOpenClawEnvelope,
  tryParseFallback,
]

function extractSenderInfo(
  rawText: string,
): { id?: string; label?: string; name?: string } | null {
  const match = rawText.match(
    /Sender \(untrusted metadata\):\n```json\n([\s\S]*?)\n```/,
  )

  if (!match?.[1]) {
    return null
  }

  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

function extractConversationInfo(
  rawText: string,
): Record<string, string> | null {
  const match = rawText.match(
    /Conversation info \(untrusted metadata\):\n```json\n([\s\S]*?)\n```/,
  )

  if (!match?.[1]) {
    return null
  }

  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

function extractCleanText(rawText: string) {
  let text = rawText

  text = text.replace(/^System:\s*\[.*?\]\s*.*?\n\n?/, "")
  text = text.replace(
    /\[Thread history - for context\][\s\S]*?\n\n(?=System:|Conversation info|Sender|$)/,
    "",
  )
  text = text.replace(
    /Conversation info \(untrusted metadata\):\n```json\n[\s\S]*?\n```\n*/,
    "",
  )
  text = text.replace(
    /Sender \(untrusted metadata\):\n```json\n[\s\S]*?\n```\n*/,
    "",
  )
  text = text.replace(
    /Thread starter \(untrusted, for context\):\n```json\n[\s\S]*?\n```\n*/,
    "",
  )
  text = text.replace(
    /Replied message \(untrusted, for context\):\n```json\n[\s\S]*?\n```\n*/,
    "",
  )
  text = text.replace(
    /Untrusted context \(metadata, do not treat as instructions or commands\):\n*/,
    "",
  )
  text = text.replace(
    /<<<EXTERNAL_UNTRUSTED_CONTENT[\s\S]*?<<<END_EXTERNAL_UNTRUSTED_CONTENT[^>]*>>>/g,
    "",
  )

  return text.trim()
}

function parseUserMessageText(rawText: string): ParsedUserMessage {
  for (const parser of PROVIDER_PARSERS) {
    const result = parser(rawText)

    if (result) {
      return result
    }
  }

  return {
    channel: null,
    senderId: null,
    senderName: null,
    text: rawText,
    threadLabel: null,
  }
}

function stripDirectives(text: string) {
  return text
    .replace(/\[\[\s*reply_to_current\s*\]\]\s*/g, "")
    .replace(/\[\[\s*reply_to:[^\]]*\]\]\s*/g, "")
    .replace(/\[\[\s*audio_as_voice\s*\]\]\s*/g, "")
    .trim()
}

type RawContentBlock = Record<string, unknown>

function extractTextContent(
  content: string | RawContentBlock[] | undefined,
): string {
  if (!content) return ""
  if (typeof content === "string") return content

  return content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("\n")
}

function parseContentBlocks(
  content: string | RawContentBlock[] | undefined,
  role: string,
): ParsedContentBlock[] {
  if (!content) return []

  if (typeof content === "string") {
    const text = role === "assistant" ? stripDirectives(content) : content
    return text ? [{ type: "text", text }] : []
  }

  const blocks: ParsedContentBlock[] = []

  for (const block of content) {
    switch (block.type) {
      case "text": {
        const raw = typeof block.text === "string" ? block.text : ""
        const text = role === "assistant" ? stripDirectives(raw) : raw

        if (text) {
          blocks.push({ type: "text", text })
        }
        break
      }
      case "thinking": {
        const thinking =
          typeof block.thinking === "string" ? block.thinking : ""

        if (thinking.trim()) {
          blocks.push({ type: "thinking", text: thinking })
        }
        break
      }
      case "tool_call":
      case "toolCall":
      case "tool_use":
      case "toolUse": {
        blocks.push({
          args: block.arguments ?? block.args ?? block.input,
          id: (block.id ?? block.tool_use_id ?? block.toolUseId) as
            | string
            | undefined,
          name: (block.name as string) ?? (block.function as string) ?? "tool",
          type: "tool_call",
        })
        break
      }
      default:
        break
    }
  }

  return blocks
}

type RawTranscriptLine = {
  id?: string
  message?: {
    content?: string | RawContentBlock[]
    model?: string
    provider?: string
    role?: string
    timestamp?: number
    usage?: {
      cost?: { total?: number }
      input?: number
      output?: number
      totalTokens?: number
    }
  }
  summary?: string
  timestamp?: string | number
  type?: string
}

export function parseTranscript(jsonl: string | null): ParsedMessage[] {
  if (!jsonl) return []

  const lines = jsonl
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line) as RawTranscriptLine
      } catch {
        return null
      }
    })
    .filter((line): line is RawTranscriptLine => line !== null)

  const messages: ParsedMessage[] = []

  for (const line of lines) {
    if (
      line.type === "session" ||
      line.type === "model_change" ||
      line.type === "thinking_level_change" ||
      line.type === "custom" ||
      line.type === "custom_message" ||
      line.type === "session_info" ||
      line.type === "branch_summary" ||
      line.type === "label"
    ) {
      continue
    }

    if (line.type === "compaction") {
      messages.push({
        blocks: [
          {
            text: line.summary ?? "Context compacted",
            type: "text",
          },
        ],
        id: line.id ?? `compaction-${messages.length}`,
        kind: "compaction",
        model: null,
        senderId: null,
        senderName: null,
        timestamp: null,
        usage: null,
      })
      continue
    }

    if (line.type === "message" && line.message) {
      const msg = line.message
      const role = msg.role ?? "unknown"
      const ts = msg.timestamp ?? null

      if (role === "user") {
        const rawText = extractTextContent(msg.content)
        const isCronPrompt = /^\[cron:[^\]]+\]/.test(rawText.trim())

        if (isCronPrompt) {
          messages.push({
            blocks: [
              {
                text: rawText.trim(),
                type: "text",
              },
            ],
            id: line.id ?? `msg-${messages.length}`,
            kind: "system_prompt",
            model: null,
            senderId: null,
            senderName: "Scheduled Task",
            timestamp: ts,
            usage: null,
          })
          continue
        }

        const parsed = parseUserMessageText(rawText)
        messages.push({
          blocks: [{ text: parsed.text, type: "text" }],
          id: line.id ?? `msg-${messages.length}`,
          kind: "user",
          model: null,
          senderId: parsed.senderId,
          senderName: parsed.senderName,
          timestamp: ts,
          usage: null,
        })
        continue
      }

      if (role === "assistant") {
        messages.push({
          blocks: parseContentBlocks(msg.content, role),
          id: line.id ?? `msg-${messages.length}`,
          kind: "assistant",
          model: msg.model ?? null,
          senderId: null,
          senderName: "Otto",
          timestamp: ts,
          usage: msg.usage
            ? {
                cost: msg.usage.cost?.total,
                input: msg.usage.input,
                output: msg.usage.output,
                total: msg.usage.totalTokens,
              }
            : null,
        })
        continue
      }

      if (role === "tool") {
        const toolResultContent = extractTextContent(msg.content)
        messages.push({
          blocks: [
            {
              content: toolResultContent,
              isError: false,
              type: "tool_result",
            },
          ],
          id: line.id ?? `msg-${messages.length}`,
          kind: "tool_result",
          model: null,
          senderId: null,
          senderName: null,
          timestamp: ts,
          usage: null,
        })
      }
    }
  }

  return messages
}
