import type { AgentCapability } from "@/lib/agent-capabilities";
import {
  getDefaultWhatsAppRuntimeConfig,
  parseWhatsAppRuntimeConfig,
  WHATSAPP_RUNTIME_CONFIG_DESCRIPTION,
  WHATSAPP_RUNTIME_CONFIG_LABEL,
  WHATSAPP_RUNTIME_CONFIG_SCHEMA_SOURCE,
  WHATSAPP_RUNTIME_CONFIG_SCHEMA_VERSION,
  WHATSAPP_RUNTIME_CONFIG_SURFACE_KEY,
  WHATSAPP_RUNTIME_CONFIG_SURFACE_KIND,
  type WhatsAppRuntimeConfig,
  whatsappRuntimeConfigJsonSchema,
  whatsappRuntimeConfigPatchSchema,
  whatsappRuntimeConfigUiHints,
} from "@/lib/whatsapp-config";
import type {
  ToolActionMeaning,
  ToolAgentOperation,
  ToolFieldMeaning,
  ToolSurfaceDefinition,
} from "@/tools/types";
import { deriveWhatsAppPolicyEffects } from "@/tools/whatsapp/policy";

const fieldMeanings: ToolFieldMeaning[] = [
  {
    description:
      "Controls whether Otto accepts WhatsApp direct messages through pairing, an explicit allowlist, or not at all.",
    key: "dmPolicy",
    label: "DM access mode",
  },
  {
    description:
      "WhatsApp numbers in E.164 format that Otto allows in direct messages. Clearing this list while DM access mode is allowlist disables all direct messages.",
    key: "allowedNumbers",
    label: "Allowed numbers",
  },
  {
    description:
      "Controls whether Otto answers in no WhatsApp groups or only in explicitly allowlisted groups.",
    key: "groupPolicy",
    label: "Group access mode",
  },
  {
    description:
      "WhatsApp group IDs ending in @g.us where Otto may answer. Leaving this empty while group access mode is allowlist disables all group replies.",
    key: "allowedGroupIds",
    label: "Allowed group IDs",
  },
  {
    description:
      "WhatsApp numbers allowed to trigger Otto inside allowlisted groups. If this list is empty, Otto falls back to the DM allowlist.",
    key: "groupAllowedNumbers",
    label: "Allowed group senders",
  },
  {
    description:
      "When enabled, Otto requires an explicit mention before replying inside allowed WhatsApp groups.",
    key: "requireMentionInGroups",
    label: "Require mention in groups",
  },
  {
    description:
      "When enabled, Otto reacts with an eyes emoji when it accepts a WhatsApp message.",
    key: "ackReactionEnabled",
    label: "Ack reaction",
  },
];

const agentOperations: ToolAgentOperation[] = [
  {
    description:
      "Read the current WhatsApp policy surface, validate candidate patches, and apply policy changes through the workspace app.",
    key: "manage_whatsapp_policy",
    label: "Manage WhatsApp policy",
  },
];

const agentCapabilities: AgentCapability[] = [
  {
    description:
      "A WhatsApp message to Otto's number starts or continues a session.",
    direction: "trigger",
    key: "whatsapp:trigger:dm",
    label: "Receive direct messages",
    source: "integration",
  },
  {
    description: "An @mention in an allowed WhatsApp group triggers a session.",
    direction: "trigger",
    key: "whatsapp:trigger:group-mention",
    label: "Receive group mentions",
    source: "integration",
  },
  {
    description: "Otto can send and reply to WhatsApp messages.",
    direction: "tool",
    key: "whatsapp:tool:send",
    label: "Send messages",
    openclawTool: "message",
    source: "integration",
  },
  {
    description: "Otto can add emoji reactions to WhatsApp messages.",
    direction: "tool",
    key: "whatsapp:tool:react",
    label: "React to messages",
    openclawTool: "message",
    source: "integration",
  },
];

const actionMeanings: ToolActionMeaning[] = [
  {
    action: "update",
    description:
      "Update the WhatsApp policy for Otto's dedicated business number after validation succeeds.",
    label: "Update config",
  },
  {
    action: "reapply",
    description:
      "Re-run desired-state compilation and queue a tenant apply without changing the saved WhatsApp policy.",
    label: "Reapply",
  },
];

export const whatsappToolSurfaceDefinition: ToolSurfaceDefinition<
  WhatsAppRuntimeConfig,
  Partial<WhatsAppRuntimeConfig>
> = {
  actionMeanings,
  agentCapabilities,
  agentOperations,
  async buildOptions() {
    return {};
  },
  description: WHATSAPP_RUNTIME_CONFIG_DESCRIPTION,
  fieldMeanings,
  getDefaultConfig: getDefaultWhatsAppRuntimeConfig,
  id: "whatsapp",
  installSource: "registry",
  key: WHATSAPP_RUNTIME_CONFIG_SURFACE_KEY,
  kind: WHATSAPP_RUNTIME_CONFIG_SURFACE_KIND,
  label: WHATSAPP_RUNTIME_CONFIG_LABEL,
  parseConfig: parseWhatsAppRuntimeConfig,
  parsePatch: (value) => whatsappRuntimeConfigPatchSchema.parse(value),
  schema: whatsappRuntimeConfigJsonSchema,
  schemaSource: WHATSAPP_RUNTIME_CONFIG_SCHEMA_SOURCE,
  schemaVersion: WHATSAPP_RUNTIME_CONFIG_SCHEMA_VERSION,
  scope: "tenant",
  surfaceType: "integration",
  supportsConfig: true,
  supportsEnable: false,
  supportsInstall: false,
  supportsReapply: true,
  uiGroup: "integrations",
  uiHints: whatsappRuntimeConfigUiHints,
  async validateSemantic(context) {
    deriveWhatsAppPolicyEffects({
      config: context.config,
    });
  },
};
