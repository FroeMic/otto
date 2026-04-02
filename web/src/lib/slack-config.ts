import { z } from "zod";

export const SLACK_RUNTIME_CONFIG_SURFACE_KIND = "channel";
export const SLACK_RUNTIME_CONFIG_SURFACE_KEY = "slack";
export const SLACK_RUNTIME_CONFIG_SCHEMA_SOURCE = "otto_builtin";
export const SLACK_RUNTIME_CONFIG_SCHEMA_VERSION = "3";
export const SLACK_RUNTIME_CONFIG_LABEL = "Slack";
export const SLACK_RUNTIME_CONFIG_DESCRIPTION =
  "Manage reply behavior, permissions, and channel access for Slack.";

const slackIdSchema = z.string().trim().min(1);
const slackChannelAccessModeSchema = z.enum([
  "manual_allowlist",
  "member_of_channels",
]);

const slackRuntimeConfigObjectSchema = z.object({
  ackReactionEnabled: z.boolean().default(false),
  allowedChannelIds: z.array(slackIdSchema).default([]),
  allowedUserIds: z.array(slackIdSchema).default([]),
  answerInThreads: z.boolean().default(true),
  channelAccessMode: slackChannelAccessModeSchema.default("manual_allowlist"),
  requireMentionInChannels: z.boolean().default(true),
});

export const slackRuntimeConfigSchema = slackRuntimeConfigObjectSchema
  .strict()
  .transform((value) => ({
    ackReactionEnabled: value.ackReactionEnabled,
    allowedChannelIds: [...new Set(value.allowedChannelIds)],
    allowedUserIds: [...new Set(value.allowedUserIds)],
    answerInThreads: value.answerInThreads,
    channelAccessMode: value.channelAccessMode,
    requireMentionInChannels: value.requireMentionInChannels,
  }));

export type SlackRuntimeConfig = z.infer<typeof slackRuntimeConfigSchema>;

export const slackRuntimeConfigPatchSchema = slackRuntimeConfigObjectSchema
  .partial()
  .strict();

export const slackRuntimeConfigJsonSchema = {
  additionalProperties: false,
  properties: {
    ackReactionEnabled: {
      default: false,
      type: "boolean",
    },
    allowedChannelIds: {
      default: [],
      items: {
        minLength: 1,
        type: "string",
      },
      type: "array",
    },
    allowedUserIds: {
      default: [],
      items: {
        minLength: 1,
        type: "string",
      },
      type: "array",
    },
    answerInThreads: {
      default: true,
      type: "boolean",
    },
    channelAccessMode: {
      default: "manual_allowlist",
      enum: ["manual_allowlist", "member_of_channels"],
      type: "string",
    },
    requireMentionInChannels: {
      default: true,
      type: "boolean",
    },
  },
  type: "object",
} as const;

export const slackRuntimeConfigUiHints = {
  description: SLACK_RUNTIME_CONFIG_DESCRIPTION,
  fields: {
    ackReactionEnabled: {
      kind: "boolean",
      label: "Ack reaction",
    },
    allowedChannelIds: {
      label: "Allowed channels",
      picker: "slack-channel-multi-select",
    },
    allowedUserIds: {
      label: "Allowed users",
      picker: "slack-user-multi-select",
    },
    answerInThreads: {
      label: "Answer in threads",
      kind: "boolean",
    },
    channelAccessMode: {
      kind: "enum",
      label: "Channel access mode",
      options: [
        {
          label: "Only pre-configured channels",
          value: "manual_allowlist",
        },
        {
          label: "All channels Otto is added to",
          value: "member_of_channels",
        },
      ],
    },
    requireMentionInChannels: {
      label: "Require mention in channels",
      kind: "boolean",
    },
  },
  label: SLACK_RUNTIME_CONFIG_LABEL,
} as const;

export function getDefaultSlackRuntimeConfig(): SlackRuntimeConfig {
  return slackRuntimeConfigSchema.parse({});
}

export function parseSlackRuntimeConfig(value: unknown): SlackRuntimeConfig {
  return slackRuntimeConfigSchema.parse(value);
}
