import type { AgentCapability } from "@/lib/agent-capabilities";
import type {
  ToolActionMeaning,
  ToolAgentOperation,
  ToolFieldMeaning,
} from "@/tools/types";

export const slackFieldMeanings: ToolFieldMeaning[] = [
  {
    description:
      "Slack user IDs that are allowed to start direct-message conversations with Otto. IMPORTANT: clearing this list disables all direct messages to Otto.",
    key: "allowedUserIds",
    label: "Allowed users",
  },
  {
    description:
      "Slack channel IDs Otto is allowed to answer in when channel access mode is set to a manual allowlist. IMPORTANT: keeping this empty while channel access mode is 'manual_allowlist' disables all channel replies.",
    key: "allowedChannelIds",
    label: "Allowed channels",
  },
  {
    description:
      "When enabled, Otto replies in Slack threads instead of posting channel replies at the top level.",
    key: "answerInThreads",
    label: "Answer in threads",
  },
  {
    description:
      "Controls whether Otto only responds in configured channels or in any channel it has been added to.",
    key: "channelAccessMode",
    label: "Channel access mode",
  },
  {
    description:
      "When enabled, Otto requires an explicit @mention before replying in channels.",
    key: "requireMentionInChannels",
    label: "Require mention in channels",
  },
  {
    description:
      "When enabled, Otto reacts with :eyes: to acknowledge Slack events it is processing.",
    key: "ackReactionEnabled",
    label: "Ack reaction",
  },
];

export const slackAgentOperations: ToolAgentOperation[] = [
  {
    description:
      "Read Slack settings, validate candidate changes, and apply safe Slack configuration through the workspace app.",
    key: "configure_integration",
    label: "Configure Slack",
  },
];

export const slackSettingsExamples = [
  {
    action: "get" as const,
    description: "Read the current Slack settings before making changes.",
  },
  {
    action: "validate" as const,
    description:
      "Dry-run disabling the Slack acknowledgement reaction before saving it.",
    patch: {
      ackReactionEnabled: false,
    },
  },
  {
    action: "apply" as const,
    description:
      "Apply the acknowledgement reaction change after a prior read.",
    expectedEntryVersion: "<from configure_integration action=get>",
    patch: {
      ackReactionEnabled: false,
    },
    summary: "Disabled Slack acknowledgement reaction",
  },
];

export const slackAgentCapabilities: AgentCapability[] = [
  {
    description: "A Slack DM to Otto starts or continues an agent session.",
    direction: "trigger",
    key: "slack:trigger:dm",
    label: "Receive direct messages",
    source: "integration",
    userControllable: false,
  },
  {
    description: "An @Otto mention in a Slack channel triggers a session.",
    direction: "trigger",
    key: "slack:trigger:channel-mention",
    label: "Receive channel mentions",
    source: "integration",
    userControllable: false,
  },
  {
    description:
      "Otto can send messages, replies, and thread replies to Slack channels and DMs.",
    direction: "tool",
    key: "slack:tool:send",
    label: "Send messages",
    openclawTool: "message",
    source: "integration",
    userControllable: false,
  },
  {
    description: "Otto can add emoji reactions to Slack messages.",
    direction: "tool",
    key: "slack:tool:react",
    label: "React to messages",
    openclawTool: "message",
    source: "integration",
    userControllable: false,
  },
  {
    description: "Otto can pin, delete, and moderate Slack messages.",
    direction: "tool",
    key: "slack:tool:manage",
    label: "Manage messages",
    openclawTool: "message",
    source: "integration",
    userControllable: false,
  },
  {
    description: "Otto can read recent thread and channel history for context.",
    direction: "read",
    key: "slack:read:history",
    label: "Read message history",
    source: "integration",
    userControllable: false,
  },
];

export const slackActionMeanings: ToolActionMeaning[] = [
  {
    action: "install",
    description:
      "Install this Slack settings surface with its default config so it starts participating in desired-state compilation.",
    label: "Install",
  },
  {
    action: "uninstall",
    description:
      "Uninstall this Slack settings surface from the tenant runtime while preserving the last saved config for later reinstall.",
    label: "Uninstall",
  },
  {
    action: "enable",
    description:
      "Enable Slack settings projection so Otto can use the saved Slack policy.",
    label: "Enable",
  },
  {
    action: "disable",
    description:
      "Disable Slack settings projection without deleting the saved Slack policy.",
    label: "Disable",
  },
  {
    action: "update",
    description:
      "Update the Slack policy for this workspace after validation succeeds.",
    label: "Update config",
  },
  {
    action: "reapply",
    description:
      "Re-run desired-state compilation and queue a tenant apply without changing the saved Slack settings.",
    label: "Reapply",
  },
];
