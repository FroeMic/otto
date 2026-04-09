import type { IntegrationDefinition } from "@/integrations/framework";
import { slackToolSurfaceDefinition } from "@/tools/slack";

import { SlackIntegrationListItem } from "./ui/list-item";

export const slackIntegrationDefinition: IntegrationDefinition = {
  agentCapabilities: slackToolSurfaceDefinition.agentCapabilities ?? [],
  categoryLabel: "Messaging",
  catalogDescription:
    "Choose who can use Otto in Slack and where Otto can reply.",
  description:
    "Manage Slack connection status and safe workspace-owned Slack settings.",
  iconSrc: "/integrations/slack.svg",
  key: "slack",
  label: "Slack",
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
    label: "Configuration",
  },
  settingsPath: (orgSlug) => `/${orgSlug}/integrations2/slack`,
  showInWorkspaceCatalog: true,
  ui: {
    loadDetailPage: () =>
      import("./ui/page").then((module) => module.SlackManagedIntegrationPage),
    overviewItem: SlackIntegrationListItem,
  },
};
