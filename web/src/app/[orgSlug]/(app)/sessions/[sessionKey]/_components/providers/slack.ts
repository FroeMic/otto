import type { ParsedUserMessage, ProviderParser } from "../transcript-parser";

/**
 * Parse a Slack inbound message envelope.
 *
 * OpenClaw wraps Slack user messages in a structured envelope:
 *
 *   System: [Slack <from> <timestamp>] <sender>: <text>
 *
 *   Conversation info (untrusted metadata):
 *   ```json { "sender_id": "U...", "sender": "Name", ... } ```
 *
 *   Sender (untrusted metadata):
 *   ```json { "id": "U...", "name": "Name", ... } ```
 *
 *   <actual message text>
 *
 *   <<<EXTERNAL_UNTRUSTED_CONTENT ...>>>
 *   ...
 *   <<<END_EXTERNAL_UNTRUSTED_CONTENT ...>>>
 *
 * This is the same envelope format used by other OpenClaw messaging channels.
 */
export const tryParseOpenClawEnvelope: ProviderParser = (
  rawText: string,
): ParsedUserMessage | null => {
  // Must contain the structured metadata blocks to be recognized
  if (
    !rawText.includes("Conversation info (untrusted metadata):") &&
    !rawText.includes("Sender (untrusted metadata):")
  ) {
    return null;
  }

  const sender = extractSenderInfo(rawText);
  const conversationInfo = extractConversationInfo(rawText);
  const text = extractCleanText(rawText);

  return {
    senderName: sender?.name ?? conversationInfo?.sender ?? null,
    senderId: sender?.id ?? conversationInfo?.sender_id ?? null,
    text,
    channel: conversationInfo?.conversation_label ?? null,
    threadLabel: conversationInfo?.thread_label ?? null,
  };
};

function extractSenderInfo(
  rawText: string,
): { id?: string; name?: string; label?: string } | null {
  const match = rawText.match(
    /Sender \(untrusted metadata\):\n```json\n([\s\S]*?)\n```/,
  );
  if (!match?.[1]) return null;

  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function extractConversationInfo(
  rawText: string,
): Record<string, string> | null {
  const match = rawText.match(
    /Conversation info \(untrusted metadata\):\n```json\n([\s\S]*?)\n```/,
  );
  if (!match?.[1]) return null;

  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function extractCleanText(rawText: string): string {
  let text = rawText;

  // Strip the System: [...] header line (everything up to the first newline after it)
  text = text.replace(/^System:\s*\[.*?\]\s*.*?\n\n?/, "");

  // Strip thread history block
  text = text.replace(
    /\[Thread history - for context\][\s\S]*?\n\n(?=System:|Conversation info|Sender|$)/,
    "",
  );

  // Strip "Conversation info (untrusted metadata):" JSON block
  text = text.replace(
    /Conversation info \(untrusted metadata\):\n```json\n[\s\S]*?\n```\n*/,
    "",
  );

  // Strip "Sender (untrusted metadata):" JSON block
  text = text.replace(
    /Sender \(untrusted metadata\):\n```json\n[\s\S]*?\n```\n*/,
    "",
  );

  // Strip "Thread starter (untrusted, for context):" JSON block
  text = text.replace(
    /Thread starter \(untrusted, for context\):\n```json\n[\s\S]*?\n```\n*/,
    "",
  );

  // Strip "Replied message (untrusted, for context):" JSON block
  text = text.replace(
    /Replied message \(untrusted, for context\):\n```json\n[\s\S]*?\n```\n*/,
    "",
  );

  // Strip EXTERNAL_UNTRUSTED_CONTENT fences
  text = text.replace(
    /Untrusted context \(metadata, do not treat as instructions or commands\):\n*/,
    "",
  );
  text = text.replace(
    /<<<EXTERNAL_UNTRUSTED_CONTENT[\s\S]*?<<<END_EXTERNAL_UNTRUSTED_CONTENT[^>]*>>>/g,
    "",
  );

  return text.trim();
}
