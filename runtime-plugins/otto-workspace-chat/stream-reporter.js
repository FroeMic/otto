export function createWorkspaceChatStreamReporter(params) {
  const flushDelayMs = resolveFlushDelayMs(params.flushDelayMs);
  let drainingPromise = null;
  let lastSentText = "";
  let nextSequence = resolveStartingSequence(params.startingSequence);
  let pendingText = null;

  const drain = async () => {
    if (drainingPromise) {
      return await drainingPromise;
    }

    drainingPromise = (async () => {
      while (pendingText != null && pendingText !== lastSentText) {
        const text = pendingText;

        if (flushDelayMs > 0) {
          await sleep(flushDelayMs);

          if (pendingText !== text) {
            continue;
          }
        }

        pendingText = null;

        try {
          await params.sendDelta({
            sequence: nextSequence,
            text,
          });
          lastSentText = text;
          nextSequence += 1;
        } catch {
          pendingText = text;
          break;
        }
      }
    })();

    try {
      await drainingPromise;
    } finally {
      drainingPromise = null;

      if (pendingText != null && pendingText !== lastSentText) {
        await drain();
      }
    }
  };

  return {
    async flush() {
      await drain();
    },
    async push(text) {
      if (typeof text !== "string") {
        return;
      }

      pendingText = text;
      await drain();
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
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function resolveStartingSequence(value) {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
