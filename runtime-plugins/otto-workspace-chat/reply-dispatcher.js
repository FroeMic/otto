import {
  sendWorkspaceChatCompletion,
  sendWorkspaceChatDelta,
} from "./control-plane-client.js";
import { createWorkspaceChatStreamReporter } from "./stream-reporter.js";

export function createWorkspaceChatReplyDispatcher(input) {
  const deliveredPayloads = [];
  let latestPartialText = "";

  const reporter = createWorkspaceChatStreamReporter({
    sendDelta: async ({ sequence, text }) => {
      latestPartialText = text;
      await sendWorkspaceChatDelta({
        assistantDisplayName: input.assistantDisplayName,
        assistantMessageId: input.assistantMessageId,
        conversationId: input.conversationId,
        sequence,
        text,
      });

      console.info("[workspace-chat] plugin delta sent", {
        assistantMessageId: input.assistantMessageId ?? null,
        conversationId: input.conversationId,
        sequence,
        textLength: text.length,
      });
    },
    startingSequence: 1,
  });

  return {
    deliver: async (payload) => {
      deliveredPayloads.push(payload);
    },
    replyOptions: {
      onPartialReply: async (payload) => {
        if (typeof payload?.text !== "string") {
          return;
        }

        await reporter.push(payload.text);
      },
    },
    async sendCompletion() {
      await reporter.flush();

      const parts = resolveCompletionParts(deliveredPayloads, latestPartialText);

      await sendWorkspaceChatCompletion({
        assistantDisplayName: input.assistantDisplayName,
        assistantMessageId: input.assistantMessageId,
        conversationId: input.conversationId,
        parts,
        session: {
          sessionKey: input.sessionKey,
          status: "completed",
        },
      });
    },
  };
}

function resolveCompletionParts(deliveredPayloads, latestPartialText) {
  const parts = [];

  for (const payload of Array.isArray(deliveredPayloads) ? deliveredPayloads : []) {
    const text =
      typeof payload?.text === "string" ? payload.text.trim() : "";

    if (text) {
      parts.push({
        text,
        type: "text",
      });
    }

    const mediaUrls = resolveMediaUrls(payload);

    for (const mediaUrl of mediaUrls) {
      parts.push({
        text: `[Media] ${mediaUrl}`,
        type: "text",
      });
    }
  }

  if (parts.length > 0) {
    return parts;
  }

  const text =
    typeof latestPartialText === "string" ? latestPartialText.trim() : "";

  return text
    ? [
        {
          text,
          type: "text",
        },
      ]
    : [];
}

function resolveMediaUrls(payload) {
  if (Array.isArray(payload?.mediaUrls)) {
    return payload.mediaUrls
      .filter((entry) => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (typeof payload?.mediaUrl === "string" && payload.mediaUrl.trim().length > 0) {
    return [payload.mediaUrl.trim()];
  }

  return [];
}
