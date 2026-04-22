import {
  getConnectedOauthAccessForTenantIntegration,
  recordOauthConnectionAttention,
} from "../../db/oauth"

import { getIntegrationDefinition } from "./registry"
import { collectCommands } from "./search"
import { validateCommandArguments } from "./validation"

function getUnknownErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return "The provider request failed."
}

function getCommandKey(input: {
  commandKey?: string | null
  commandPath?: string[] | null
}) {
  const commandKey = input.commandKey?.trim()

  if (commandKey) {
    return commandKey
  }

  if (Array.isArray(input.commandPath) && input.commandPath.length > 0) {
    const parts = input.commandPath
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean)

    if (parts.length > 0) {
      return parts.join(".")
    }
  }

  return ""
}

export async function executeRegisteredIntegrationCommand(input: {
  arguments: Record<string, unknown>
  commandKey?: string | null
  commandPath?: string[] | null
  integrationKey: string
  tenantIntegrationId: string | null
}) {
  const integration = getIntegrationDefinition(input.integrationKey)
  const commandKey = getCommandKey({
    commandKey: input.commandKey,
    commandPath: input.commandPath,
  })

  if (!integration?.runtimeSurface) {
    throw new Error(`Unsupported managed integration: ${input.integrationKey}`)
  }

  const command = collectCommands(integration.runtimeSurface).find(
    (entry) => entry.commandKey === commandKey,
  )

  if (!command) {
    throw new Error(
      `${integration.key} does not support the ${commandKey || "requested"} command.`,
    )
  }

  validateCommandArguments(command, input.arguments)

  const validatedArguments = command.validate
    ? command.validate(input.arguments)
    : input.arguments

  let auth = null

  if (integration.oauth) {
    if (!input.tenantIntegrationId) {
      throw new Error(
        `${integration.label} is not connected in this workspace.`,
      )
    }

    auth = await getConnectedOauthAccessForTenantIntegration({
      providerKey: integration.oauth.provider.key,
      tenantIntegrationId: input.tenantIntegrationId,
    })

    if (!auth || auth.status !== "connected") {
      throw new Error(
        `${integration.label} needs attention. Reconnect ${integration.label} in your workspace.`,
      )
    }
  }

  try {
    return await command.execute({
      arguments: validatedArguments,
      context: {
        auth,
        tenantIntegrationId: input.tenantIntegrationId,
      },
    })
  } catch (error) {
    if (!integration.oauth || !auth) {
      throw error
    }

    const errorMessage = getUnknownErrorMessage(error)
    const classifiedKind = integration.oauth.provider.classifyError(error)

    if (classifiedKind === "reauthorize") {
      console.warn(
        `[runtime-integrations] ${integration.key} request needs reauthorize tenantIntegration=${input.tenantIntegrationId ?? "missing"} command=${commandKey || "unknown"} error=${errorMessage}`,
      )
      await recordOauthConnectionAttention({
        connectionId: auth.connectionId,
        errorMessage,
        eventType: "request_failed_reauthorize",
        providerKey: integration.oauth.provider.key,
        tenantIntegrationId: auth.tenantIntegrationId,
      })

      throw new Error(
        `${integration.label} needs attention. Reconnect ${integration.label} in your workspace.`,
      )
    }

    console.error(
      `[runtime-integrations] ${integration.key} request failed tenantIntegration=${input.tenantIntegrationId ?? "missing"} command=${commandKey || "unknown"} kind=${classifiedKind} error=${errorMessage}`,
    )
    throw error
  }
}
