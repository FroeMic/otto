import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWorkspaceChatCompletionParts,
  createWorkspaceChatStreamReporter,
} from "./workspace-chat-stream-reporter.mjs";

test("workspace chat stream reporter coalesces partial text into monotonic delta callbacks", async () => {
  const sent = [];
  const reporter = createWorkspaceChatStreamReporter({
    flushDelayMs: 5,
    sendDelta: async (payload) => {
      sent.push(payload);
    },
  });

  reporter.push("Hel");
  reporter.push("Hello");
  reporter.push("Hello there");

  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.deepEqual(sent, [
    {
      sequence: 1,
      text: "Hello there",
    },
  ]);
});

test("workspace chat stream reporter flushes the latest unsent text immediately", async () => {
  const sent = [];
  const reporter = createWorkspaceChatStreamReporter({
    flushDelayMs: 100,
    sendDelta: async (payload) => {
      sent.push(payload);
    },
  });

  reporter.push("Hello");
  reporter.push("Hello there");
  await reporter.flush();

  assert.deepEqual(sent, [
    {
      sequence: 1,
      text: "Hello there",
    },
  ]);
});

test("workspace chat stream reporter retries the latest snapshot when an earlier send fails", async () => {
  const sent = [];
  let attempts = 0;
  const reporter = createWorkspaceChatStreamReporter({
    flushDelayMs: 5,
    sendDelta: async (payload) => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("transient");
      }
      sent.push(payload);
    },
  });

  reporter.push("Hello");
  await new Promise((resolve) => setTimeout(resolve, 20));
  reporter.push("Hello there");
  await reporter.flush();

  assert.deepEqual(sent, [
    {
      sequence: 1,
      text: "Hello there",
    },
  ]);
});

test("workspace chat completion parts combine visible text payloads into one message", () => {
  const parts = buildWorkspaceChatCompletionParts([
    {
      text: "Hello",
    },
    {
      text: "World",
    },
  ]);

  assert.deepEqual(parts, [
    {
      text: "Hello\n\nWorld",
      type: "text",
    },
  ]);
});
