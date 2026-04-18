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
