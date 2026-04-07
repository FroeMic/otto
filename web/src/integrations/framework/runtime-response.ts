import type {
  IntegrationDefinition,
  IntegrationOverviewEntry,
  IntegrationRuntimeOperationDefinition,
  RuntimeIntegrationFunctionMatch,
  RuntimeIntegrationOperationExecutionGuide,
  RuntimeIntegrationOperationResponse,
  RuntimeIntegrationResponse,
  RuntimeIntegrationStatus,
} from "./types";

function buildExecutionGuide(input: {
  integrationKey: string;
  operation: IntegrationRuntimeOperationDefinition;
}): RuntimeIntegrationOperationExecutionGuide {
  return {
    argumentsField: "arguments",
    exampleCall: {
      arguments: input.operation.exampleArguments ?? {},
      functionKey: input.operation.key,
      integrationKey: input.integrationKey,
    },
    functionKey: input.operation.key,
    integrationKey: input.integrationKey,
    toolName: "execute_integration_function",
  };
}

function buildOperationResponse(input: {
  integrationKey: string;
  operation: IntegrationRuntimeOperationDefinition;
}): RuntimeIntegrationOperationResponse {
  return {
    description: input.operation.description,
    executionGuide: buildExecutionGuide(input),
    key: input.operation.key,
    label: input.operation.label,
    parametersSchema: input.operation.parametersSchema,
    usageNotes: input.operation.usageNotes ?? [],
  };
}

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
      ...buildOperationResponse({
        integrationKey: input.definition.key,
        operation,
      }),
    })),
    status: input.status,
    toolDescription: input.definition.runtimeTool.toolDescription,
    toolName: input.definition.runtimeTool.toolName,
    usageGuide: {
      argumentsField: "arguments",
      connectionToolName: "manage_integration_connection",
      detailToolName: "get_integration",
      discoveryToolName: "find_integration_functions",
      executeToolName: "execute_integration_function",
      recommendedWorkflow: [
        "Use find_integration_functions when you know the user's goal but not the exact integration function.",
        "Use get_integration before executing unfamiliar functions so you can inspect operations, parametersSchema, and executionGuide.",
        "If status.needsAttention is true, call manage_integration_connection before retrying.",
        "Execute functions with execute_integration_function using integrationKey, functionKey, and arguments.",
      ],
    },
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

export function buildRuntimeIntegrationFunctionMatch(input: {
  definition: IntegrationDefinition & {
    runtimeTool: NonNullable<IntegrationDefinition["runtimeTool"]>;
  };
  operation: IntegrationRuntimeOperationDefinition;
  reason: string;
  status: RuntimeIntegrationStatus;
}): RuntimeIntegrationFunctionMatch {
  return {
    connected: input.status.connected,
    exampleArguments: input.operation.exampleArguments ?? {},
    functionKey: input.operation.key,
    functionLabel: input.operation.label,
    integrationKey: input.definition.key,
    integrationLabel: input.definition.label,
    needsAttention: input.status.needsAttention,
    reason: input.reason,
  };
}
