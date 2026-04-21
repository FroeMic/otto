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
        arguments: JSON.stringify({ filePath: "IDENTITY.md" }),
        name: "read_managed_file",
        phase: "start",
      },
      runId: "run_1",
      sessionKey: "session_1",
      stream: "tool",
    }),
    {
      payload: {
        arguments: JSON.stringify({ filePath: "IDENTITY.md" }),
        name: "read_managed_file",
        phase: "start",
      },
      runId: "run_1",
      sessionKey: "session_1",
      status: "running",
      title: 'Read "IDENTITY.md"',
      type: "tool.started",
    },
  );

  assert.deepEqual(
    normalizeWorkspaceChatRuntimeActivityEvent({
      payload: {
        name: "patch_managed_file",
        params: { filePath: "SOUL.md" },
        phase: "start",
      },
      runId: "run_1",
      sessionKey: "session_1",
      stream: "tool",
    }),
    {
      payload: {
        name: "patch_managed_file",
        params: { filePath: "SOUL.md" },
        phase: "start",
      },
      runId: "run_1",
      sessionKey: "session_1",
      status: "running",
      title: 'Update "SOUL.md"',
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

  assert.deepEqual(
    normalizeWorkspaceChatRuntimeActivityEvent({
      payload: {
        mediaUrls: ["https://example.com/file.png"],
        text: "Tool produced a chart",
      },
      runId: "run_1",
      sessionKey: "session_1",
      stream: "tool_result",
    }),
    {
      payload: {
        mediaUrls: ["https://example.com/file.png"],
        text: "Tool produced a chart",
      },
      runId: "run_1",
      sessionKey: "session_1",
      status: "completed",
      summary: "Tool produced a chart",
      title: "Tool result",
      type: "tool.result",
    },
  );

  assert.deepEqual(
    normalizeWorkspaceChatRuntimeActivityEvent({
      payload: {
        text: "Inspecting the issue",
      },
      runId: "run_1",
      sessionKey: "session_1",
      stream: "thinking",
    }),
    {
      payload: {
        text: "Inspecting the issue",
      },
      runId: "run_1",
      sessionKey: "session_1",
      status: "running",
      summary: "Inspecting the issue",
      title: "Thinking",
      type: "thinking.delta",
    },
  );

  assert.deepEqual(
    normalizeWorkspaceChatRuntimeActivityEvent({
      payload: {
        phase: "start",
      },
      runId: "run_1",
      sessionKey: "session_1",
      stream: "assistant_message",
    }),
    {
      payload: {
        phase: "start",
      },
      runId: "run_1",
      sessionKey: "session_1",
      status: "running",
      title: "Assistant message",
      type: "assistant_message.started",
    },
  );

  assert.deepEqual(
    normalizeWorkspaceChatRuntimeActivityEvent({
      payload: {
        phase: "start",
      },
      runId: "run_1",
      sessionKey: "session_1",
      stream: "compaction",
    }),
    {
      payload: {
        phase: "start",
      },
      runId: "run_1",
      sessionKey: "session_1",
      status: "running",
      title: "Context compaction",
      type: "compaction.started",
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
  await reporter.replyOptions.onToolResult?.({
    mediaUrls: ["https://example.com/result.png"],
    text: "Rendered chart",
  });
  await reporter.replyOptions.onAssistantMessageStart?.();
  await reporter.replyOptions.onReasoningStream?.({
    text: "Inspecting the code",
  });
  await reporter.replyOptions.onReasoningEnd?.();
  await reporter.replyOptions.onCompactionStart?.();
  await reporter.replyOptions.onCompactionEnd?.();

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
    {
      assistantMessageId: "msg_1",
      conversationId: "conv_1",
      event: {
        payload: {
          mediaUrls: ["https://example.com/result.png"],
          text: "Rendered chart",
        },
        runId: "run_1",
        sequence: 7,
        sessionKey: "session_1",
        status: "completed",
        summary: "Rendered chart",
        title: "Tool result",
        type: "tool.result",
      },
    },
    {
      assistantMessageId: "msg_1",
      conversationId: "conv_1",
      event: {
        payload: {
          phase: "start",
        },
        runId: "run_1",
        sequence: 8,
        sessionKey: "session_1",
        status: "running",
        title: "Assistant message",
        type: "assistant_message.started",
      },
    },
    {
      assistantMessageId: "msg_1",
      conversationId: "conv_1",
      event: {
        payload: {
          phase: "start",
        },
        runId: "run_1",
        sequence: 9,
        sessionKey: "session_1",
        status: "running",
        title: "Thinking",
        type: "thinking.started",
      },
    },
    {
      assistantMessageId: "msg_1",
      conversationId: "conv_1",
      event: {
        payload: {
          text: "Inspecting the code",
        },
        runId: "run_1",
        sequence: 10,
        sessionKey: "session_1",
        status: "running",
        summary: "Inspecting the code",
        title: "Thinking",
        type: "thinking.delta",
      },
    },
    {
      assistantMessageId: "msg_1",
      conversationId: "conv_1",
      event: {
        payload: {
          phase: "completed",
        },
        runId: "run_1",
        sequence: 11,
        sessionKey: "session_1",
        status: "completed",
        title: "Thinking",
        type: "thinking.completed",
      },
    },
    {
      assistantMessageId: "msg_1",
      conversationId: "conv_1",
      event: {
        payload: {
          phase: "start",
        },
        runId: "run_1",
        sequence: 12,
        sessionKey: "session_1",
        status: "running",
        title: "Context compaction",
        type: "compaction.started",
      },
    },
    {
      assistantMessageId: "msg_1",
      conversationId: "conv_1",
      event: {
        payload: {
          phase: "completed",
        },
        runId: "run_1",
        sequence: 13,
        sessionKey: "session_1",
        status: "completed",
        title: "Context compaction",
        type: "compaction.completed",
      },
    },
  ]);

  reporter.stop();
});

test("createWorkspaceChatActivityEventReporter records filtered assistant payloads as hidden assistant message events", async () => {
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

  reporter.recordFilteredReplyPayload({
    delivery: {
      kind: "block",
      reason: "non_final_reply",
      visibility: "filtered",
    },
    message: {
      text: "Working draft.",
    },
  });

  await reporter.flush();

  assert.deepEqual(sentEvents, [
    {
      assistantMessageId: "msg_1",
      conversationId: "conv_1",
      event: {
        payload: {
          delivery: {
            kind: "block",
            reason: "non_final_reply",
            visibility: "filtered",
          },
          message: {
            text: "Working draft.",
          },
        },
        sequence: 1,
        sessionKey: "session_1",
        status: "completed",
        summary: "Working draft.",
        title: "Filtered assistant output",
        type: "assistant_message.filtered",
      },
    },
  ]);

  reporter.stop();
});
