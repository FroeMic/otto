import assert from "node:assert/strict";
import test from "node:test";

import {
  createWorkspaceChatActivityEventReporter,
  normalizeWorkspaceChatRuntimeActivityEvent,
} from "./activity-events.js";

test("normalizeWorkspaceChatRuntimeActivityEvent maps direct runtime callback payloads into workspace activity events", () => {
  assert.deepEqual(
    normalizeWorkspaceChatRuntimeActivityEvent({
      payload: {
        phase: "started",
      },
      runId: "run_1",
      sessionKey: "session_1",
      stream: "lifecycle",
    }),
    {
      payload: {
        phase: "started",
      },
      runId: "run_1",
      sessionKey: "session_1",
      status: "running",
      title: "Started",
      type: "lifecycle.started",
    },
  );

  assert.deepEqual(
    normalizeWorkspaceChatRuntimeActivityEvent({
      payload: {
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
    normalizeWorkspaceChatRuntimeActivityEvent({
      payload: {
        name: "read_file",
        phase: "start",
      },
      runId: "run_1",
      sessionKey: "session_1",
      stream: "tool",
    }),
    {
      payload: {
        name: "read_file",
        phase: "start",
      },
      runId: "run_1",
      sessionKey: "session_1",
      status: "running",
      title: "read_file",
      type: "tool.started",
    },
  );

  assert.deepEqual(
    normalizeWorkspaceChatRuntimeActivityEvent({
      payload: {
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

  assert.deepEqual(
    normalizeWorkspaceChatRuntimeActivityEvent({
      payload: {
        itemId: "command:exec-1",
        output: "README.md",
        phase: "delta",
        title: "command ls",
        toolCallId: "exec-1",
      },
      runId: "run_1",
      sessionKey: "session_1",
      stream: "command_output",
    }),
    {
      itemId: "command:exec-1",
      payload: {
        itemId: "command:exec-1",
        output: "README.md",
        phase: "delta",
        title: "command ls",
        toolCallId: "exec-1",
      },
      runId: "run_1",
      sessionKey: "session_1",
      summary: "README.md",
      title: "command ls",
      type: "command_output.delta",
    },
  );
});

test("createWorkspaceChatActivityEventReporter forwards direct runtime callback activity in sequence order", async () => {
  const sentEvents = [];

  const reporter = createWorkspaceChatActivityEventReporter(
    {
      assistantMessageId: "msg_1",
      conversationId: "conv_1",
      sessionKey: "session_1",
    },
    {
      sendActivityEvent: async (payload) => {
        sentEvents.push(payload);
      },
    },
  );

  reporter.recordLifecycleEvent({
    phase: "started",
    runId: "run_1",
  });
  reporter.recordToolEvent({
    name: "read_file",
    phase: "start",
    runId: "run_1",
  });
  reporter.recordItemEvent({
    itemId: "item_1",
    phase: "update",
    progressText: "Reviewing issues",
    runId: "run_1",
    status: "running",
    title: "Assessing user issues",
  });
  reporter.recordApprovalEvent({
    approvalId: "approval_1",
    phase: "requested",
    runId: "run_1",
    status: "pending",
    title: "Run command",
  });
  reporter.recordCommandOutputEvent({
    itemId: "command:exec-1",
    output: "README.md",
    phase: "delta",
    runId: "run_1",
    title: "command ls",
    toolCallId: "exec_1",
  });
  reporter.recordLifecycleEvent({
    message: "Completed successfully",
    phase: "completed",
    runId: "run_1",
  });

  await reporter.flush();

  assert.deepEqual(sentEvents, [
    {
      assistantMessageId: "msg_1",
      conversationId: "conv_1",
      event: {
        payload: {
          phase: "started",
        },
        runId: "run_1",
        sequence: 1,
        sessionKey: "session_1",
        status: "running",
        title: "Started",
        type: "lifecycle.started",
      },
    },
    {
      assistantMessageId: "msg_1",
      conversationId: "conv_1",
      event: {
        payload: {
          name: "read_file",
          phase: "start",
        },
        runId: "run_1",
        sequence: 2,
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
        sequence: 3,
        sessionKey: "session_1",
        status: "running",
        summary: "Reviewing issues",
        title: "Assessing user issues",
        type: "item.updated",
      },
    },
    {
      assistantMessageId: "msg_1",
      conversationId: "conv_1",
      event: {
        itemId: "approval_1",
        payload: {
          approvalId: "approval_1",
          phase: "requested",
          status: "pending",
          title: "Run command",
        },
        runId: "run_1",
        sequence: 4,
        sessionKey: "session_1",
        status: "pending",
        title: "Run command",
        type: "approval.requested",
      },
    },
    {
      assistantMessageId: "msg_1",
      conversationId: "conv_1",
      event: {
        itemId: "command:exec-1",
        payload: {
          itemId: "command:exec-1",
          output: "README.md",
          phase: "delta",
          title: "command ls",
          toolCallId: "exec_1",
        },
        runId: "run_1",
        sequence: 5,
        sessionKey: "session_1",
        summary: "README.md",
        title: "command ls",
        type: "command_output.delta",
      },
    },
    {
      assistantMessageId: "msg_1",
      conversationId: "conv_1",
      event: {
        payload: {
          message: "Completed successfully",
          phase: "completed",
        },
        runId: "run_1",
        sequence: 6,
        sessionKey: "session_1",
        status: "completed",
        summary: "Completed successfully",
        title: "Completed",
        type: "lifecycle.completed",
      },
    },
  ]);

  reporter.stop();
});
