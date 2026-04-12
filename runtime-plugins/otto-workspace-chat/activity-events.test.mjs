import assert from "node:assert/strict";
import test from "node:test";

import {
  createWorkspaceChatActivityEventReporter,
  normalizeWorkspaceChatAgentEvent,
} from "./activity-events.js";

test("normalizeWorkspaceChatAgentEvent maps core runtime streams into workspace activity events", () => {
  assert.deepEqual(
    normalizeWorkspaceChatAgentEvent({
      data: {
        phase: "start",
      },
      runId: "run_1",
      sessionKey: "session_1",
      stream: "lifecycle",
    }),
    {
      payload: {
        phase: "start",
      },
      runId: "run_1",
      sessionKey: "session_1",
      status: "running",
      title: "Started",
      type: "lifecycle.started",
    },
  );

  assert.deepEqual(
    normalizeWorkspaceChatAgentEvent({
      data: {
        itemId: "item_1",
        phase: "update",
        progressText: "Reviewing issues",
        status: "running",
        title: "Assessing user issues",
      },
      runId: "run_1",
      sessionKey: "session_1",
      stream: "item",
    }),
    {
      itemId: "item_1",
      payload: {
        itemId: "item_1",
        phase: "update",
        progressText: "Reviewing issues",
        status: "running",
        title: "Assessing user issues",
      },
      runId: "run_1",
      sessionKey: "session_1",
      status: "running",
      summary: "Reviewing issues",
      title: "Assessing user issues",
      type: "item.updated",
    },
  );

  assert.deepEqual(
    normalizeWorkspaceChatAgentEvent({
      data: {
        name: "read_file",
        phase: "start",
        toolCallId: "tool_1",
      },
      runId: "run_1",
      sessionKey: "session_1",
      stream: "tool",
    }),
    {
      itemId: "tool_1",
      payload: {
        name: "read_file",
        phase: "start",
        toolCallId: "tool_1",
      },
      runId: "run_1",
      sessionKey: "session_1",
      status: "running",
      title: "read_file",
      type: "tool.started",
    },
  );

  assert.deepEqual(
    normalizeWorkspaceChatAgentEvent({
      data: {
        approvalId: "approval_1",
        message: "Waiting on approval",
        phase: "requested",
        status: "pending",
        title: "Run command",
      },
      runId: "run_1",
      sessionKey: "session_1",
      stream: "approval",
    }),
    {
      itemId: "approval_1",
      payload: {
        approvalId: "approval_1",
        message: "Waiting on approval",
        phase: "requested",
        status: "pending",
        title: "Run command",
      },
      runId: "run_1",
      sessionKey: "session_1",
      status: "pending",
      summary: "Waiting on approval",
      title: "Run command",
      type: "approval.requested",
    },
  );
});

test("createWorkspaceChatActivityEventReporter forwards matching runtime events in sequence order", async () => {
  const sentEvents = [];
  let listener = null;

  const reporter = createWorkspaceChatActivityEventReporter(
    {
      assistantMessageId: "msg_1",
      conversationId: "conv_1",
      runtime: {
        events: {
          onAgentEvent(callback) {
            listener = callback;
            return () => {
              listener = null;
            };
          },
        },
      },
      sessionKey: "session_1",
    },
    {
      sendActivityEvent: async (payload) => {
        sentEvents.push(payload);
      },
    },
  );

  listener?.({
    data: {
      phase: "start",
      toolCallId: "tool_1",
      name: "read_file",
    },
    runId: "run_1",
    seq: 1,
    sessionKey: "session_1",
    stream: "tool",
    ts: Date.now(),
  });
  listener?.({
    data: {
      phase: "requested",
      approvalId: "approval_1",
      status: "pending",
      title: "Run command",
    },
    runId: "run_1",
    seq: 2,
    sessionKey: "other_session",
    stream: "approval",
    ts: Date.now(),
  });
  listener?.({
    data: {
      itemId: "item_1",
      phase: "update",
      progressText: "Reviewing issues",
      status: "running",
      title: "Assessing user issues",
    },
    runId: "run_1",
    seq: 3,
    sessionKey: "session_1",
    stream: "item",
    ts: Date.now(),
  });

  await reporter.flush();
  reporter.stop();

  assert.deepEqual(sentEvents, [
    {
      assistantMessageId: "msg_1",
      conversationId: "conv_1",
      event: {
        itemId: "tool_1",
        payload: {
          name: "read_file",
          phase: "start",
          toolCallId: "tool_1",
        },
        runId: "run_1",
        sequence: 1,
        sessionKey: "session_1",
        status: "running",
        title: "read_file",
        type: "tool.started",
      },
    },
    {
      assistantMessageId: "msg_1",
      conversationId: "conv_1",
      event: {
        itemId: "item_1",
        payload: {
          itemId: "item_1",
          phase: "update",
          progressText: "Reviewing issues",
          status: "running",
          title: "Assessing user issues",
        },
        runId: "run_1",
        sequence: 2,
        sessionKey: "session_1",
        status: "running",
        summary: "Reviewing issues",
        title: "Assessing user issues",
        type: "item.updated",
      },
    },
  ]);
});
