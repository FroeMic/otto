import { getDb } from "@otto/feature-integrations-runtime/db/client"
import {
  jobRuns,
  tenantIntegrationCapabilityStates,
  tenantIntegrations,
} from "@otto/feature-integrations-runtime/db/schema"
import {
  buildResolvedIntegrationAgentCapability,
  buildResolvedIntegrationCommandCapability,
  getIntegrationDefinition,
  getIntegrationManagementMode,
  isPlatformManagedIntegration,
  listIntegrationCommands,
  listWorkspaceIntegrationDefinitions,
  resolvePlatformManagedIntegrationStatus,
  type ResolvedIntegrationAgentCapability,
  type ResolvedIntegrationCommandCapability,
} from "@otto/feature-integrations-runtime/integrations/framework"
import { and, eq } from "drizzle-orm"

import {
  getRuntimeIntegrationConnectionActionForTenant,
  getRuntimeIntegrationForTenant,
  getRuntimeIntegrationSettingsForTenant,
} from "../runtime/integrations"
import {
  getOrganizationTenantForBilling,
  getOrganizationWorkspaceBySlug,
} from "../workspace/data"

type ManagedIntegrationCapabilityRow = (
  | ResolvedIntegrationAgentCapability
  | ResolvedIntegrationCommandCapability
) & {
  sourceIcon: string | null
  sourceLabel: string
  sourceType: "integration"
}

export interface WorkspaceIntegrationCatalogEntry {
  categoryLabel: string
  connected: boolean
  description: string
  iconSrc: string | null
  key: "brave" | "gandi" | "linear" | "posthog" | "slack"
  label: string
  managementMode: "platform_managed" | "workspace_managed"
  needsAttention: boolean
  settingsPath: string
}

export interface WorkspaceManagedIntegrationSummary {
  connectedAt: string | null
  disconnectedAt: string | null
  lastError: string | null
  lastErrorAt: string | null
  providerKey: "brave" | "gandi" | "linear" | "posthog" | "slack"
  status: string | null
}

function buildWorkspaceIntegrationPath(input: {
  integrationKey: string
  orgSlug: string
  section?: string
}) {
  const section = input.section ?? "status"

  return `/${input.orgSlug}/settings/agent/integrations/${input.integrationKey}/${section}`
}

export async function getAuthorizedTenantContext(input: {
  orgSlug: string
  userExternalId: string
}) {
  const workspace = await getOrganizationWorkspaceBySlug(input)
  const tenant = await getOrganizationTenantForBilling(workspace.id)

  if (!tenant) {
    throw new Error("Organization tenant not found")
  }

  return {
    organizationId: workspace.id,
    tenantId: tenant.id,
  }
}

async function getManagedIntegrationSummary(input: {
  providerKey: string
  tenantId: string
}): Promise<WorkspaceManagedIntegrationSummary | null> {
  const db = getDb()
  const [integration] = await db
    .select({
      connectedAt: tenantIntegrations.connectedAt,
      disconnectedAt: tenantIntegrations.disconnectedAt,
      lastError: tenantIntegrations.lastError,
      lastErrorAt: tenantIntegrations.lastErrorAt,
      providerKey: tenantIntegrations.providerKey,
      status: tenantIntegrations.status,
    })
    .from(tenantIntegrations)
    .where(
      and(
        eq(tenantIntegrations.tenantId, input.tenantId),
        eq(tenantIntegrations.providerKey, input.providerKey),
      ),
    )
    .limit(1)

  if (!integration) {
    return null
  }

  return {
    connectedAt: integration.connectedAt?.toISOString() ?? null,
    disconnectedAt: integration.disconnectedAt?.toISOString() ?? null,
    lastError: integration.lastError,
    lastErrorAt: integration.lastErrorAt?.toISOString() ?? null,
    providerKey: integration.providerKey as
      | "brave"
      | "gandi"
      | "linear"
      | "posthog"
      | "slack",
    status: integration.status,
  }
}

function sortManagedIntegrationCapabilityRows(
  rows: ManagedIntegrationCapabilityRow[],
) {
  return [...rows].sort((left, right) => {
    if (left.capabilityType !== right.capabilityType) {
      return left.capabilityType === "trigger" ? -1 : 1
    }

    if (left.label !== right.label) {
      return left.label.localeCompare(right.label)
    }

    return left.commandKey.localeCompare(right.commandKey)
  })
}

export async function listManagedIntegrationCapabilities(input: {
  integrationKey: string
  orgSlug: string
  tenantId: string
}) {
  const definition = getIntegrationDefinition(input.integrationKey)

  if (!definition?.runtimeSurface) {
    return []
  }

  const runtimeDefinition = definition as typeof definition & {
    runtimeSurface: NonNullable<typeof definition.runtimeSurface>
  }
  const db = getDb()
  const [integration] = await db
    .select({
      id: tenantIntegrations.id,
    })
    .from(tenantIntegrations)
    .where(
      and(
        eq(tenantIntegrations.tenantId, input.tenantId),
        eq(tenantIntegrations.providerKey, runtimeDefinition.key),
      ),
    )
    .limit(1)

  const policies = new Map<string, { policy: "allow" | "block" }>()

  if (integration) {
    const rows = await db
      .select({
        capabilityKey: tenantIntegrationCapabilityStates.capabilityKey,
        policyJson: tenantIntegrationCapabilityStates.policyJson,
      })
      .from(tenantIntegrationCapabilityStates)
      .where(
        eq(
          tenantIntegrationCapabilityStates.tenantIntegrationId,
          integration.id,
        ),
      )

    for (const row of rows) {
      if (row.policyJson?.policy === "allow" || row.policyJson?.policy === "block") {
        policies.set(row.capabilityKey, row.policyJson)
      }
    }
  }

  const runtimeIntegration = await getRuntimeIntegrationForTenant({
    integrationKey: runtimeDefinition.key,
    tenantId: input.tenantId,
  })
  const status = runtimeIntegration?.status ?? {
    connected: false,
    connectionStatus: null,
    enabled: false,
    integrationStatus: null,
    needsAttention: false,
  }

  const commandRows = listIntegrationCommands({
    definition: runtimeDefinition,
  }).map((command) => ({
    ...buildResolvedIntegrationCommandCapability({
      command,
      definition: runtimeDefinition,
      policy: policies.get(command.commandKey) ?? null,
      status,
    }),
    sourceIcon: runtimeDefinition.iconSrc,
    sourceLabel: runtimeDefinition.label,
    sourceType: "integration" as const,
  }))
  const providerCapabilityRows = runtimeDefinition.agentCapabilities
    .filter(
      (capability) =>
        !commandRows.some((row) => row.capabilityKey === capability.key),
    )
    .map((capability) => ({
      ...buildResolvedIntegrationAgentCapability({
        capability,
        definition: runtimeDefinition,
        policy: policies.get(capability.key) ?? null,
        status,
      }),
      sourceIcon: runtimeDefinition.iconSrc,
      sourceLabel: runtimeDefinition.label,
      sourceType: "integration" as const,
    }))

  return sortManagedIntegrationCapabilityRows([
    ...commandRows,
    ...providerCapabilityRows,
  ]).map((row) => ({
    capabilityKey: row.capabilityKey,
    capabilityType: row.capabilityType,
    commandGroup: row.commandGroup ?? null,
    description: row.description,
    effect: row.effect ?? null,
    label: row.label,
    policy: row.policy,
    reason: row.capabilityState.reason ?? null,
    sourceIcon: row.sourceIcon,
    sourceLabel: row.sourceLabel,
    sourceType: row.sourceType,
    status: row.capabilityState.status,
    userControllable: row.userControllable,
  }))
}

export async function listWorkspaceIntegrations(input: {
  orgSlug: string
  userExternalId: string
}) {
  const { tenantId } = await getAuthorizedTenantContext(input)
  const definitions = listWorkspaceIntegrationDefinitions()
  const runtimeIntegrations = await Promise.all(
    definitions.map((definition) =>
      getRuntimeIntegrationForTenant({
        integrationKey: definition.key,
        tenantId,
      }),
    ),
  )

  return definitions
    .map<WorkspaceIntegrationCatalogEntry | null>((definition, index) => {
      const runtimeIntegration = runtimeIntegrations[index]
      const platformStatus = isPlatformManagedIntegration(definition)
        ? resolvePlatformManagedIntegrationStatus(definition)
        : null
      const connected = runtimeIntegration?.status.connected ?? platformStatus?.connected ?? false
      const needsAttention =
        runtimeIntegration?.status.needsAttention ??
        platformStatus?.needsAttention ??
        false

      if (
        definition.key !== "brave" &&
        definition.key !== "gandi" &&
        definition.key !== "linear" &&
        definition.key !== "posthog" &&
        definition.key !== "slack"
      ) {
        return null
      }

      return {
        categoryLabel: definition.categoryLabel,
        connected,
        description: definition.catalogDescription,
        iconSrc: definition.iconSrc,
        key: definition.key,
        label: definition.label,
        managementMode: getIntegrationManagementMode(definition),
        needsAttention,
        settingsPath: buildWorkspaceIntegrationPath({
          integrationKey: definition.key,
          orgSlug: input.orgSlug,
        }),
      }
    })
    .filter((entry) => entry !== null)
    .sort((left, right) => left.label.localeCompare(right.label))
}

export async function getWorkspaceIntegrationDetail(input: {
  integrationKey: string
  orgSlug: string
  userExternalId: string
}) {
  const { tenantId } = await getAuthorizedTenantContext(input)
  const definition = getIntegrationDefinition(input.integrationKey)

  if (
    !definition ||
    !["brave", "gandi", "linear", "posthog", "slack"].includes(definition.key)
  ) {
    return null
  }

  const runtimeIntegration = await getRuntimeIntegrationForTenant({
    integrationKey: definition.key,
    tenantId,
  })

  if (!runtimeIntegration) {
    return null
  }

  const [summary, capabilities, settings, connection] = await Promise.all([
    getManagedIntegrationSummary({
      providerKey: definition.key,
      tenantId,
    }),
    listManagedIntegrationCapabilities({
      integrationKey: definition.key,
      orgSlug: input.orgSlug,
      tenantId,
    }),
    getRuntimeIntegrationSettingsForTenant({
      integrationKey: definition.key,
      tenantId,
    }),
    getRuntimeIntegrationConnectionActionForTenant({
      integrationKey: definition.key,
      tenantId,
    }),
  ])

  const availableSections = ["status"]

  if (capabilities.length > 0) {
    availableSections.push("capabilities")
  }

  if (settings) {
    availableSections.push("configuration")

    if (definition.key === "slack") {
      availableSections.push("people", "channels")
    }
  }

  return {
    availableSections,
    capabilities,
    connection: connection
      ? {
          ...connection,
          workspaceUrl: buildWorkspaceIntegrationPath({
            integrationKey: definition.key,
            orgSlug: input.orgSlug,
          }),
        }
      : {
          availableActions: [],
          connectUrl: null,
          integrationKey: definition.key as
            | "brave"
            | "gandi"
            | "linear"
            | "posthog"
            | "slack",
          label: definition.label,
          message: `${definition.label} is available.`,
          recommendedAction: "none",
          requiresUserAction: false,
          selectedAction: "none",
          status: runtimeIntegration.status,
          workspaceUrl: buildWorkspaceIntegrationPath({
            integrationKey: definition.key,
            orgSlug: input.orgSlug,
          }),
        },
    integration: {
      categoryLabel: definition.categoryLabel,
      description: definition.description,
      iconSrc: definition.iconSrc,
      key: definition.key as "brave" | "gandi" | "linear" | "posthog" | "slack",
      label: definition.label,
      managementMode: getIntegrationManagementMode(definition),
      pageDescription: definition.pageDescription,
    },
    settings: settings
      ? {
          contract: settings.contract,
          surface: settings.surface,
        }
      : null,
    summary,
  }
}

export async function getWorkspaceJobStatus(input: {
  jobId: string
  orgSlug: string
  userExternalId: string
}) {
  const { tenantId } = await getAuthorizedTenantContext(input)
  const db = getDb()
  const [job] = await db
    .select({
      error: jobRuns.error,
      finishedAt: jobRuns.finishedAt,
      status: jobRuns.status,
      tenantId: jobRuns.tenantId,
    })
    .from(jobRuns)
    .where(eq(jobRuns.id, input.jobId))
    .limit(1)

  if (!job || job.tenantId !== tenantId) {
    return null
  }

  return {
    error: job.error,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    ok: job.status === "succeeded",
    status: job.status,
  }
}
