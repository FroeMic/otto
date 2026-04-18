import assert from "node:assert/strict";
import test from "node:test";

import { createWorkspaceChatReplyDispatcher } from "./reply-dispatcher.js";

test("workspace chat reply dispatcher filters non-final payloads and suppresses duplicate deliveries", async () => {
  const filteredPayloads = [];
  const completionCalls = [];
  const deltaCalls = [];

  const dispatcher = createWorkspaceChatReplyDispatcher(
    {
      assistantDisplayName: "Otto",
      assistantMessageId: "msg_1",
      conversationId: "conv_1",
      sessionKey: "agent:main:otto-workspace-chat:workspace:conv_1",
    },
    {
      recordFilteredReplyPayload: async (payload) => {
        filteredPayloads.push(payload);
      },
      sendCompletion: async (payload) => {
        completionCalls.push(payload);
      },
      sendDelta: async (payload) => {
        deltaCalls.push(payload);
      },
    },
  );

  await dispatcher.deliver({ text: "Working draft." }, { kind: "block" });
  await dispatcher.deliver({ text: "Working draft." }, { kind: "block" });
  await dispatcher.deliver({ text: "Tool detail." }, { kind: "tool" });
  await dispatcher.deliver({ text: "Final answer." }, { kind: "final" });
  await dispatcher.deliver({ text: "Final answer." }, { kind: "final" });
  await dispatcher.sendCompletion();

  assert.deepEqual(filteredPayloads, [
    {
      kind: "block",
      payload: {
        text: "Working draft.",
      },
      reason: "non_final_reply",
    },
    {
      kind: "tool",
      payload: {
        text: "Tool detail.",
      },
      reason: "non_final_reply",
    },
  ]);
  assert.deepEqual(completionCalls.map((call) => call.parts), [
    [
      {
        text: "Final answer.",
        type: "text",
      },
    ],
  ]);
  assert.deepEqual(deltaCalls, []);
});

test("workspace chat reply dispatcher keeps only the last meaningful final reply", async () => {
  const completionCalls = [];

  const dispatcher = createWorkspaceChatReplyDispatcher(
    {
      assistantDisplayName: "Otto",
      assistantMessageId: "msg_1",
      conversationId: "conv_1",
      sessionKey: "agent:main:otto-workspace-chat:workspace:conv_1",
    },
    {
      sendCompletion: async (payload) => {
        completionCalls.push(payload);
      },
      sendDelta: async () => {},
    },
  );

  await dispatcher.deliver(
    { text: "I’m going to set this up properly as a project." },
    { kind: "final" },
  );
  await dispatcher.deliver(
    { text: "I’m going to create the project context for this idea." },
    { kind: "final" },
  );
  await dispatcher.deliver({ text: "terminated" }, { kind: "final" });
  await dispatcher.sendCompletion();

  assert.deepEqual(completionCalls.map((call) => call.parts), [
    [
      {
        text: "I’m going to create the project context for this idea.",
        type: "text",
      },
    ],
  ]);
});

test("workspace chat reply dispatcher drops terminal control partials", async () => {
  const completionCalls = [];

  const dispatcher = createWorkspaceChatReplyDispatcher(
    {
      assistantDisplayName: "Otto",
      assistantMessageId: "msg_1",
      conversationId: "conv_1",
      sessionKey: "agent:main:otto-workspace-chat:workspace:conv_1",
    },
    {
      sendCompletion: async (payload) => {
        completionCalls.push(payload);
      },
      sendDelta: async () => {},
    },
  );

  await dispatcher.replyOptions.onPartialReply({ text: "terminated" });
  await dispatcher.sendCompletion();

  assert.deepEqual(completionCalls.map((call) => call.parts), [[]]);
});

test("workspace chat reply dispatcher falls back to the latest partial text without a final payload", async () => {
  const completionCalls = [];
  const deltaCalls = [];

  const dispatcher = createWorkspaceChatReplyDispatcher(
    {
      assistantDisplayName: "Otto",
      assistantMessageId: "msg_1",
      conversationId: "conv_1",
      sessionKey: "agent:main:otto-workspace-chat:workspace:conv_1",
    },
    {
      sendCompletion: async (payload) => {
        completionCalls.push(payload);
      },
      sendDelta: async (payload) => {
        deltaCalls.push(payload);
      },
    },
  );

  await dispatcher.replyOptions.onPartialReply({ text: "Draft" });
  await dispatcher.replyOptions.onPartialReply({ text: "Draft answer" });
  await dispatcher.sendCompletion();

  assert.deepEqual(
    deltaCalls.map((call) => ({ sequence: call.sequence, text: call.text })),
    [
      { sequence: 1, text: "Draft" },
      { sequence: 2, text: "Draft answer" },
    ],
  );
  assert.deepEqual(completionCalls.map((call) => call.parts), [
    [
      {
        text: "Draft answer",
        type: "text",
      },
    ],
  ]);
});

test("workspace chat reply dispatcher prefers final text over partial text", async () => {
  const completionCalls = [];

  const dispatcher = createWorkspaceChatReplyDispatcher(
    {
      assistantDisplayName: "Otto",
      assistantMessageId: "msg_1",
      conversationId: "conv_1",
      sessionKey: "agent:main:otto-workspace-chat:workspace:conv_1",
    },
    {
      sendCompletion: async (payload) => {
        completionCalls.push(payload);
      },
      sendDelta: async () => {},
    },
  );

  await dispatcher.replyOptions.onPartialReply({ text: "Draft answer" });
  await dispatcher.deliver({ text: "Final answer." }, { kind: "final" });
  await dispatcher.sendCompletion();

  assert.deepEqual(completionCalls.map((call) => call.parts), [
    [
      {
        text: "Final answer.",
        type: "text",
      },
    ],
  ]);
});
