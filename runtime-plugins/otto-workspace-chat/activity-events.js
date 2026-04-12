import { sendWorkspaceChatActivityEvent } from "./control-plane-client.js";

const DEFAULT_LIFECYCLE_START_TITLE = "Started";
const DEFAULT_LIFECYCLE_COMPLETE_TITLE = "Completed";
const DEFAULT_LIFECYCLE_FAILED_TITLE = "Failed";
const DEFAULT_ITEM_TITLE = "Working";
const DEFAULT_TOOL_TITLE = "Tool call";
const DEFAULT_APPROVAL_TITLE = "Approval";

export function createWorkspaceChatActivityEventReporter(
  input,
  dependencies = {},
) {
  let nextSequence = 1;
  let pending = Promise.resolve();

  const sendActivityEvent =
    dependencies.sendActivityEvent ?? sendWorkspaceChatActivityEvent;
  const stopListening =
    typeof input.runtime?.events?.onAgentEvent === "function"
      ? input.runtime.events.onAgentEvent((agentEvent) => {
          if (agentEvent?.sessionKey !== input.sessionKey) {
            return;
          }

          const normalizedEvent = normalizeWorkspaceChatAgentEvent(agentEvent);

          if (!normalizedEvent) {
            return;
          }

          const sequence = nextSequence++;

          pending = pending
            .then(async () => {
              await sendActivityEvent({
                assistantMessageId: input.assistantMessageId,
                conversationId: input.conversationId,
                event: {
                  ...normalizedEvent,
                  sequence,
                },
              });

              console.info("[workspace-chat] plugin activity event sent", {
                assistantMessageId: input.assistantMessageId ?? null,
                conversationId: input.conversationId,
                sequence,
                type: normalizedEvent.type,
              });
            })
            .catch((error) => {
              console.error("[workspace-chat] plugin activity event failed", {
                assistantMessageId: input.assistantMessageId ?? null,
                conversationId: input.conversationId,
                error: getErrorMessage(error),
                sequence,
                type: normalizedEvent.type,
              });
            });
        })
      : () => undefined;

  return {
    async flush() {
      await pending;
    },
    stop() {
      stopListening?.();
    },
  };
}

export function normalizeWorkspaceChatAgentEvent(agentEvent) {
  if (!agentEvent || typeof agentEvent !== "object") {
    return null;
  }

  const payload = readRecord(agentEvent.data);

  if (!payload) {
    return null;
  }

  switch (agentEvent.stream) {
    case "lifecycle":
      return normalizeLifecycleEvent(agentEvent, payload);
    case "item":
      return normalizeItemEvent(agentEvent, payload);
    case "tool":
      return normalizeToolEvent(agentEvent, payload);
    case "approval":
      return normalizeApprovalEvent(agentEvent, payload);
    default:
      return null;
  }
}

function normalizeLifecycleEvent(agentEvent, payload) {
  const phase = readString(payload.phase);

  if (phase === "error" || phase === "failed") {
    return buildNormalizedEvent(agentEvent, payload, {
      status: "failed",
      summary: readString(payload.error) ?? readString(payload.message),
      title: DEFAULT_LIFECYCLE_FAILED_TITLE,
      type: "lifecycle.failed",
    });
  }

  if (phase === "end" || phase === "completed") {
    return buildNormalizedEvent(agentEvent, payload, {
      status: "completed",
      summary: readString(payload.message),
      title: DEFAULT_LIFECYCLE_COMPLETE_TITLE,
      type: "lifecycle.completed",
    });
  }

  if (phase === "start" || phase === "started") {
    return buildNormalizedEvent(agentEvent, payload, {
      status: "running",
      summary: readString(payload.message),
      title: DEFAULT_LIFECYCLE_START_TITLE,
      type: "lifecycle.started",
    });
  }

  return null;
}

function normalizeItemEvent(agentEvent, payload) {
  const phase = readString(payload.phase);
  const status = normalizeStatus(readString(payload.status));

  if (!phase) {
    return null;
  }

  return buildNormalizedEvent(agentEvent, payload, {
    itemId: readString(payload.itemId),
    status,
    summary:
      readString(payload.summary) ??
      readString(payload.progressText) ??
      readString(payload.meta) ??
      readString(payload.error),
    title: readString(payload.title) ?? readString(payload.name) ?? DEFAULT_ITEM_TITLE,
    type:
      phase === "start"
        ? "item.started"
        : phase === "end"
          ? status === "failed" || status === "blocked"
            ? "item.failed"
            : "item.completed"
          : "item.updated",
  });
}

function normalizeToolEvent(agentEvent, payload) {
  const phase = readString(payload.phase);
  const status = normalizeStatus(readString(payload.status));

  return buildNormalizedEvent(agentEvent, payload, {
    itemId: readString(payload.toolCallId) ?? readString(payload.itemId),
    status:
      status ??
      (phase === "start" ? "running" : phase === "error" ? "failed" : undefined),
    summary:
      readString(payload.summary) ??
      readString(payload.partialResult) ??
      readString(payload.resultText) ??
      readString(payload.error) ??
      readString(payload.message),
    title: readString(payload.name) ?? DEFAULT_TOOL_TITLE,
    type:
      phase === "start"
        ? "tool.started"
        : phase === "end" || phase === "completed"
          ? status === "failed"
            ? "tool.failed"
            : "tool.completed"
          : phase === "error"
            ? "tool.failed"
            : "tool.updated",
  });
}

function normalizeApprovalEvent(agentEvent, payload) {
  const phase = readString(payload.phase);

  if (phase !== "requested" && phase !== "resolved") {
    return null;
  }

  return buildNormalizedEvent(agentEvent, payload, {
    itemId:
      readString(payload.approvalId) ??
      readString(payload.itemId) ??
      readString(payload.toolCallId),
    status: normalizeStatus(readString(payload.status)),
    summary:
      readString(payload.message) ??
      readString(payload.reason) ??
      readString(payload.command),
    title: readString(payload.title) ?? DEFAULT_APPROVAL_TITLE,
    type: phase === "requested" ? "approval.requested" : "approval.resolved",
  });
}

function buildNormalizedEvent(agentEvent, payload, normalized) {
  return {
    ...(normalized.itemId ? { itemId: normalized.itemId } : {}),
    payload,
    ...(readString(agentEvent.runId) ? { runId: readString(agentEvent.runId) } : {}),
    ...(readString(agentEvent.sessionKey)
      ? { sessionKey: readString(agentEvent.sessionKey) }
      : {}),
    ...(normalized.status ? { status: normalized.status } : {}),
    ...(normalized.summary ? { summary: normalized.summary } : {}),
    title: normalized.title,
    type: normalized.type,
  };
}

function normalizeStatus(status) {
  if (
    status === "pending" ||
    status === "running" ||
    status === "completed" ||
    status === "failed" ||
    status === "blocked" ||
    status === "approved" ||
    status === "denied" ||
    status === "unavailable"
  ) {
    return status;
  }

  return undefined;
}

function readRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function readString(value) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function getErrorMessage(error) {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "Workspace chat activity event failed";
}
