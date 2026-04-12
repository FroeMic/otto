import type { IntegrationDefinition } from "../../framework";
import { resolveRuntimeWebSearchConfig } from "../../../lib/web-search-config";

import {
  braveAgentCapabilities,
  braveSettingsExamples,
} from "./settings-metadata";

export const braveIntegrationDefinition: IntegrationDefinition = {
  agentCapabilities: braveAgentCapabilities,
  categoryLabel: "Research",
  catalogDescription:
    "Search the web through Otto's managed Brave provider without exposing provider credentials to tenant runtimes.",
  description:
    "Managed Brave web search backed by workspace app configuration and shared across the workspace.",
  iconSrc: "/integrations/web-search.svg",
  key: "brave",
  label: "Brave",
  managementMode: "platform_managed",
  pageDescription:
    "Review the managed Brave web-search defaults Otto projects into runtimes for this workspace.",
  resolveStatus: () => {
    const resolved = resolveRuntimeWebSearchConfig();
    const braveIsSelected = resolved.surfaceConfig.provider === "brave";

    if (!resolved.enabled || !braveIsSelected) {
      return {
        connected: false,
        connectionStatus: "managed",
        enabled: true,
        integrationStatus: "needs_attention",
        needsAttention: true,
      };
    }

    return {
      connected: true,
      connectionStatus: "managed",
      enabled: true,
      integrationStatus: "connected",
      needsAttention: false,
    };
  },
  runtimeSurface: {
    commandGroups: [],
    rootCommands: [],
    toolDescription:
      "Brave web search is platform-managed by Otto. Use get_integration and configure_integration(action=get) to inspect its status and projected defaults. Otto executes Brave-backed web search through the managed web_search tool, not execute_integration_command.",
    toolName: "brave",
  },
  settings: {
    description:
      "Read the current managed Brave web-search defaults. These settings are controlled by the workspace app and are not editable here.",
    examples: braveSettingsExamples,
    label: "Configuration",
    recommendedWorkflow: [
      'Call configure_integration with {"integrationKey":"brave","action":"get"} to inspect the current Brave defaults and status.',
      "Brave is platform-managed by Otto, so workspace users cannot change or disable it here.",
    ],
  },
  settingsPath: (orgSlug) =>
    `/${orgSlug}/settings/agent/integrations/brave/status`,
  showInWorkspaceCatalog: true,
};
