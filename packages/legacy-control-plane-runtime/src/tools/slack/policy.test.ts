import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applySlackPolicyAction,
  deriveSlackPolicyEffects,
  isSlackPolicyDestructive,
} from "../../integrations/library/slack/policy";

describe("slack policy actions", () => {
  it("adds and removes allowed users without overwriting unrelated config", () => {
    const currentConfig = {
      ackReactionEnabled: false,
      allowedChannelIds: ["C1"],
      allowedUserIds: ["U1"],
      answerInThreads: true,
      channelAccessMode: "manual_allowlist" as const,
      requireMentionInChannels: true,
    };

    const addedUserConfig = applySlackPolicyAction(currentConfig, {
      type: "add_allowed_users",
      userIds: ["U2"],
    });
    const removedUserConfig = applySlackPolicyAction(addedUserConfig, {
      type: "remove_allowed_users",
      userIds: ["U1"],
    });

    assert.deepEqual(addedUserConfig.allowedUserIds, ["U1", "U2"]);
    assert.deepEqual(removedUserConfig.allowedUserIds, ["U2"]);
    assert.deepEqual(removedUserConfig.allowedChannelIds, ["C1"]);
    assert.equal(removedUserConfig.answerInThreads, true);
  });
});

describe("slack policy effects", () => {
  it("detects a fully locked-out manual allowlist config", () => {
    const effects = deriveSlackPolicyEffects({
      config: {
        ackReactionEnabled: false,
        allowedChannelIds: [],
        allowedUserIds: [],
        answerInThreads: true,
        channelAccessMode: "manual_allowlist",
        requireMentionInChannels: true,
      },
      currentConfig: {
        ackReactionEnabled: false,
        allowedChannelIds: ["C1"],
        allowedUserIds: ["U1"],
        answerInThreads: true,
        channelAccessMode: "manual_allowlist",
        requireMentionInChannels: true,
      },
      directoryChannels: [{ id: "C1", isArchived: false, isMember: true }],
    });

    assert.equal(effects.dmEnabled, false);
    assert.equal(effects.channelRepliesEnabled, false);
    assert.equal(effects.wouldFullyLockOutSlack, true);
    assert.ok(
      effects.warnings.some((warning) =>
        warning.includes("fully locks Otto out of Slack"),
      ),
    );
  });

  it("keeps channel replies enabled in member_of_channels mode when Otto is joined", () => {
    const effects = deriveSlackPolicyEffects({
      config: {
        ackReactionEnabled: false,
        allowedChannelIds: [],
        allowedUserIds: [],
        answerInThreads: true,
        channelAccessMode: "member_of_channels",
        requireMentionInChannels: true,
      },
      directoryChannels: [
        { id: "C1", isArchived: false, isMember: true },
        { id: "C2", isArchived: true, isMember: true },
        { id: "C3", isArchived: false, isMember: false },
      ],
    });

    assert.equal(effects.dmEnabled, false);
    assert.equal(effects.channelRepliesEnabled, true);
    assert.deepEqual(effects.effectiveChannelIds, ["C1"]);
    assert.equal(effects.wouldFullyLockOutSlack, false);
  });

  it("marks disabling DMs as destructive even when channel replies remain available", () => {
    const effects = deriveSlackPolicyEffects({
      config: {
        ackReactionEnabled: false,
        allowedChannelIds: ["C1"],
        allowedUserIds: [],
        answerInThreads: true,
        channelAccessMode: "manual_allowlist",
        requireMentionInChannels: true,
      },
      currentConfig: {
        ackReactionEnabled: false,
        allowedChannelIds: ["C1"],
        allowedUserIds: ["U1"],
        answerInThreads: true,
        channelAccessMode: "manual_allowlist",
        requireMentionInChannels: true,
      },
      directoryChannels: [{ id: "C1", isArchived: false, isMember: true }],
    });

    assert.equal(effects.wouldDisableDMs, true);
    assert.equal(effects.wouldDisableChannelReplies, false);
    assert.equal(effects.wouldFullyLockOutSlack, false);
    assert.equal(isSlackPolicyDestructive(effects), true);
  });
});
