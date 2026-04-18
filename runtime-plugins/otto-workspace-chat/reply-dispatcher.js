import {
  sendWorkspaceChatCompletion,
  sendWorkspaceChatDelta,
} from "./control-plane-client.js";
import { createWorkspaceChatStreamReporter } from "./stream-reporter.js";

export function createWorkspaceChatReplyDispatcher(input, dependencies = {}) {
  const deliveredPayloads = [];
  const deliveredKeys = new Set();
  let latestPartialText = "";
  const sendDelta = dependencies.sendDelta ?? sendWorkspaceChatDelta;
  const sendCompletion =
    dependencies.sendCompletion ?? sendWorkspaceChatCompletion;
  const recordFilteredReplyPayload =
    dependencies.recordFilteredReplyPayload ?? (async () => {});

  const reporter = createWorkspaceChatStreamReporter({
    sendDelta: async ({ sequence, text }) => {
      latestPartialText = text;
      await sendDelta({
        assistantDisplayName: input.assistantDisplayName,
        assistantMessageId: input.assistantMessageId,
        conversationId: input.conversationId,
        sequence,
        text,
      });
    },
    startingSequence: 1,
  });

  return {
    deliver: async (payload, info = {}) => {
      const kind = resolveReplyKind(info);
      const deliveryKey = buildDeliveryKey({ kind, payload });

      if (!deliveryKey) {
        return;
      }

      if (deliveredKeys.has(deliveryKey)) {
        return;
      }

      deliveredKeys.add(deliveryKey);

      if (kind === "final") {
        deliveredPayloads.push(payload);
        return;
      }

      await recordFilteredReplyPayload({
        kind,
        payload,
        reason: "non_final_reply",
      });
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

      await sendCompletion({
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

function resolveReplyKind(info) {
  return info?.kind === "tool" || info?.kind === "block" || info?.kind === "final"
    ? info.kind
    : "final";
}

function buildDeliveryKey({ kind, payload }) {
  const text = typeof payload?.text === "string" ? payload.text.trim() : "";
  const mediaUrls = resolveMediaUrls(payload);

  if (!text && mediaUrls.length === 0) {
    return null;
  }

  return JSON.stringify({
    kind,
    mediaUrls,
    text,
  });
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
