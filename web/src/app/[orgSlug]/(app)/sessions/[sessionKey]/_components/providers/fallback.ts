import type { ParsedUserMessage, ProviderParser } from "../transcript-parser";

/**
 * Fallback parser — returns the raw text as-is when no provider
 * recognizes the envelope format.
 */
export const tryParseFallback: ProviderParser = (
  rawText: string,
): ParsedUserMessage => {
  return {
    senderName: null,
    senderId: null,
    text: rawText,
    channel: null,
    threadLabel: null,
  };
};
