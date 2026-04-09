import type { ComponentType } from "react";

import type { ConnectedOauthAccessRecord } from "@/db/oauth";
import type { OAuthProviderDefinition } from "@/lib/oauth/providers/types";
import type { AgentCapability } from "@/tools/types";

export type IntegrationCommandInputMode =
  | "file_ref"
  | "json"
  | "json_and_file_ref";

export type IntegrationCommandResultMode = "download_url" | "file_ref" | "json";

export type IntegrationCapabilityPolicy = {
  policy: "allow" | "block";
};

export type IntegrationCommandEffect = "read" | "write";

export type RuntimeCapabilityState = {
  reason?: string;
  status: "disabled" | "enabled" | "needs_attention";
};

export type IntegrationCommandDefinition = {
  agentAvailability?: {
    available: boolean;
    reason: string;
  };
  argumentsSchema: Record<string, unknown>;
  commandKey: string;
  commandPath: string[];
  description: string;
  effect?: IntegrationCommandEffect;
  exampleArguments?: Record<string, unknown>;
  inputMode: IntegrationCommandInputMode;
  intentKeywords?: string[];
  label: string;
  resultMode: IntegrationCommandResultMode;
  userControllable?: boolean;
  usageNotes?: string[];
};

export type IntegrationCommandExecute = (input: {
  arguments: Record<string, unknown>;
  context: IntegrationExecutionContext;
}) => Promise<unknown>;

export type IntegrationCommandValidate = (
  arguments_: Record<string, unknown>,
) => Record<string, unknown>;

export type IntegrationRuntimeCommandDefinition =
  IntegrationCommandDefinition & {
    execute: IntegrationCommandExecute;
    validate?: IntegrationCommandValidate;
  };

export type IntegrationCommandGroupDefinition = {
  childGroups?: IntegrationRuntimeCommandGroupDefinition[];
  commands?: IntegrationRuntimeCommandDefinition[];
  description: string;
  groupKey: string;
  groupPath: string[];
  intentKeywords?: string[];
  label: string;
};

export type IntegrationRuntimeCommandGroupDefinition =
  IntegrationCommandGroupDefinition;

export type IntegrationRuntimeSurfaceDefinition = {
  commandGroups: IntegrationRuntimeCommandGroupDefinition[];
  rootCommands: IntegrationRuntimeCommandDefinition[];
  toolDescription: string;
  toolName: string;
};

export type RuntimeIntegrationManifestEntry = {
  commandGroups: RuntimeIntegrationCommandGroupSummary[];
  description: string;
  key: string;
  label: string;
  rootCommands: RuntimeIntegrationCommandSummary[];
  toolDescription: string;
  toolName: string;
};

export type RuntimeIntegrationStatus = {
  connected: boolean;
  connectionStatus: string | null;
  enabled: boolean;
  integrationStatus: string | null;
  needsAttention: boolean;
};

export type RuntimeIntegrationUsageGuide = {
  connectionToolName: "manage_integration";
  detailToolName: "get_integration_details";
  discoveryToolName: "find_integration_commands";
  executeToolName: "execute_integration_command";
  inventoryToolName: "list_integrations";
  recommendedWorkflow: string[];
};

export type RuntimeIntegrationCommandSummary = {
  commandKey: string;
  commandPath: string[];
  label: string;
};

export type RuntimeIntegrationCommandGroupSummary = {
  commandCount: number;
  groupKey: string;
  groupPath: string[];
  label: string;
};

export type RuntimeIntegrationSummaryResponse = {
  available: boolean;
  commandGroups: RuntimeIntegrationCommandGroupSummary[];
  description: string;
  installed: boolean;
  key: string;
  label: string;
  rootCommands: RuntimeIntegrationCommandSummary[];
  status: RuntimeIntegrationStatus;
  toolDescription: string;
  toolName: string;
  usageGuide: RuntimeIntegrationUsageGuide;
};

export type RuntimeIntegrationCommandDetails = {
  argumentsSchema: Record<string, unknown>;
  capabilityState: RuntimeCapabilityState;
  commandKey: string;
  commandPath: string[];
  description: string;
  exampleArguments: Record<string, unknown>;
  exampleCall: {
    arguments: Record<string, unknown>;
    commandKey: string;
    integrationKey: string;
  };
  inputMode: IntegrationCommandInputMode;
  label: string;
  policy: IntegrationCapabilityPolicy | null;
  resultMode: IntegrationCommandResultMode;
  userControllable: boolean;
  usageNotes: string[];
};

export type RuntimeIntegrationCommandGroupDetails = {
  childGroups: RuntimeIntegrationCommandGroupSummary[];
  commands: RuntimeIntegrationCommandSummary[];
  description: string;
  groupKey: string;
  groupPath: string[];
  label: string;
};

export type RuntimeIntegrationDetailsResponse = {
  command?: RuntimeIntegrationCommandDetails;
  detailType: "command" | "command_group";
  group?: RuntimeIntegrationCommandGroupDetails;
  integration: Pick<
    RuntimeIntegrationSummaryResponse,
    "description" | "key" | "label" | "status" | "usageGuide"
  >;
};

export type RuntimeIntegrationCommandMatch = {
  commandGroupPath: string[];
  commandKey: string;
  commandLabel: string;
  connected: boolean;
  exampleArguments: Record<string, unknown>;
  integrationKey: string;
  integrationLabel: string;
  needsAttention: boolean;
  reason: string;
};

export type IntegrationExecutionContext = {
  auth: ConnectedOauthAccessRecord | null;
  tenantIntegrationId: string | null;
};

export type IntegrationOauthBinding = {
  provider: OAuthProviderDefinition;
};

export type IntegrationPageProps = {
  orgSlug: string;
  userExternalId: string;
};

export type IntegrationOverviewEntry = {
  capabilitySummary: {
    reads: number;
    tools: number;
    triggers: number;
  } | null;
  categoryLabel: string;
  connected: boolean;
  description: string;
  key: string;
  label: string;
  needsAttention: boolean;
  settingsPath: string;
};

export type IntegrationOverviewItemProps = {
  entry: IntegrationOverviewEntry;
};

export type IntegrationSettingsDefinition = {
  description?: string;
  label: string;
};

export type IntegrationDefinition = {
  agentCapabilities: AgentCapability[];
  categoryLabel: string;
  catalogDescription: string;
  description: string;
  iconSrc: string | null;
  key: string;
  label: string;
  oauth?: IntegrationOauthBinding;
  pageDescription: string;
  runtimeSurface: IntegrationRuntimeSurfaceDefinition | null;
  settings?: IntegrationSettingsDefinition;
  settingsPath: (orgSlug: string) => string;
  showInWorkspaceCatalog: boolean;
  ui?: {
    loadDetailPage?: () => Promise<ComponentType<IntegrationPageProps>>;
    overviewItem?: ComponentType<IntegrationOverviewItemProps>;
  };
};
