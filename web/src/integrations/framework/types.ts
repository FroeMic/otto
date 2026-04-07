import type { ComponentType } from "react";

import type { ConnectedOauthAccessRecord } from "@/db/oauth";
import type { OAuthProviderDefinition } from "@/lib/oauth/providers/types";
import type { AgentCapability } from "@/tools/types";

export type IntegrationOperationDefinition = {
  description: string;
  key: string;
  label: string;
  parametersSchema: Record<string, unknown>;
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
  operations: IntegrationOperationDefinition[];
  status: RuntimeIntegrationStatus;
  toolDescription: string;
  toolName: string;
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
