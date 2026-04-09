import type { IntegrationDefinition } from "../../framework";
import { slackOAuthProvider } from "./oauth/provider";
import {
  slackAgentCapabilities,
  slackSettingsExamples,
} from "./settings-metadata";

export const slackIntegrationDefinition: IntegrationDefinition = {
  agentCapabilities: slackAgentCapabilities,
  categoryLabel: "Messaging",
  catalogDescription:
    "Choose who can use Otto in Slack and where Otto can reply.",
  description:
    "Manage Slack connection status and safe workspace-owned Slack settings.",
  iconSrc: "/integrations/slack.svg",
  key: "slack",
  label: "Slack",
  oauth: {
    provider: slackOAuthProvider,
  },
  pageDescription: "Choose who can use Otto in Slack and where Otto can reply.",
  runtimeSurface: {
    commandGroups: [],
    rootCommands: [],
    toolDescription:
      "Slack integration lifecycle and safe workspace-owned settings. Use configure_integration for settings and manage_integration to open the workspace when Slack needs attention.",
    toolName: "slack",
  },
  settings: {
    description:
      "Manage reply behavior, permissions, and channel access for Slack.",
    examples: slackSettingsExamples,
    label: "Configuration",
    recommendedWorkflow: [
      'Call configure_integration with {"integrationKey":"slack","action":"get"} first to inspect the current Slack settings and the editable fields.',
      "Use action=validate with a minimal Slack patch before saving it.",
      "Use action=apply with expectedEntryVersion from the most recent action=get response to persist the Slack change.",
    ],
  },
  settingsPath: (orgSlug) => `/${orgSlug}/integrations2/slack/status`,
  showInWorkspaceCatalog: true,
};
