import { z } from "zod";

import {
  parseSlackRuntimeConfig,
  type SlackRuntimeConfig,
} from "../../../lib/slack-config";

export type SlackPolicyDirectoryChannel = {
  id: string;
  isArchived?: boolean;
  isMember?: boolean;
};

export type SlackPolicyDerivedEffects = {
  channelRepliesEnabled: boolean;
  dmEnabled: boolean;
  effectiveChannelCount: number;
  effectiveChannelIds: string[];
  warnings: string[];
  wouldDisableChannelReplies: boolean;
  wouldDisableDMs: boolean;
  wouldFullyLockOutSlack: boolean;
};

export function isSlackPolicyDestructive(
  effects: SlackPolicyDerivedEffects,
): boolean {
  return (
    effects.wouldDisableDMs ||
    effects.wouldDisableChannelReplies ||
    effects.wouldFullyLockOutSlack
  );
}

const slackChannelAccessModeSchema = z.enum([
  "manual_allowlist",
  "member_of_channels",
]);

const slackIdArraySchema = z.array(z.string().trim().min(1)).min(1);

export const slackPolicyActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("add_allowed_users"),
    userIds: slackIdArraySchema,
  }),
  z.object({
    type: z.literal("remove_allowed_users"),
    userIds: slackIdArraySchema,
  }),
  z.object({
    channelIds: slackIdArraySchema,
    type: z.literal("add_allowed_channels"),
  }),
  z.object({
    channelIds: slackIdArraySchema,
    type: z.literal("remove_allowed_channels"),
  }),
  z.object({
    type: z.literal("set_channel_access_mode"),
    value: slackChannelAccessModeSchema,
  }),
  z.object({
    type: z.literal("set_answer_in_threads"),
    value: z.boolean(),
  }),
  z.object({
    type: z.literal("set_require_mentions"),
    value: z.boolean(),
  }),
  z.object({
    type: z.literal("set_ack_reaction"),
    value: z.boolean(),
  }),
]);

export type SlackPolicyAction = z.infer<typeof slackPolicyActionSchema>;

export function parseSlackPolicyAction(value: unknown): SlackPolicyAction {
  return slackPolicyActionSchema.parse(value);
}

export function applySlackPolicyAction(
  currentConfig: SlackRuntimeConfig,
  action: SlackPolicyAction,
): SlackRuntimeConfig {
  switch (action.type) {
    case "add_allowed_users":
      return parseSlackRuntimeConfig({
        ...currentConfig,
        allowedUserIds: [...currentConfig.allowedUserIds, ...action.userIds],
      });
    case "remove_allowed_users":
      return parseSlackRuntimeConfig({
        ...currentConfig,
        allowedUserIds: currentConfig.allowedUserIds.filter(
          (userId) => !action.userIds.includes(userId),
        ),
      });
    case "add_allowed_channels":
      return parseSlackRuntimeConfig({
        ...currentConfig,
        allowedChannelIds: [
          ...currentConfig.allowedChannelIds,
          ...action.channelIds,
        ],
      });
    case "remove_allowed_channels":
      return parseSlackRuntimeConfig({
        ...currentConfig,
        allowedChannelIds: currentConfig.allowedChannelIds.filter(
          (channelId) => !action.channelIds.includes(channelId),
        ),
      });
    case "set_channel_access_mode":
      return parseSlackRuntimeConfig({
        ...currentConfig,
        channelAccessMode: action.value,
      });
    case "set_answer_in_threads":
      return parseSlackRuntimeConfig({
        ...currentConfig,
        answerInThreads: action.value,
      });
    case "set_require_mentions":
      return parseSlackRuntimeConfig({
        ...currentConfig,
        requireMentionInChannels: action.value,
      });
    case "set_ack_reaction":
      return parseSlackRuntimeConfig({
        ...currentConfig,
        ackReactionEnabled: action.value,
      });
  }
}

export function deriveSlackPolicyEffects(input: {
  config: SlackRuntimeConfig;
  currentConfig?: SlackRuntimeConfig;
  directoryChannels: SlackPolicyDirectoryChannel[];
}): SlackPolicyDerivedEffects {
  const activeJoinedChannelIds = input.directoryChannels
    .filter((channel) => channel.isMember && !channel.isArchived)
    .map((channel) => channel.id);
  const effectiveChannelIds =
    input.config.channelAccessMode === "member_of_channels"
      ? activeJoinedChannelIds
      : [...input.config.allowedChannelIds];
  const uniqueEffectiveChannelIds = [...new Set(effectiveChannelIds)];
  const dmEnabled = input.config.allowedUserIds.length > 0;
  const channelRepliesEnabled = uniqueEffectiveChannelIds.length > 0;
  const wouldFullyLockOutSlack = !dmEnabled && !channelRepliesEnabled;
  const currentEffects = input.currentConfig
    ? deriveSlackPolicyEffects({
        config: input.currentConfig,
        directoryChannels: input.directoryChannels,
      })
    : null;
  const warnings: string[] = [];

  if (
    currentEffects?.dmEnabled &&
    !dmEnabled &&
    input.currentConfig &&
    input.currentConfig.allowedUserIds.length > 0
  ) {
    warnings.push(
      "This change disables all direct messages to Otto by clearing the DM allowlist.",
    );
  }

  if (currentEffects?.channelRepliesEnabled && !channelRepliesEnabled) {
    warnings.push(
      "This change leaves Otto without any reachable Slack channels to reply in.",
    );
  }

  if (
    input.currentConfig?.channelAccessMode === "member_of_channels" &&
    input.config.channelAccessMode === "manual_allowlist" &&
    input.config.allowedChannelIds.length === 0
  ) {
    warnings.push(
      "Switching to manual allowlist mode with no allowed channels disables all channel replies.",
    );
  }

  if (
    input.config.channelAccessMode === "member_of_channels" &&
    activeJoinedChannelIds.length === 0
  ) {
    warnings.push(
      "Otto is not currently joined to any Slack channels, so 'member_of_channels' mode leaves channel replies unavailable.",
    );
  }

  if (wouldFullyLockOutSlack) {
    warnings.push(
      "This resulting Slack policy fully locks Otto out of Slack by disabling both direct messages and channel replies.",
    );
  }

  return {
    channelRepliesEnabled,
    dmEnabled,
    effectiveChannelCount: uniqueEffectiveChannelIds.length,
    effectiveChannelIds: uniqueEffectiveChannelIds,
    warnings: [...new Set(warnings)],
    wouldDisableChannelReplies:
      currentEffects?.channelRepliesEnabled === true && !channelRepliesEnabled,
    wouldDisableDMs: currentEffects?.dmEnabled === true && !dmEnabled,
    wouldFullyLockOutSlack,
  };
}
