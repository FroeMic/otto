import type {
  IntegrationDefinition,
  IntegrationOverviewEntry,
  RuntimeIntegrationResponse,
  RuntimeIntegrationStatus,
} from "./types";

export function buildRuntimeIntegrationResponse(input: {
  definition: IntegrationDefinition & {
    runtimeTool: NonNullable<IntegrationDefinition["runtimeTool"]>;
  };
  status: RuntimeIntegrationStatus;
}): RuntimeIntegrationResponse {
  return {
    description: input.definition.description,
    key: input.definition.key,
    label: input.definition.label,
    operations: input.definition.runtimeTool.operations.map((operation) => ({
      description: operation.description,
      key: operation.key,
      label: operation.label,
      parametersSchema: operation.parametersSchema,
    })),
    status: input.status,
    toolDescription: input.definition.runtimeTool.toolDescription,
    toolName: input.definition.runtimeTool.toolName,
  };
}

export function buildIntegrationOverviewEntry(input: {
  connected: boolean;
  definition: IntegrationDefinition;
  needsAttention: boolean;
  orgSlug: string;
}): IntegrationOverviewEntry {
  return {
    capabilitySummary:
      input.definition.agentCapabilities.length > 0
        ? {
            reads: input.definition.agentCapabilities.filter(
              (capability) => capability.direction === "read",
            ).length,
            tools: input.definition.agentCapabilities.filter(
              (capability) => capability.direction === "tool",
            ).length,
            triggers: input.definition.agentCapabilities.filter(
              (capability) => capability.direction === "trigger",
            ).length,
          }
        : null,
    categoryLabel: input.definition.categoryLabel,
    connected: input.connected,
    description: input.definition.catalogDescription,
    key: input.definition.key,
    label: input.definition.label,
    needsAttention: input.needsAttention,
    settingsPath: input.definition.settingsPath(input.orgSlug),
  };
}
