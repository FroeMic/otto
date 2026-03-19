import {
  getDefaultSlackRuntimeConfig,
  parseSlackRuntimeConfig,
  SLACK_RUNTIME_CONFIG_DESCRIPTION,
  SLACK_RUNTIME_CONFIG_LABEL,
  SLACK_RUNTIME_CONFIG_SCHEMA_SOURCE,
  SLACK_RUNTIME_CONFIG_SCHEMA_VERSION,
  SLACK_RUNTIME_CONFIG_SURFACE_KEY,
  SLACK_RUNTIME_CONFIG_SURFACE_KIND,
  slackRuntimeConfigJsonSchema,
  slackRuntimeConfigPatchSchema,
  slackRuntimeConfigUiHints,
  type SlackRuntimeConfig,
} from "@/lib/slack-config";
import {
  getSlackDirectoryOptionsForTenant,
  validateSlackRuntimeConfigSemanticsForTenant,
} from "@/tools/server";
import type { DbTransaction } from "@/tools/server-types";
import type {
  ToolActionMeaning,
  ToolFieldMeaning,
  ToolSurfaceDefinition,
} from "@/tools/types";

type SlackToolOptions = Awaited<
  ReturnType<typeof getSlackDirectoryOptionsForTenant>
>;

const fieldMeanings: ToolFieldMeaning[] = [
  {
    description:
      "Slack user IDs that are allowed to start direct-message conversations with Otto.",
    key: "allowedUserIds",
    label: "Allowed users",
  },
  {
    description:
      "Slack channel IDs Otto is allowed to answer in when channel access mode is set to a manual allowlist.",
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

const actionMeanings: ToolActionMeaning[] = [
  {
    action: "install",
    description:
      "Install this tool surface with its default config so it starts participating in desired-state compilation.",
    label: "Install",
  },
  {
    action: "uninstall",
    description:
      "Uninstall this tool surface from the tenant runtime while preserving the last saved config for later reinstall.",
    label: "Uninstall",
  },
  {
    action: "enable",
    description:
      "Enable the installed tool surface so its config is projected into tenant desired state.",
    label: "Enable",
  },
  {
    action: "disable",
    description:
      "Disable the installed tool surface without deleting its saved config.",
    label: "Disable",
  },
  {
    action: "update",
    description:
      "Update the config for this installed tool surface after validation succeeds.",
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
  supportsConfig: true,
  supportsEnable: true,
  supportsInstall: true,
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
