import { WHATSAPP_RUNTIME_CONFIG_DESCRIPTION } from "../../../lib/whatsapp-config"
import { getToolDefinition } from "../../../tools"
import type { IntegrationDefinition } from "../../framework"

const whatsappToolDefinition = getToolDefinition("channel", "whatsapp")

const whatsappSettingsExamples = [
  {
    action: "get" as const,
    description:
      "Read the current WhatsApp connection state and saved policy before making changes.",
  },
  {
    action: "validate" as const,
    description:
      "Dry-run a WhatsApp policy change before saving it to the workspace.",
    patch: {
      ackReactionEnabled: true,
      dmPolicy: "allowlist",
    },
  },
  {
    action: "apply" as const,
    description:
      "Save a WhatsApp policy change after validating it with the current entry version.",
    expectedEntryVersion: "<from configure_integration action=get>",
    patch: {
      ackReactionEnabled: true,
      dmPolicy: "allowlist",
    },
    summary: "Updated WhatsApp settings",
  },
]

export const whatsappIntegrationDefinition: IntegrationDefinition = {
  agentCapabilities: whatsappToolDefinition?.agentCapabilities ?? [],
  categoryLabel: "Messaging",
  catalogDescription: WHATSAPP_RUNTIME_CONFIG_DESCRIPTION,
  description:
    "Connect one dedicated WhatsApp Business number and manage who can reach Otto there.",
  iconSrc: "/integrations/whatsapp.png",
  key: "whatsapp",
  label: "WhatsApp",
  managementMode: "workspace_managed",
  pageDescription:
    "Connect one dedicated WhatsApp Business number to Otto and control who can reach it.",
  runtimeSurface: {
    commandGroups: [],
    rootCommands: [],
    toolDescription:
      "WhatsApp integration lifecycle and safe workspace-owned settings. Use configure_integration for policy changes and manage_integration to open the workspace when WhatsApp needs attention.",
    toolName: "whatsapp",
  },
  settings: {
    description:
      "Manage DM access, allowed groups, sender policy, and reply behavior for WhatsApp.",
    examples: whatsappSettingsExamples,
    label: "Configuration",
    recommendedWorkflow: [
      'Call configure_integration with {"integrationKey":"whatsapp","action":"get"} first to inspect the current WhatsApp settings and editable fields.',
      "Use action=validate with a minimal WhatsApp patch before saving it.",
      "Use action=apply with expectedEntryVersion from the most recent action=get response to persist the change.",
    ],
  },
  settingsPath: (orgSlug) =>
    `/${orgSlug}/settings/agent/integrations/whatsapp/status`,
  showInWorkspaceCatalog: true,
}
