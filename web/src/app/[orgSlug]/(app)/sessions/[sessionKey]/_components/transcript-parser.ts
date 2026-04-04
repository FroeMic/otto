import { tryParseOpenClawEnvelope } from "./providers/slack";
import { tryParseFallback } from "./providers/fallback";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ParsedUserMessage = {
  senderName: string | null;
  senderId: string | null;
  text: string;
  channel: string | null;
  threadLabel: string | null;
};

export type ProviderParser = (rawText: string) => ParsedUserMessage | null;

export type ParsedContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; text: string }
  | {
      type: "tool_call";
      name: string;
      id?: string;
      args?: unknown;
    }
  | {
      type: "tool_result";
      name?: string;
      toolCallId?: string;
      content: string;
      isError: boolean;
    };

export type ParsedMessage = {
  id: string;
  kind: "user" | "assistant" | "tool_result" | "compaction" | "system_prompt";
  timestamp: number | null;
  // User message fields
  senderName: string | null;
  senderId: string | null;
  // Content
  blocks: ParsedContentBlock[];
  // Assistant metadata
  model: string | null;
  usage: {
    input?: number;
    output?: number;
    total?: number;
    cost?: number;
  } | null;
};

// ---------------------------------------------------------------------------
// Provider parser chain — add new providers here
// ---------------------------------------------------------------------------

const PROVIDER_PARSERS: ProviderParser[] = [
  tryParseOpenClawEnvelope,
  // Add future providers here:
  // tryParseTelegramEnvelope,
  // tryParseDiscordEnvelope,
  tryParseFallback,
];

function parseUserMessageText(rawText: string): ParsedUserMessage {
  for (const parser of PROVIDER_PARSERS) {
    const result = parser(rawText);
    if (result) return result;
  }
  // Should never reach here because fallback always returns
  return { senderName: null, senderId: null, text: rawText, channel: null, threadLabel: null };
}

// ---------------------------------------------------------------------------
// Directive stripping for assistant messages
// ---------------------------------------------------------------------------

function stripDirectives(text: string): string {
  return text
    .replace(/\[\[\s*reply_to_current\s*\]\]\s*/g, "")
    .replace(/\[\[\s*reply_to:[^\]]*\]\]\s*/g, "")
    .replace(/\[\[\s*audio_as_voice\s*\]\]\s*/g, "")
    .trim();
}

// ---------------------------------------------------------------------------
// Content block extraction
// ---------------------------------------------------------------------------

type RawContentBlock = Record<string, unknown>;

function extractTextContent(
  content: string | RawContentBlock[] | undefined,
): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  return content
    .filter(
      (block) => block.type === "text" && typeof block.text === "string",
    )
    .map((block) => block.text as string)
    .join("\n");
}

function parseContentBlocks(
  content: string | RawContentBlock[] | undefined,
  role: string,
): ParsedContentBlock[] {
  if (!content) return [];
  if (typeof content === "string") {
    const text = role === "assistant" ? stripDirectives(content) : content;
    return text ? [{ type: "text", text }] : [];
  }

  const blocks: ParsedContentBlock[] = [];

  for (const block of content) {
    switch (block.type) {
      case "text": {
        const raw = typeof block.text === "string" ? block.text : "";
        const text = role === "assistant" ? stripDirectives(raw) : raw;
        if (text) {
          blocks.push({ type: "text", text });
        }
        break;
      }
      case "thinking": {
        const thinking =
          typeof block.thinking === "string" ? block.thinking : "";
        if (thinking.trim()) {
          blocks.push({ type: "thinking", text: thinking });
        }
        break;
      }
      case "tool_call":
      case "toolCall":
      case "tool_use":
      case "toolUse": {
        blocks.push({
          type: "tool_call",
          name:
            (block.name as string) ??
            (block.function as string) ??
            "tool",
          id: (block.id ?? block.tool_use_id ?? block.toolUseId) as
            | string
            | undefined,
          args: block.arguments ?? block.args ?? block.input,
        });
        break;
      }
      default:
        // Skip unknown block types
        break;
    }
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// JSONL line types
// ---------------------------------------------------------------------------

type RawTranscriptLine = {
  type?: string;
  id?: string;
  parentId?: string;
  message?: {
    role?: string;
    content?: string | RawContentBlock[];
    timestamp?: number;
    model?: string;
    provider?: string;
    usage?: {
      input?: number;
      output?: number;
      totalTokens?: number;
      cost?: { total?: number };
    };
  };
  summary?: string;
  timestamp?: string | number;
};

// ---------------------------------------------------------------------------
// Main parse function
// ---------------------------------------------------------------------------

export function parseTranscript(jsonl: string | null): ParsedMessage[] {
  if (!jsonl) return [];

  const lines = jsonl
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line) as RawTranscriptLine;
      } catch {
        return null;
      }
    })
    .filter((line): line is RawTranscriptLine => line !== null);

  const messages: ParsedMessage[] = [];

  for (const line of lines) {
    // Skip non-message types
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
      continue;
    }

    // Compaction dividers
    if (line.type === "compaction") {
      messages.push({
        id: line.id ?? `compaction-${messages.length}`,
        kind: "compaction",
        timestamp: null,
        senderName: null,
        senderId: null,
        blocks: [
          {
            type: "text",
            text: line.summary ?? "Context compacted",
          },
        ],
        model: null,
        usage: null,
      });
      continue;
    }

    // Message entries
    if (line.type === "message" && line.message) {
      const msg = line.message;
      const role = msg.role ?? "unknown";
      const ts = msg.timestamp ?? null;

      if (role === "user") {
        const rawText = extractTextContent(msg.content);
        const isCronPrompt = /^\[cron:[^\]]+\]/.test(rawText.trim());

        if (isCronPrompt) {
          messages.push({
            id: line.id ?? `msg-${messages.length}`,
            kind: "system_prompt",
            timestamp: ts,
            senderName: "Scheduled Task",
            senderId: null,
            blocks: rawText
              ? [{ type: "text", text: rawText }]
              : [],
            model: null,
            usage: null,
          });
        } else {
          const parsed = parseUserMessageText(rawText);

          messages.push({
            id: line.id ?? `msg-${messages.length}`,
            kind: "user",
            timestamp: ts,
            senderName: parsed.senderName,
            senderId: parsed.senderId,
            blocks: parsed.text
              ? [{ type: "text", text: parsed.text }]
              : [],
            model: null,
            usage: null,
          });
        }
      } else if (role === "assistant") {
        const blocks = parseContentBlocks(msg.content, "assistant");
        const usage = msg.usage
          ? {
              input: msg.usage.input,
              output: msg.usage.output,
              total: msg.usage.totalTokens,
              cost: msg.usage.cost?.total,
            }
          : null;

        messages.push({
          id: line.id ?? `msg-${messages.length}`,
          kind: "assistant",
          timestamp: ts,
          senderName: null,
          senderId: null,
          blocks,
          model: msg.model ?? null,
          usage,
        });
      } else if (role === "toolResult" || role === "tool") {
        const content = extractTextContent(msg.content);
        messages.push({
          id: line.id ?? `msg-${messages.length}`,
          kind: "tool_result",
          timestamp: ts,
          senderName: null,
          senderId: null,
          blocks: content
            ? [
                {
                  type: "tool_result",
                  content,
                  isError: false,
                  name: undefined,
                  toolCallId: undefined,
                },
              ]
            : [],
          model: null,
          usage: null,
        });
      }
      // Skip unknown roles
    }
  }

  return messages;
}
