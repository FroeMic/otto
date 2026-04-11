export function createWorkspaceChatStreamReporter(params) {
  const flushDelayMs = resolveFlushDelayMs(params.flushDelayMs);
  let flushTimer = null;
  let lastSentText = "";
  let nextSequence = 1;
  let pendingText = null;

  const flushPending = async () => {
    if (pendingText == null || pendingText === lastSentText) {
      pendingText = null;
      return;
    }

    const text = pendingText;

    try {
      await params.sendDelta({
        sequence: nextSequence,
        text,
      });
      lastSentText = text;
      pendingText = null;
      nextSequence += 1;
    } catch {
      // Keep the latest pending snapshot so the next flush can retry it.
    }
  };

  const scheduleFlush = () => {
    if (flushTimer) {
      return;
    }

    flushTimer = setTimeout(async () => {
      flushTimer = null;
      await flushPending();
    }, flushDelayMs);
  };

  return {
    async flush() {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }

      await flushPending();
    },
    push(text) {
      if (typeof text !== "string") {
        return;
      }

      pendingText = text;
      scheduleFlush();
    },
  };
}

export function buildWorkspaceChatCompletionParts(payloads) {
  const text = (Array.isArray(payloads) ? payloads : [])
    .map((payload) => (typeof payload?.text === "string" ? payload.text.trim() : ""))
    .filter(Boolean)
    .join("\n\n");

  return text
    ? [
        {
          text,
          type: "text",
        },
      ]
    : [];
}

function resolveFlushDelayMs(value) {
  return Number.isFinite(value) && value >= 0 ? value : 120;
}
