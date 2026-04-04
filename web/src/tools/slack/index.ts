import {
  getDefaultSlackRuntimeConfig,
  parseSlackRuntimeConfig,
  SLACK_RUNTIME_CONFIG_DESCRIPTION,
  SLACK_RUNTIME_CONFIG_LABEL,
  SLACK_RUNTIME_CONFIG_SCHEMA_SOURCE,
  SLACK_RUNTIME_CONFIG_SCHEMA_VERSION,
  SLACK_RUNTIME_CONFIG_SURFACE_KEY,
  SLACK_RUNTIME_CONFIG_SURFACE_KIND,
  type SlackRuntimeConfig,
  slackRuntimeConfigJsonSchema,
  slackRuntimeConfigPatchSchema,
  slackRuntimeConfigUiHints,
} from "@/lib/slack-config";
import {
  getSlackDirectoryOptionsForTenant,
  validateSlackRuntimeConfigSemanticsForTenant,
} from "@/tools/server";
import type { DbTransaction } from "@/tools/server-types";
import type {
  AgentCapability,
  ToolActionMeaning,
  ToolAgentOperation,
  ToolFieldMeaning,
  ToolSurfaceDefinition,
} from "@/tools/types";

type SlackToolOptions = Awaited<
  ReturnType<typeof getSlackDirectoryOptionsForTenant>
>;

const fieldMeanings: ToolFieldMeaning[] = [
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

const agentOperations: ToolAgentOperation[] = [
  {
    description:
      "Read the current Slack policy surface, including derived reachability effects and safe semantic actions for agents.",
    key: "get_slack_policy",
    label: "Get Slack policy",
  },
  {
    description:
      "Preview a semantic Slack policy action, such as adding users or changing channel access mode, before persisting it.",
    key: "preview_slack_policy_action",
    label: "Preview Slack policy action",
  },
  {
    description:
      "Apply a semantic Slack policy action through the workspace app without sending a raw config patch.",
    key: "apply_slack_policy_action",
    label: "Apply Slack policy action",
  },
];

const agentCapabilities: AgentCapability[] = [
  {
    description: "A Slack DM to Otto starts or continues an agent session.",
    direction: "trigger",
    key: "slack:trigger:dm",
    label: "Receive direct messages",
    source: "integration",
  },
  {
    description: "An @Otto mention in a Slack channel triggers a session.",
    direction: "trigger",
    key: "slack:trigger:channel-mention",
    label: "Receive channel mentions",
    source: "integration",
  },
  {
    description:
      "Otto can send messages, replies, and thread replies to Slack channels and DMs.",
    direction: "tool",
    key: "slack:tool:send",
    label: "Send messages",
    openclawTool: "message",
    source: "integration",
  },
  {
    description: "Otto can add emoji reactions to Slack messages.",
    direction: "tool",
    key: "slack:tool:react",
    label: "React to messages",
    openclawTool: "message",
    source: "integration",
  },
  {
    description: "Otto can pin, delete, and moderate Slack messages.",
    direction: "tool",
    key: "slack:tool:manage",
    label: "Manage messages",
    openclawTool: "message",
    source: "integration",
  },
  {
    description: "Otto can read recent thread and channel history for context.",
    direction: "read",
    key: "slack:read:history",
    label: "Read message history",
    source: "integration",
  },
];

const actionMeanings: ToolActionMeaning[] = [
  {
    action: "install",
    description:
      "Install this runtime surface with its default config so it starts participating in desired-state compilation.",
    label: "Install",
  },
  {
    action: "uninstall",
    description:
      "Uninstall this runtime surface from the tenant runtime while preserving the last saved config for later reinstall.",
    label: "Uninstall",
  },
  {
    action: "enable",
    description:
      "Enable the installed runtime surface so its config is projected into tenant desired state.",
    label: "Enable",
  },
  {
    action: "disable",
    description:
      "Disable the installed runtime surface without deleting its saved config.",
    label: "Disable",
  },
  {
    action: "update",
    description:
      "Update the config for this installed runtime surface after validation succeeds.",
    label: "Update config",
  },
  {
    action: "reapply",
    description:
      "Re-run desired-state compilation and queue a tenant apply without changing the saved config.",
    label: "Reapply",
  },
];

export const slackToolSurfaceDefinition: ToolSurfaceDefinition<
  SlackRuntimeConfig,
  Partial<SlackRuntimeConfig>,
  SlackToolOptions
> = {
  actionMeanings,
  agentCapabilities,
  agentOperations,
  async buildOptions(context) {
    return getSlackDirectoryOptionsForTenant(context.tx as DbTransaction, {
      tenantId: context.tenantId,
    });
  },
  description: SLACK_RUNTIME_CONFIG_DESCRIPTION,
  fieldMeanings,
  getDefaultConfig: getDefaultSlackRuntimeConfig,
  id: "slack",
  installSource: "registry",
  key: SLACK_RUNTIME_CONFIG_SURFACE_KEY,
  kind: SLACK_RUNTIME_CONFIG_SURFACE_KIND,
  label: SLACK_RUNTIME_CONFIG_LABEL,
  parseConfig: parseSlackRuntimeConfig,
  parsePatch: (value) => slackRuntimeConfigPatchSchema.parse(value),
  schema: slackRuntimeConfigJsonSchema,
  schemaSource: SLACK_RUNTIME_CONFIG_SCHEMA_SOURCE,
  schemaVersion: SLACK_RUNTIME_CONFIG_SCHEMA_VERSION,
  scope: "tenant",
  surfaceType: "integration",
  supportsConfig: true,
  supportsEnable: true,
  supportsInstall: true,
  supportsReapply: true,
  uiGroup: "integrations",
  uiHints: slackRuntimeConfigUiHints,
  async validateSemantic(context) {
    await validateSlackRuntimeConfigSemanticsForTenant(
      context.tx as DbTransaction,
      {
        config: context.config,
        tenantId: context.tenantId,
      },
    );
  },
};
