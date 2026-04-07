import type {
  IntegrationDefinition,
  IntegrationOverviewEntry,
  IntegrationRuntimeCommandDefinition,
  IntegrationRuntimeCommandGroupDefinition,
  RuntimeIntegrationCommandDetails,
  RuntimeIntegrationCommandGroupDetails,
  RuntimeIntegrationCommandGroupSummary,
  RuntimeIntegrationCommandMatch,
  RuntimeIntegrationCommandSummary,
  RuntimeIntegrationDetailsResponse,
  RuntimeIntegrationStatus,
  RuntimeIntegrationSummaryResponse,
} from "./types";

function buildCommandSummary(
  command: IntegrationRuntimeCommandDefinition,
): RuntimeIntegrationCommandSummary {
  return {
    commandKey: command.commandKey,
    commandPath: [...command.commandPath],
    label: command.label,
  };
}

function countCommandsInGroup(
  group: IntegrationRuntimeCommandGroupDefinition,
): number {
  return (
    (group.commands?.length ?? 0) +
    (group.childGroups?.reduce(
      (total, childGroup) => total + countCommandsInGroup(childGroup),
      0,
    ) ?? 0)
  );
}

function buildCommandGroupSummary(
  group: IntegrationRuntimeCommandGroupDefinition,
): RuntimeIntegrationCommandGroupSummary {
  return {
    commandCount: countCommandsInGroup(group),
    groupKey: group.groupKey,
    groupPath: [...group.groupPath],
    label: group.label,
  };
}

function buildUsageGuide() {
  return {
    connectionToolName: "manage_integration" as const,
    detailToolName: "get_integration_details" as const,
    discoveryToolName: "find_integration_commands" as const,
    executeToolName: "execute_integration_command" as const,
    inventoryToolName: "list_integrations" as const,
    recommendedWorkflow: [
      "Use find_integration_commands when you know the user's goal but not the exact integration or command.",
      "Use list_integrations when you need a deterministic workspace inventory instead of semantic discovery.",
      "Use get_integration to inspect top-level command groups and root commands without loading full command schemas.",
      "Use get_integration_details to read one command group or one command in detail before execution.",
      "If status.needsAttention is true, call manage_integration before retrying.",
      "Execute commands with execute_integration_command using integrationKey plus commandKey or commandPath.",
    ],
  };
}

export function buildRuntimeIntegrationSummaryResponse(input: {
  available?: boolean;
  definition: IntegrationDefinition & {
    runtimeSurface: NonNullable<IntegrationDefinition["runtimeSurface"]>;
  };
  installed?: boolean;
  status: RuntimeIntegrationStatus;
}): RuntimeIntegrationSummaryResponse {
  return {
    available: input.available ?? true,
    commandGroups: input.definition.runtimeSurface.commandGroups.map(
      buildCommandGroupSummary,
    ),
    description: input.definition.description,
    installed: input.installed ?? input.status.connected,
    key: input.definition.key,
    label: input.definition.label,
    rootCommands:
      input.definition.runtimeSurface.rootCommands.map(buildCommandSummary),
    status: input.status,
    toolDescription: input.definition.runtimeSurface.toolDescription,
    toolName: input.definition.runtimeSurface.toolName,
    usageGuide: buildUsageGuide(),
  };
}

function buildCommandDetails(input: {
  command: IntegrationRuntimeCommandDefinition;
  integrationKey: string;
}): RuntimeIntegrationCommandDetails {
  return {
    argumentsSchema: input.command.argumentsSchema,
    commandKey: input.command.commandKey,
    commandPath: [...input.command.commandPath],
    description: input.command.description,
    exampleArguments: input.command.exampleArguments ?? {},
    exampleCall: {
      arguments: input.command.exampleArguments ?? {},
      commandKey: input.command.commandKey,
      integrationKey: input.integrationKey,
    },
    inputMode: input.command.inputMode,
    label: input.command.label,
    resultMode: input.command.resultMode,
    usageNotes: input.command.usageNotes ?? [],
  };
}

function buildCommandGroupDetails(
  group: IntegrationRuntimeCommandGroupDefinition,
): RuntimeIntegrationCommandGroupDetails {
  return {
    childGroups: (group.childGroups ?? []).map(buildCommandGroupSummary),
    commands: (group.commands ?? []).map(buildCommandSummary),
    description: group.description,
    groupKey: group.groupKey,
    groupPath: [...group.groupPath],
    label: group.label,
  };
}

export function buildRuntimeIntegrationDetailsResponse(input: {
  definition: IntegrationDefinition & {
    runtimeSurface: NonNullable<IntegrationDefinition["runtimeSurface"]>;
  };
  detailType: "command" | "command_group";
  detail:
    | IntegrationRuntimeCommandDefinition
    | IntegrationRuntimeCommandGroupDefinition;
  status: RuntimeIntegrationStatus;
}): RuntimeIntegrationDetailsResponse {
  return {
    ...(input.detailType === "command"
      ? {
          command: buildCommandDetails({
            command: input.detail as IntegrationRuntimeCommandDefinition,
            integrationKey: input.definition.key,
          }),
        }
      : {
          group: buildCommandGroupDetails(
            input.detail as IntegrationRuntimeCommandGroupDefinition,
          ),
        }),
    detailType: input.detailType,
    integration: {
      description: input.definition.description,
      key: input.definition.key,
      label: input.definition.label,
      status: input.status,
      usageGuide: buildUsageGuide(),
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

export function buildRuntimeIntegrationCommandMatch(input: {
  command: IntegrationRuntimeCommandDefinition;
  definition: IntegrationDefinition & {
    runtimeSurface: NonNullable<IntegrationDefinition["runtimeSurface"]>;
  };
  reason: string;
  status: RuntimeIntegrationStatus;
}): RuntimeIntegrationCommandMatch {
  return {
    commandGroupPath: input.command.commandPath.slice(0, -1),
    commandKey: input.command.commandKey,
    commandLabel: input.command.label,
    connected: input.status.connected,
    exampleArguments: input.command.exampleArguments ?? {},
    integrationKey: input.definition.key,
    integrationLabel: input.definition.label,
    needsAttention: input.status.needsAttention,
    reason: input.reason,
  };
}
