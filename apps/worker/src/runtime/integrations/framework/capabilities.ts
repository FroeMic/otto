import type { AgentCapability } from "../../lib/agent-capabilities"
import type {
  IntegrationCapabilityPolicy,
  IntegrationCommandEffect,
  IntegrationDefinition,
  IntegrationRuntimeCommandDefinition,
  IntegrationRuntimeCommandGroupDefinition,
  RuntimeCapabilityState,
  RuntimeIntegrationStatus,
} from "./types"

const READ_COMMAND_VERBS = new Set(["get", "list", "list_for_url", "search"])

const WRITE_COMMAND_VERBS = new Set([
  "add",
  "archive",
  "batch_update",
  "cancel",
  "create",
  "create_from_uploaded_file",
  "create_update",
  "delete",
  "insert_inline_image",
  "invite",
  "members_add",
  "members_remove",
  "members_update",
  "remove",
  "remove_label",
  "request_upload_url",
  "resend",
  "restore",
  "retire",
  "unarchive",
  "update",
  "upload_file",
  "upload_inline_image",
])

function getCommandVerb(command: IntegrationRuntimeCommandDefinition) {
  const pathVerb = command.commandPath.at(-1)?.trim().toLowerCase()

  if (pathVerb) {
    return pathVerb
  }

  return command.commandKey.split(".").at(-1)?.trim().toLowerCase() ?? ""
}

export function getCommandEffect(
  command: IntegrationRuntimeCommandDefinition,
): IntegrationCommandEffect {
  if (command.effect) {
    return command.effect
  }

  const verb = getCommandVerb(command)

  if (READ_COMMAND_VERBS.has(verb)) {
    return "read"
  }

  if (WRITE_COMMAND_VERBS.has(verb)) {
    return "write"
  }

  return "write"
}

export function getCommandPolicy(input: {
  policy: IntegrationCapabilityPolicy | null
}) {
  return input.policy ?? null
}

export function isCommandUserControllable(
  command: IntegrationRuntimeCommandDefinition,
) {
  if (typeof command.userControllable === "boolean") {
    return command.userControllable
  }

  if (command.agentAvailability?.available === false) {
    return false
  }

  return true
}

export function resolveCommandCapabilityState(input: {
  command: IntegrationRuntimeCommandDefinition
  policy: IntegrationCapabilityPolicy | null
  status: RuntimeIntegrationStatus
}): RuntimeCapabilityState {
  if (input.status.needsAttention || !input.status.connected) {
    return {
      reason: "Integration disconnected.",
      status: "needs_attention",
    }
  }

  if (input.command.agentAvailability?.available === false) {
    return {
      reason: input.command.agentAvailability.reason,
      status: "disabled",
    }
  }

  if (input.policy?.policy === "block") {
    return {
      reason: "Disabled by workspace policy.",
      status: "disabled",
    }
  }

  return {
    status: "enabled",
  }
}

export type ResolvedIntegrationCommandCapability = {
  capabilityKey: string
  capabilityState: RuntimeCapabilityState
  capabilityType: "command"
  commandKey: string
  commandGroup: string | null
  commandPath: string[]
  description: string
  effect: IntegrationCommandEffect
  integrationKey: string
  integrationLabel: string
  label: string
  policy: IntegrationCapabilityPolicy | null
  userControllable: boolean
}

export type ResolvedIntegrationAgentCapability = {
  capabilityKey: string
  capabilityState: RuntimeCapabilityState
  capabilityType: "command" | "trigger"
  commandKey: string
  commandGroup: string | null
  commandPath: string[]
  description: string
  effect: IntegrationCommandEffect | null
  integrationKey: string
  integrationLabel: string
  label: string
  policy: IntegrationCapabilityPolicy | null
  userControllable: boolean
}

function collectCommandsFromGroup(
  group: IntegrationRuntimeCommandGroupDefinition,
): IntegrationRuntimeCommandDefinition[] {
  return [
    ...(group.commands ?? []),
    ...((group.childGroups ?? []).flatMap(collectCommandsFromGroup) ?? []),
  ]
}

export function listIntegrationCommands(input: {
  definition: IntegrationDefinition & {
    runtimeSurface: NonNullable<IntegrationDefinition["runtimeSurface"]>
  }
}) {
  return [
    ...input.definition.runtimeSurface.rootCommands,
    ...input.definition.runtimeSurface.commandGroups.flatMap(
      collectCommandsFromGroup,
    ),
  ]
}

function getAgentCapabilityEffect(
  capability: AgentCapability,
): IntegrationCommandEffect | null {
  if (capability.direction === "trigger") {
    return null
  }

  return capability.direction === "read" ? "read" : "write"
}

export function isAgentCapabilityUserControllable(capability: AgentCapability) {
  return capability.userControllable ?? true
}

export function resolveAgentCapabilityState(input: {
  capability: AgentCapability
  policy: IntegrationCapabilityPolicy | null
  status: RuntimeIntegrationStatus
}): RuntimeCapabilityState {
  if (input.status.needsAttention || !input.status.connected) {
    return {
      reason: "Integration disconnected.",
      status: "needs_attention",
    }
  }

  if (input.policy?.policy === "block") {
    return {
      reason: "Disabled by workspace policy.",
      status: "disabled",
    }
  }

  return {
    status: "enabled",
  }
}

export function buildResolvedIntegrationCommandCapability(input: {
  command: IntegrationRuntimeCommandDefinition
  definition: IntegrationDefinition & {
    runtimeSurface: NonNullable<IntegrationDefinition["runtimeSurface"]>
  }
  policy: IntegrationCapabilityPolicy | null
  status: RuntimeIntegrationStatus
}): ResolvedIntegrationCommandCapability {
  return {
    capabilityKey: input.command.commandKey,
    capabilityState: resolveCommandCapabilityState({
      command: input.command,
      policy: input.policy,
      status: input.status,
    }),
    capabilityType: "command",
    commandKey: input.command.commandKey,
    commandGroup: input.command.commandPath.at(0)?.trim() || null,
    commandPath: [...input.command.commandPath],
    description: input.command.description,
    effect: getCommandEffect(input.command),
    integrationKey: input.definition.key,
    integrationLabel: input.definition.label,
    label: input.command.label,
    policy: getCommandPolicy({
      policy: input.policy,
    }),
    userControllable: isCommandUserControllable(input.command),
  }
}

export function buildResolvedIntegrationAgentCapability(input: {
  capability: AgentCapability
  definition: Pick<IntegrationDefinition, "key" | "label">
  policy: IntegrationCapabilityPolicy | null
  status: RuntimeIntegrationStatus
}): ResolvedIntegrationAgentCapability {
  return {
    capabilityKey: input.capability.key,
    capabilityState: resolveAgentCapabilityState({
      capability: input.capability,
      policy: input.policy,
      status: input.status,
    }),
    capabilityType:
      input.capability.direction === "trigger" ? "trigger" : "command",
    commandKey: input.capability.key,
    commandGroup: null,
    commandPath: [input.capability.direction, input.capability.key],
    description: input.capability.description,
    effect: getAgentCapabilityEffect(input.capability),
    integrationKey: input.definition.key,
    integrationLabel: input.definition.label,
    label: input.capability.label,
    policy: getCommandPolicy({
      policy: input.policy,
    }),
    userControllable: isAgentCapabilityUserControllable(input.capability),
  }
}
