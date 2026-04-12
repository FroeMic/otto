import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWorkspaceTarget,
  inferWorkspaceTargetChatType,
  parseWorkspaceTarget,
} from "./target.js";

test("workspace targets preserve personal chat visibility", async () => {
  const target = buildWorkspaceTarget({
    assistantMessageId: "msg_1",
    conversationId: "conv_1",
    conversationVisibility: "personal",
  });

  assert.equal(
    target,
    "workspace:conv_1?assistantMessageId=msg_1&visibility=personal",
  );
  assert.deepEqual(parseWorkspaceTarget(target), {
    assistantMessageId: "msg_1",
    conversationId: "conv_1",
    conversationVisibility: "personal",
    target,
  });
  assert.equal(inferWorkspaceTargetChatType(target), "direct");
});

test("workspace targets default to open group conversations", async () => {
  const target = buildWorkspaceTarget({
    conversationId: "conv_1",
  });

  assert.equal(target, "workspace:conv_1");
  assert.deepEqual(parseWorkspaceTarget(target), {
    assistantMessageId: undefined,
    conversationId: "conv_1",
    conversationVisibility: "open",
    target,
  });
  assert.equal(inferWorkspaceTargetChatType(target), "group");
});
