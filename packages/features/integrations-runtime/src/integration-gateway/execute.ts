import { and, eq } from "drizzle-orm"

import { getDb } from "../db/client"
import { getTenantIntegrationCapabilityPolicy } from "../db/integration-capability-policies"
import { recordIntegrationExecutionAudit } from "../db/integration-execution-audits"
import { tenantIntegrations } from "../db/schema"
import {
  collectCommands,
  executeRegisteredIntegrationCommand,
  getIntegrationDefinition,
  resolveCommandCapabilityState,
} from "../integrations/framework"

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return "Managed integration execution failed"
}

function resolveCommandKey(input: {
  commandKey?: string
  commandPath?: string[]
}) {
  if (input.commandKey?.trim()) {
    return input.commandKey.trim()
  }

  if (Array.isArray(input.commandPath) && input.commandPath.length > 0) {
    return input.commandPath
      .map((entry) => entry.trim())
      .filter(Boolean)
      .join(".")
  }

  return "unknown"
}

async function getTenantIntegrationExecutionState(input: {
  integrationKey: string
  tenantId: string
}) {
  const db = getDb()
  const [row] = await db
    .select({
      connectedAt: tenantIntegrations.connectedAt,
      disconnectedAt: tenantIntegrations.disconnectedAt,
      id: tenantIntegrations.id,
      integrationStatus: tenantIntegrations.status,
    })
    .from(tenantIntegrations)
    .where(
      and(
        eq(tenantIntegrations.tenantId, input.tenantId),
        eq(tenantIntegrations.providerKey, input.integrationKey),
      ),
    )
    .limit(1)

  return row ?? null
}

function buildRuntimeStatus(input: {
  connectedAt: Date | null
  disconnectedAt: Date | null
  integrationStatus: string | null
}) {
  const connected = Boolean(input.connectedAt && !input.disconnectedAt)
  const integrationStatus = input.integrationStatus ?? null

  return {
    connected,
    connectionStatus: null,
    enabled: connected,
    integrationStatus,
    needsAttention:
      integrationStatus === "error" || integrationStatus === "needs_attention",
  }
}

export async function executeRuntimeIntegrationInGateway(input: {
  arguments: Record<string, unknown>
  commandKey?: string
  commandPath?: string[]
  integrationKey: string
  tenantId: string
}) {
  const integrationKey = input.integrationKey.trim().toLowerCase()
  const commandKey = resolveCommandKey({
    commandKey: input.commandKey,
    commandPath: input.commandPath,
  })

  let tenantIntegrationId: string | null = null

  try {
    const definition = getIntegrationDefinition(integrationKey)

    if (!definition?.runtimeSurface) {
      throw new Error(
        `Managed integration ${input.integrationKey} is not registered.`,
      )
    }

    const command = collectCommands(definition.runtimeSurface).find(
      (entry) => entry.commandKey === commandKey,
    )

    if (!command) {
      throw new Error(
        `${definition.key} does not support the ${commandKey || "requested"} command.`,
      )
    }

    const integrationState = await getTenantIntegrationExecutionState({
      integrationKey,
      tenantId: input.tenantId,
    })
    const tenantStatus = buildRuntimeStatus({
      connectedAt: integrationState?.connectedAt ?? null,
      disconnectedAt: integrationState?.disconnectedAt ?? null,
      integrationStatus: integrationState?.integrationStatus ?? null,
    })

    const policy = integrationState?.id
      ? await getTenantIntegrationCapabilityPolicy({
          capabilityKey: command.commandKey,
          tenantIntegrationId: integrationState.id,
        })
      : null
    const capabilityState = resolveCommandCapabilityState({
      command,
      policy,
      status: tenantStatus,
    })

    if (capabilityState.status === "disabled") {
      throw new Error(
        `Capability ${integrationKey}.${command.commandKey} is disabled. ${capabilityState.reason ?? ""}`.trim(),
      )
    }

    if (capabilityState.status === "needs_attention") {
      throw new Error(
        `Capability ${integrationKey}.${command.commandKey} needs attention. ${capabilityState.reason ?? ""}`.trim(),
      )
    }

    if (definition.oauth || definition.auth?.kind === "api_key") {
      if (!integrationState?.id) {
        throw new Error(
          `${definition.label} is not connected in this workspace.`,
        )
      }

      tenantIntegrationId = integrationState.id
    }

    const result = await executeRegisteredIntegrationCommand({
      arguments: input.arguments,
      commandKey: input.commandKey,
      commandPath: input.commandPath,
      integrationKey,
      tenantIntegrationId,
    })

    await recordIntegrationExecutionAudit({
      commandKey,
      integrationKey,
      request: {
        arguments: input.arguments,
        ...(input.commandKey ? { commandKey: input.commandKey } : {}),
        ...(input.commandPath ? { commandPath: input.commandPath } : {}),
      },
      response: result,
      status: "succeeded",
      tenantId: input.tenantId,
      tenantIntegrationId,
    })

    return result
  } catch (error) {
    await recordIntegrationExecutionAudit({
      commandKey,
      errorMessage: getErrorMessage(error),
      integrationKey,
      request: {
        arguments: input.arguments,
        ...(input.commandKey ? { commandKey: input.commandKey } : {}),
        ...(input.commandPath ? { commandPath: input.commandPath } : {}),
      },
      status: "failed",
      tenantId: input.tenantId,
      tenantIntegrationId,
    })

    throw error
  }
}
