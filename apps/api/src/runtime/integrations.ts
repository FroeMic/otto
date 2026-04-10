import { getDb } from "@otto/feature-integrations-runtime/db/client"
import {
  organizations,
  tenantIntegrationCapabilityStates,
  tenantIntegrations,
  tenants,
} from "@otto/feature-integrations-runtime/db/schema"
import {
  buildRuntimeIntegrationDetailsResponse,
  buildRuntimeIntegrationSettingsContract,
  buildRuntimeIntegrationSummaryResponse,
  findIntegrationCommandMatches,
  getIntegrationDefinition,
  type IntegrationDefinition,
  type IntegrationRuntimeCommandDefinition,
  type IntegrationRuntimeCommandGroupDefinition,
  isPlatformManagedIntegration,
  listRuntimeIntegrationDefinitions,
  listSupportedRuntimeIntegrationKeys,
  type RuntimeIntegrationDetailsResponse,
  type RuntimeIntegrationSettingsSummary,
  resolveRuntimeIntegrationStatus,
} from "@otto/feature-integrations-runtime/integrations/framework"
import { braveFieldMeanings } from "@otto/feature-integrations-runtime/integrations/library/brave/settings-metadata"
import { getControlPlaneBaseUrl } from "@otto/feature-integrations-runtime/lib/env"
import {
  parseWebSearchRuntimeConfig,
  resolveRuntimeWebSearchConfig,
  WEB_SEARCH_CONFIG_SCHEMA_VERSION,
  webSearchRuntimeConfigJsonSchema,
  webSearchRuntimeConfigUiHints,
} from "@otto/feature-integrations-runtime/lib/web-search-config"
import { and, eq } from "drizzle-orm"

type RuntimeStatusRow = {
  connectedAt: Date | null
  disconnectedAt: Date | null
  integrationStatus: string | null
  providerKey: string
  tenantIntegrationId: string
}

function buildDefinitionsWithStatus(input: {
  definitions: ReturnType<typeof listRuntimeIntegrationDefinitions>
  rows: RuntimeStatusRow[]
}) {
  const statusByProviderKey = new Map<string, RuntimeStatusRow>()

  for (const row of input.rows) {
    statusByProviderKey.set(row.providerKey, row)
  }

  return input.definitions.map((definition) => {
    const row = statusByProviderKey.get(definition.key) ?? null
    const resolved = resolveRuntimeIntegrationStatus({
      definition,
      row: row
        ? {
            connectedAt: row.connectedAt,
            connectionStatus: null,
            disconnectedAt: row.disconnectedAt,
            integrationStatus: row.integrationStatus,
            tenantIntegrationId: row.tenantIntegrationId,
          }
        : null,
    })

    return {
      definition,
      installed: resolved.installed,
      status: resolved.status,
      tenantIntegrationId: resolved.tenantIntegrationId,
    }
  })
}

async function listRuntimeIntegrationStatusRowsForTenantBySupportedKeys(
  tenantId: string,
) {
  const db = getDb()
  const supportedKeys = new Set(listSupportedRuntimeIntegrationKeys())

  const rows = await db
    .select({
      connectedAt: tenantIntegrations.connectedAt,
      disconnectedAt: tenantIntegrations.disconnectedAt,
      integrationStatus: tenantIntegrations.status,
      providerKey: tenantIntegrations.providerKey,
      tenantIntegrationId: tenantIntegrations.id,
    })
    .from(tenantIntegrations)
    .where(eq(tenantIntegrations.tenantId, tenantId))

  return rows.filter((row) => supportedKeys.has(row.providerKey))
}

function buildSettingsSummary(input: {
  key: string
  settings: NonNullable<IntegrationDefinition["settings"]>
}): RuntimeIntegrationSettingsSummary {
  return {
    description: input.settings.description,
    examples:
      input.settings.examples?.map(
        (example: NonNullable<typeof input.settings.examples>[number]) => ({
          call: {
            action: example.action,
            expectedEntryVersion: example.expectedEntryVersion,
            integrationKey: input.key,
            patch: example.patch,
            summary: example.summary,
          },
          description: example.description,
        }),
      ) ?? [],
    label: input.settings.label,
    recommendedWorkflow: input.settings.recommendedWorkflow ?? [],
    toolName: "configure_integration",
  }
}

function findRuntimeCommandByKey(
  surface: NonNullable<
    ReturnType<
      typeof listRuntimeIntegrationDefinitions
    >[number]["runtimeSurface"]
  >,
  commandKey: string,
): IntegrationRuntimeCommandDefinition | null {
  const normalizedKey = commandKey.trim().toLowerCase()

  for (const command of surface.rootCommands) {
    if (command.commandKey.toLowerCase() === normalizedKey) {
      return command
    }
  }

  for (const group of surface.commandGroups) {
    const command = findRuntimeCommandByKeyInGroup(group, normalizedKey)

    if (command) {
      return command
    }
  }

  return null
}

function findRuntimeCommandByKeyInGroup(
  group: IntegrationRuntimeCommandGroupDefinition,
  normalizedCommandKey: string,
): IntegrationRuntimeCommandDefinition | null {
  for (const command of group.commands ?? []) {
    if (command.commandKey.toLowerCase() === normalizedCommandKey) {
      return command
    }
  }

  for (const childGroup of group.childGroups ?? []) {
    const command = findRuntimeCommandByKeyInGroup(
      childGroup,
      normalizedCommandKey,
    )

    if (command) {
      return command
    }
  }

  return null
}

function findRuntimeCommandGroupByKey(
  surface: NonNullable<
    ReturnType<
      typeof listRuntimeIntegrationDefinitions
    >[number]["runtimeSurface"]
  >,
  groupKey: string,
): IntegrationRuntimeCommandGroupDefinition | null {
  const normalizedKey = groupKey.trim().toLowerCase()

  for (const group of surface.commandGroups) {
    const matchedGroup = findRuntimeCommandGroupByKeyInGroup(
      group,
      normalizedKey,
    )

    if (matchedGroup) {
      return matchedGroup
    }
  }

  return null
}

function findRuntimeCommandGroupByKeyInGroup(
  group: IntegrationRuntimeCommandGroupDefinition,
  normalizedGroupKey: string,
): IntegrationRuntimeCommandGroupDefinition | null {
  if (group.groupKey.toLowerCase() === normalizedGroupKey) {
    return group
  }

  if (group.groupPath.join(".").toLowerCase() === normalizedGroupKey) {
    return group
  }

  for (const childGroup of group.childGroups ?? []) {
    const matchedGroup = findRuntimeCommandGroupByKeyInGroup(
      childGroup,
      normalizedGroupKey,
    )

    if (matchedGroup) {
      return matchedGroup
    }
  }

  return null
}

export async function listRuntimeIntegrationsForTenant(input: {
  scope: "all" | "available" | "installed"
  tenantId: string
}) {
  const rows = await listRuntimeIntegrationStatusRowsForTenantBySupportedKeys(
    input.tenantId,
  )
  const installedKeys = rows.map((row) => row.providerKey).sort()
  const definitions =
    input.scope === "available" || input.scope === "all"
      ? listRuntimeIntegrationDefinitions()
      : listRuntimeIntegrationDefinitions().filter(
          (definition) =>
            installedKeys.includes(definition.key) ||
            isPlatformManagedIntegration(definition),
        )

  return buildDefinitionsWithStatus({
    definitions,
    rows,
  }).map(({ definition, installed, status }) =>
    buildRuntimeIntegrationSummaryResponse({
      definition,
      installed,
      status,
    }),
  )
}

export async function getRuntimeIntegrationForTenant(input: {
  integrationKey: string
  tenantId: string
}) {
  const integrationKey = input.integrationKey.trim().toLowerCase()
  const [integration] = (
    await listRuntimeIntegrationsForTenant({
      scope: "all",
      tenantId: input.tenantId,
    })
  ).filter((entry) => entry.key === integrationKey)

  return integration ?? null
}

export async function findRuntimeIntegrationCommandsForTenant(input: {
  query: string
  tenantId: string
}) {
  const normalizedQuery = input.query.trim()

  if (!normalizedQuery) {
    return {
      matches: [],
      query: normalizedQuery,
    }
  }

  const rows = await listRuntimeIntegrationStatusRowsForTenantBySupportedKeys(
    input.tenantId,
  )
  const definitionsWithStatus = buildDefinitionsWithStatus({
    definitions: listRuntimeIntegrationDefinitions(),
    rows,
  })

  return {
    matches: findIntegrationCommandMatches({
      definitions: definitionsWithStatus.map(({ definition, status }) => ({
        ...definition,
        status,
      })),
      query: normalizedQuery,
    }),
    query: normalizedQuery,
  }
}

export async function getRuntimeIntegrationDetailsForTenant(input: {
  detailKey: string
  detailType: "command" | "command_group"
  integrationKey: string
  tenantId: string
}): Promise<RuntimeIntegrationDetailsResponse | null> {
  const integrationKey = input.integrationKey.trim().toLowerCase()
  const definition = listRuntimeIntegrationDefinitions().find(
    (entry) => entry.key === integrationKey,
  )

  if (!definition) {
    return null
  }

  const rows = await listRuntimeIntegrationStatusRowsForTenantBySupportedKeys(
    input.tenantId,
  )
  const [{ status, tenantIntegrationId }] = buildDefinitionsWithStatus({
    definitions: [definition],
    rows,
  })
  const detail =
    input.detailType === "command"
      ? findRuntimeCommandByKey(definition.runtimeSurface, input.detailKey)
      : findRuntimeCommandGroupByKey(definition.runtimeSurface, input.detailKey)

  if (!detail) {
    return null
  }

  let policy = null
  if (input.detailType === "command" && tenantIntegrationId) {
    const db = getDb()
    const [row] = await db
      .select({
        policyJson: tenantIntegrationCapabilityStates.policyJson,
      })
      .from(tenantIntegrationCapabilityStates)
      .where(
        and(
          eq(
            tenantIntegrationCapabilityStates.tenantIntegrationId,
            tenantIntegrationId,
          ),
          eq(
            tenantIntegrationCapabilityStates.capabilityKey,
            (detail as IntegrationRuntimeCommandDefinition).commandKey,
          ),
        ),
      )
      .limit(1)
    policy = row?.policyJson ?? null
  }

  return buildRuntimeIntegrationDetailsResponse({
    definition,
    detail,
    detailType: input.detailType,
    policy,
    status,
  })
}

export async function getRuntimeIntegrationConnectionActionForTenant(input: {
  action?: string | null
  integrationKey: string
  tenantId: string
}) {
  const integration = await getRuntimeIntegrationForTenant({
    integrationKey: input.integrationKey,
    tenantId: input.tenantId,
  })

  if (!integration) {
    return null
  }

  const db = getDb()
  const [tenantContext] = await db
    .select({
      organizationSlug: organizations.slug,
    })
    .from(tenants)
    .innerJoin(organizations, eq(organizations.id, tenants.organizationId))
    .where(eq(tenants.id, input.tenantId))
    .limit(1)

  if (!tenantContext) {
    throw new Error(`Tenant ${input.tenantId} is not available.`)
  }

  const baseUrl = getControlPlaneBaseUrl()
  const definition = getIntegrationDefinition(integration.key)
  const workspaceUrl =
    baseUrl && definition
      ? `${baseUrl}${definition.settingsPath(tenantContext.organizationSlug)}`
      : null

  let connectUrl: string | null = null
  let recommendedAction = "none"
  let message = `${integration.label} is available.`

  switch (integration.key) {
    case "brave":
      recommendedAction = "open_workspace"
      message =
        "Brave web search is platform-managed by Otto. Open the workspace integration page to inspect its status and projected defaults."
      break
    case "linear":
      connectUrl = baseUrl
        ? `${baseUrl}/oauth/start/integration/linear?orgSlug=${encodeURIComponent(tenantContext.organizationSlug)}`
        : null
      recommendedAction = integration.status.connected
        ? "open_workspace"
        : "connect"
      message = integration.status.connected
        ? "Linear is already connected. Open the workspace integration page if the user wants to review or reconnect it."
        : "Linear is not connected yet. Ask the user to connect it in the workspace."
      break
    case "slack":
      connectUrl = baseUrl
        ? `${baseUrl}/oauth/start/integration/slack?orgSlug=${encodeURIComponent(tenantContext.organizationSlug)}`
        : null
      recommendedAction = integration.status.connected
        ? "open_workspace"
        : "connect"
      message = integration.status.connected
        ? "Slack is connected. Open the workspace integration page to review, reconnect, or disconnect it."
        : "Slack is not connected yet. Ask the user to connect it in the workspace."
      break
  }

  const availableActions = [
    workspaceUrl ? "open_workspace" : null,
    connectUrl ? "connect" : null,
    connectUrl ? "reconnect" : null,
  ].filter((entry): entry is string => Boolean(entry))
  const requestedAction = (input.action ?? "").trim().toLowerCase()
  const selectedAction =
    requestedAction && availableActions.includes(requestedAction)
      ? requestedAction
      : recommendedAction

  return {
    availableActions,
    connectUrl,
    integrationKey: integration.key,
    label: integration.label,
    message,
    recommendedAction,
    requiresUserAction:
      selectedAction === "connect" || selectedAction === "reconnect",
    selectedAction,
    status: integration.status,
    workspaceUrl,
  }
}

export async function getRuntimeIntegrationSettingsForTenant(input: {
  integrationKey: string
  tenantId: string
}) {
  const integration = await getRuntimeIntegrationForTenant(input)

  if (!integration?.settings || integration.key !== "brave") {
    return null
  }

  const definition = getIntegrationDefinition("brave")

  if (!definition?.settings) {
    return null
  }

  const settingsDefinition = definition as IntegrationDefinition & {
    settings: NonNullable<IntegrationDefinition["settings"]>
  }

  const resolved = resolveRuntimeWebSearchConfig()
  const config = {
    ...parseWebSearchRuntimeConfig(resolved.surfaceConfig),
    enabled: true,
    entryVersion: 1,
    installState: "installed",
    schemaVersion: WEB_SEARCH_CONFIG_SCHEMA_VERSION,
  }

  return {
    contract: buildRuntimeIntegrationSettingsContract({
      config: config as Record<string, unknown>,
      fieldMeanings: [...braveFieldMeanings],
      patchSchema: webSearchRuntimeConfigJsonSchema,
      settingsExamples:
        settingsDefinition.settings.examples?.map((example) => ({
          call: {
            action: example.action,
            expectedEntryVersion: example.expectedEntryVersion,
            integrationKey: settingsDefinition.key,
            patch: example.patch,
            summary: example.summary,
          },
          description: example.description,
        })) ?? [],
      settingsLabel: settingsDefinition.settings.label,
      uiFields:
        (webSearchRuntimeConfigUiHints.fields as Record<string, unknown>) ?? {},
      workflow: settingsDefinition.settings.recommendedWorkflow ?? [],
    }),
    integration: {
      key: integration.key,
      label: integration.label,
      settings: buildSettingsSummary(settingsDefinition),
      status: integration.status,
    },
    surface: {
      actionMeanings: [],
      agentOperations: [],
      allowedActions: [],
      availability: resolved.enabled ? "available" : "blocked",
      blockingReason: resolved.reason,
      canAgentEdit: false,
      canUserEdit: false,
      config,
      description: definition.pageDescription,
      fieldMeanings: [...braveFieldMeanings],
      id: "brave",
      key: "brave",
      kind: "integration",
      label: definition.label,
      schema: webSearchRuntimeConfigJsonSchema,
      settingsUrl: null,
      surfaceType: "integration",
      uiGroup: "integrations",
      uiHints: webSearchRuntimeConfigUiHints,
    },
  }
}
