import { sendWorkspaceChatActivityEvent } from "./control-plane-client.js";

const DEFAULT_COMMAND_OUTPUT_TITLE = "Command output";
const DEFAULT_LIFECYCLE_COMPLETE_TITLE = "Completed";
const DEFAULT_LIFECYCLE_FAILED_TITLE = "Failed";
const DEFAULT_LIFECYCLE_START_TITLE = "Started";
const DEFAULT_APPROVAL_TITLE = "Approval";
const DEFAULT_ITEM_TITLE = "Working";
const DEFAULT_PLAN_ITEM_ID = "plan";
const DEFAULT_PLAN_TITLE = "Plan update";
const DEFAULT_PATCH_TITLE = "Apply patch";
const DEFAULT_TOOL_TITLE = "Tool call";

export function createWorkspaceChatActivityEventReporter(
  input,
  dependencies = {},
) {
  let activeRunId;
  let nextSequence = 1;
  let pending = Promise.resolve();

  const sendActivityEvent =
    dependencies.sendActivityEvent ?? sendWorkspaceChatActivityEvent;

  const queueRuntimeActivity = (stream, payload, metadata = {}) => {
    const runtimeActivity = extractRuntimeActivity(stream, payload, {
      runId: metadata.runId ?? activeRunId,
      sessionKey: metadata.sessionKey ?? input.sessionKey,
    });

    if (!runtimeActivity) {
      return;
    }

    if (runtimeActivity.runId) {
      activeRunId = runtimeActivity.runId;
    }

    const normalizedEvent =
      normalizeWorkspaceChatRuntimeActivityEvent(runtimeActivity);

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
  };

  return {
    recordApprovalEvent(payload) {
      queueRuntimeActivity("approval", payload);
    },
    recordCommandOutputEvent(payload) {
      queueRuntimeActivity("command_output", payload);
    },
    recordLifecycleEvent(payload) {
      queueRuntimeActivity("lifecycle", payload, {
        runId: readString(payload?.runId) ?? activeRunId,
      });
    },
    recordItemEvent(payload) {
      queueRuntimeActivity("item", payload);
    },
    recordPatchSummaryEvent(payload) {
      queueRuntimeActivity("patch", payload);
    },
    recordPlanUpdateEvent(payload) {
      queueRuntimeActivity("plan", payload);
    },
    recordToolEvent(payload) {
      queueRuntimeActivity("tool", payload);
    },
    replyOptions: {
      onAgentRunStart: (runId) => {
        activeRunId = readString(runId) ?? activeRunId;
        queueRuntimeActivity(
          "lifecycle",
          {
            phase: "started",
          },
          {
            runId: activeRunId,
          },
        );
      },
      onApprovalEvent: async (payload) => {
        queueRuntimeActivity("approval", payload);
      },
      onCommandOutput: async (payload) => {
        queueRuntimeActivity("command_output", payload);
      },
      onItemEvent: async (payload) => {
        queueRuntimeActivity("item", payload);
      },
      onPatchSummary: async (payload) => {
        queueRuntimeActivity("patch", payload);
      },
      onPlanUpdate: async (payload) => {
        queueRuntimeActivity("plan", payload);
      },
      onToolStart: async (payload) => {
        queueRuntimeActivity("tool", payload);
      },
    },
    async flush() {
      await pending;
    },
    stop() {},
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

  return normalizeWorkspaceChatRuntimeActivityEvent({
    payload,
    runId: readString(agentEvent.runId),
    sessionKey: readString(agentEvent.sessionKey),
    stream: readString(agentEvent.stream),
  });
}

export function normalizeWorkspaceChatRuntimeActivityEvent(event) {
  if (!event || typeof event !== "object") {
    return null;
  }

  const payload = readRecord(event.payload);

  if (!payload) {
    return null;
  }

  switch (event.stream) {
    case "approval":
      return normalizeApprovalEvent(event, payload);
    case "command_output":
      return normalizeCommandOutputEvent(event, payload);
    case "item":
      return normalizeItemEvent(event, payload);
    case "lifecycle":
      return normalizeLifecycleEvent(event, payload);
    case "patch":
      return normalizePatchEvent(event, payload);
    case "plan":
      return normalizePlanEvent(event, payload);
    case "tool":
      return normalizeToolEvent(event, payload);
    default:
      return null;
  }
}

function normalizeApprovalEvent(event, payload) {
  const phase = readString(payload.phase);

  if (phase !== "requested" && phase !== "resolved") {
    return null;
  }

  return buildNormalizedEvent(event, payload, {
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

function normalizeCommandOutputEvent(event, payload) {
  const phase = readString(payload.phase);
  const status =
    normalizeStatus(readString(payload.status)) ??
    (phase === "end" || phase === "completed"
      ? "completed"
      : phase === "error" || phase === "failed"
        ? "failed"
        : undefined);

  return buildNormalizedEvent(event, payload, {
    itemId: readString(payload.itemId) ?? readString(payload.toolCallId),
    status,
    summary:
      readString(payload.output) ??
      readString(payload.summary) ??
      readString(payload.message),
    title:
      readString(payload.title) ??
      readString(payload.name) ??
      DEFAULT_COMMAND_OUTPUT_TITLE,
    type:
      phase === "end" ||
      phase === "completed" ||
      phase === "error" ||
      phase === "failed"
        ? "command_output.completed"
        : "command_output.delta",
  });
}

function normalizeItemEvent(event, payload) {
  const phase = readString(payload.phase);
  const status =
    normalizeStatus(readString(payload.status)) ??
    (phase === "start"
      ? "running"
      : phase === "end" || phase === "completed"
        ? "completed"
        : phase === "error" || phase === "failed"
          ? "failed"
          : undefined);

  if (!phase) {
    return null;
  }

  return buildNormalizedEvent(event, payload, {
    itemId: readString(payload.itemId),
    status,
    summary:
      readString(payload.summary) ??
      readString(payload.progressText) ??
      readString(payload.meta) ??
      readString(payload.error),
    title:
      readString(payload.title) ??
      readString(payload.name) ??
      DEFAULT_ITEM_TITLE,
    type:
      phase === "start"
        ? "item.started"
        : phase === "end" || phase === "completed"
          ? status === "failed" || status === "blocked"
            ? "item.failed"
            : "item.completed"
          : phase === "error" || phase === "failed"
            ? "item.failed"
            : "item.updated",
  });
}

function normalizeLifecycleEvent(event, payload) {
  const phase = readString(payload.phase);

  if (phase === "error" || phase === "failed") {
    return buildNormalizedEvent(event, payload, {
      status: "failed",
      summary: readString(payload.error) ?? readString(payload.message),
      title: DEFAULT_LIFECYCLE_FAILED_TITLE,
      type: "lifecycle.failed",
    });
  }

  if (phase === "end" || phase === "completed") {
    return buildNormalizedEvent(event, payload, {
      status: "completed",
      summary: readString(payload.message),
      title: DEFAULT_LIFECYCLE_COMPLETE_TITLE,
      type: "lifecycle.completed",
    });
  }

  if (phase === "start" || phase === "started") {
    return buildNormalizedEvent(event, payload, {
      status: "running",
      summary: readString(payload.message),
      title: DEFAULT_LIFECYCLE_START_TITLE,
      type: "lifecycle.started",
    });
  }

  return null;
}

function normalizePatchEvent(event, payload) {
  const phase = readString(payload.phase);
  const summary =
    readString(payload.summary) ??
    summarizePatchFiles(payload) ??
    readString(payload.title);

  return buildNormalizedEvent(event, payload, {
    itemId:
      readString(payload.itemId) ??
      readString(payload.toolCallId) ??
      "patch",
    status:
      phase === "end" || phase === "completed"
        ? "completed"
        : phase === "error" || phase === "failed"
          ? "failed"
          : "running",
    summary,
    title:
      readString(payload.title) ??
      readString(payload.name) ??
      DEFAULT_PATCH_TITLE,
    type:
      phase === "end" || phase === "completed"
        ? "item.completed"
        : phase === "error" || phase === "failed"
          ? "item.failed"
          : "item.updated",
  });
}

function normalizePlanEvent(event, payload) {
  const phase = readString(payload.phase);
  const summary =
    readString(payload.explanation) ??
    formatPlanSteps(payload.steps) ??
    readString(payload.title);

  return buildNormalizedEvent(event, payload, {
    itemId: readString(payload.itemId) ?? DEFAULT_PLAN_ITEM_ID,
    status:
      phase === "end" || phase === "completed"
        ? "completed"
        : phase === "error" || phase === "failed"
          ? "failed"
          : "running",
    summary,
    title: readString(payload.title) ?? DEFAULT_PLAN_TITLE,
    type:
      phase === "start"
        ? "item.started"
        : phase === "end" || phase === "completed"
          ? "item.completed"
          : phase === "error" || phase === "failed"
            ? "item.failed"
            : "item.updated",
  });
}

function normalizeToolEvent(event, payload) {
  const phase = readString(payload.phase);
  const status =
    normalizeStatus(readString(payload.status)) ??
    (phase === "start"
      ? "running"
      : phase === "end" || phase === "completed"
        ? "completed"
        : phase === "error" || phase === "failed"
          ? "failed"
          : undefined);

  return buildNormalizedEvent(event, payload, {
    itemId: readString(payload.toolCallId) ?? readString(payload.itemId),
    status,
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
          : phase === "error" || phase === "failed"
            ? "tool.failed"
            : "tool.updated",
  });
}

function buildNormalizedEvent(event, payload, normalized) {
  return {
    ...(normalized.itemId ? { itemId: normalized.itemId } : {}),
    payload,
    ...(readString(event.runId) ? { runId: readString(event.runId) } : {}),
    ...(readString(event.sessionKey)
      ? { sessionKey: readString(event.sessionKey) }
      : {}),
    ...(normalized.status ? { status: normalized.status } : {}),
    ...(normalized.summary ? { summary: normalized.summary } : {}),
    title: normalized.title,
    type: normalized.type,
  };
}

function extractRuntimeActivity(stream, payload, metadata) {
  const record = readRecord(payload);

  if (!record) {
    return null;
  }

  const runtimePayload = { ...record };
  delete runtimePayload.runId;
  delete runtimePayload.sessionKey;

  return {
    payload: runtimePayload,
    runId: readString(metadata.runId) ?? readString(record.runId),
    sessionKey: readString(metadata.sessionKey) ?? readString(record.sessionKey),
    stream,
  };
}

function formatPlanSteps(value) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const steps = value
    .filter((entry) => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return steps.length > 0 ? steps.join(" | ") : undefined;
}

function summarizePatchFiles(payload) {
  const parts = [];
  const counts = [
    ["added", payload.added],
    ["modified", payload.modified],
    ["deleted", payload.deleted],
  ];

  for (const [label, value] of counts) {
    if (!Array.isArray(value) || value.length === 0) {
      continue;
    }

    parts.push(`${value.length} ${label}`);
  }

  return parts.length > 0 ? parts.join(", ") : undefined;
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
