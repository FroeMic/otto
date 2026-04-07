import type { ComponentType } from "react";

import type { ConnectedOauthAccessRecord } from "@/db/oauth";
import type { OAuthProviderDefinition } from "@/lib/oauth/providers/types";
import type { AgentCapability } from "@/tools/types";

export type IntegrationOperationDefinition = {
  description: string;
  exampleArguments?: Record<string, unknown>;
  intentKeywords?: string[];
  key: string;
  label: string;
  parametersSchema: Record<string, unknown>;
  usageNotes?: string[];
};

export type IntegrationOperationExecute = (input: {
  context: IntegrationExecutionContext;
  params: Record<string, unknown>;
}) => Promise<unknown>;

export type IntegrationOperationValidate = (
  params: Record<string, unknown>,
) => Record<string, unknown>;

export type IntegrationRuntimeOperationDefinition =
  IntegrationOperationDefinition & {
    execute: IntegrationOperationExecute;
    validate?: IntegrationOperationValidate;
  };

export type IntegrationRuntimeToolDefinition = {
  operations: IntegrationRuntimeOperationDefinition[];
  toolDescription: string;
  toolName: string;
};

export type RuntimeIntegrationManifestEntry = {
  description: string;
  key: string;
  label: string;
  operations: IntegrationOperationDefinition[];
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

export type RuntimeIntegrationResponse = {
  description: string;
  key: string;
  label: string;
  operations: RuntimeIntegrationOperationResponse[];
  status: RuntimeIntegrationStatus;
  toolDescription: string;
  toolName: string;
  usageGuide: RuntimeIntegrationUsageGuide;
};

export type RuntimeIntegrationUsageGuide = {
  argumentsField: "arguments";
  connectionToolName: "manage_integration_connection";
  detailToolName: "get_integration";
  discoveryToolName: "find_integration_functions";
  executeToolName: "execute_integration_function";
  recommendedWorkflow: string[];
};

export type RuntimeIntegrationOperationExecutionGuide = {
  argumentsField: "arguments";
  exampleCall: {
    arguments: Record<string, unknown>;
    functionKey: string;
    integrationKey: string;
  };
  functionKey: string;
  integrationKey: string;
  toolName: "execute_integration_function";
};

export type RuntimeIntegrationOperationResponse = {
  description: string;
  executionGuide: RuntimeIntegrationOperationExecutionGuide;
  key: string;
  label: string;
  parametersSchema: Record<string, unknown>;
  usageNotes: string[];
};

export type RuntimeIntegrationFunctionMatch = {
  connected: boolean;
  exampleArguments: Record<string, unknown>;
  functionKey: string;
  functionLabel: string;
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
  runtimeTool: IntegrationRuntimeToolDefinition | null;
  settingsPath: (orgSlug: string) => string;
  showInWorkspaceCatalog: boolean;
  ui?: {
    loadDetailPage?: () => Promise<ComponentType<IntegrationPageProps>>;
    overviewItem?: ComponentType<IntegrationOverviewItemProps>;
  };
};
