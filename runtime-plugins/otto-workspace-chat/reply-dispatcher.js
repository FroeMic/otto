import {
  sendWorkspaceChatCompletion,
  sendWorkspaceChatDelta,
} from "./control-plane-client.js";
import {
  buildWorkspaceChatCompletionParts,
  createWorkspaceChatStreamReporter,
} from "./stream-reporter.js";

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
  const parts = buildWorkspaceChatCompletionParts(deliveredPayloads);

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
