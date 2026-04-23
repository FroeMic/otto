import {
  getConnectedApiCredentialForTenantIntegration,
  upsertApiCredentialForTenantIntegration,
  upsertTenantIntegrationState,
} from "@otto/feature-integrations-runtime/db/api-credentials"
import { getDb } from "@otto/feature-integrations-runtime/db/client"
import { upsertTenantIntegrationCapabilityPolicy } from "@otto/feature-integrations-runtime/db/integration-capability-policies"
import {
  appendIntegrationOauthEventTx,
  getConnectedOauthAccessForTenantIntegration,
} from "@otto/feature-integrations-runtime/db/oauth"
import {
  integrationApiCredentials,
  integrationOauthConnections,
  integrationOauthCredentials,
  tenantApplyRuns,
  tenantDesiredStates,
  tenantIntegrations,
  tenantServers,
  tenants,
} from "@otto/feature-integrations-runtime/db/schema"
import {
  getIntegrationDefinition,
  isAgentCapabilityUserControllable,
  isCommandUserControllable,
  listIntegrationCommands,
} from "@otto/feature-integrations-runtime/integrations/framework"
import { normalizePostHogHost } from "@otto/feature-integrations-runtime/integrations/library/posthog/client"
import {
  buildPostHogSetupState,
  discoverPostHogIntegrationSetup,
  normalizePostHogSetupResources,
} from "@otto/feature-integrations-runtime/integrations/library/posthog/setup"
import { and, desc, eq } from "drizzle-orm"

import { enqueueJob } from "../jobs/queue"
import { JOB_TYPES } from "../jobs/types"
import {
  applyRuntimeIntegrationSettingsForTenant,
  getRuntimeIntegrationForTenant,
  getRuntimeIntegrationSettingsForTenant,
} from "../runtime/integrations"
import {
  getAuthorizedTenantContext,
  listManagedIntegrationCapabilities,
} from "./data"
import { joinSlackChannel, leaveSlackChannel } from "./providers/slack"

type MutableSlackSurface = {
  availableChannels?: Array<Record<string, unknown>>
} & Record<string, unknown>

function recordFromUnknown(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...value } as Record<string, unknown>
  }

  return {}
}

function getWorkspaceIntegrationLabel(providerKey: string) {
  switch (providerKey) {
    case "github":
      return "GitHub"
    case "linear":
      return "Linear"
    case "posthog":
      return "PostHog"
    case "slack":
      return "Slack"
    default:
      return "Gandi"
  }
}

export function buildDisconnectedDesiredStateConfig(input: {
  configJson: unknown
  providerKey: string
}) {
  const currentConfig = recordFromUnknown(input.configJson)
  const integrations = Array.isArray(currentConfig.integrations)
    ? currentConfig.integrations.filter(
        (entry): entry is string =>
          typeof entry === "string" && entry !== input.providerKey,
      )
    : []
  const nextConfig: Record<string, unknown> = {
    ...currentConfig,
    integrations,
  }

  if (input.providerKey === "slack") {
    delete nextConfig.slack
  }

  return nextConfig
}

async function getTenantRuntimeState(tenantId: string) {
  const db = getDb()
  const [tenantRow] = await db
    .select({
      serverStatus: tenantServers.status,
      tenantId: tenants.id,
      tenantStatus: tenants.status,
    })
    .from(tenants)
    .leftJoin(tenantServers, eq(tenantServers.tenantId, tenants.id))
    .where(eq(tenants.id, tenantId))
    .limit(1)

  if (!tenantRow) {
    throw new Error(`Tenant ${tenantId} not found`)
  }

  return {
    isRuntimeReady:
      tenantRow.tenantStatus === "ready" && tenantRow.serverStatus === "ready",
    tenantId: tenantRow.tenantId,
  }
}

async function enqueueTenantConfigApply(input: {
  desiredStateVersion: number
  tenantId: string
}) {
  const jobId = await enqueueJob({
    jobType: JOB_TYPES.applyTenantConfig,
    payload: {
      desiredStateVersion: input.desiredStateVersion,
      tenantId: input.tenantId,
    },
  })
  const db = getDb()

  await db.insert(tenantApplyRuns).values({
    desiredStateVersion: input.desiredStateVersion,
    jobRunId: jobId,
    status: "queued",
    tenantId: input.tenantId,
  })

  return jobId
}

export async function disconnectWorkspaceIntegration(input: {
  orgSlug: string
  providerKey: string
  userExternalId: string
}) {
  const { tenantId } = await getAuthorizedTenantContext(input)
  const providerKey = input.providerKey.trim().toLowerCase()

  if (
    providerKey !== "gandi" &&
    providerKey !== "github" &&
    providerKey !== "linear" &&
    providerKey !== "posthog" &&
    providerKey !== "slack"
  ) {
    throw new Error(`Disconnect is not supported for ${providerKey} yet.`)
  }

  const db = getDb()
  const now = new Date()
  let desiredStateVersion = 0

  await db.transaction(async (tx) => {
    const [integration] = await tx
      .select({
        connectedAt: tenantIntegrations.connectedAt,
        disconnectedAt: tenantIntegrations.disconnectedAt,
        id: tenantIntegrations.id,
      })
      .from(tenantIntegrations)
      .where(
        and(
          eq(tenantIntegrations.tenantId, tenantId),
          eq(tenantIntegrations.providerKey, providerKey),
        ),
      )
      .limit(1)

    if (!integration?.connectedAt || integration.disconnectedAt) {
      throw new Error(
        `${getWorkspaceIntegrationLabel(providerKey)} is not connected in this workspace.`,
      )
    }

    if (providerKey === "linear" || providerKey === "slack") {
      const [oauthConnection] = await tx
        .select({
          id: integrationOauthConnections.id,
          status: integrationOauthConnections.status,
        })
        .from(integrationOauthConnections)
        .where(
          and(
            eq(integrationOauthConnections.tenantIntegrationId, integration.id),
            eq(integrationOauthConnections.providerKey, providerKey),
          ),
        )
        .limit(1)

      if (oauthConnection) {
        await tx
          .delete(integrationOauthCredentials)
          .where(
            eq(integrationOauthCredentials.connectionId, oauthConnection.id),
          )

        await tx
          .update(integrationOauthConnections)
          .set({
            credentialsExpiresAt: null,
            lastError: null,
            lastErrorAt: null,
            lastRefreshFailedAt: null,
            refreshAttemptCount: 0,
            refreshRetryAfter: null,
            refreshTokenExpiresAt: null,
            status: "disconnected",
            updatedAt: now,
          })
          .where(eq(integrationOauthConnections.id, oauthConnection.id))

        await appendIntegrationOauthEventTx(tx, {
          connectionId: oauthConnection.id,
          details: {
            disconnectedBy: input.userExternalId,
          },
          eventType: "disconnect",
          providerKey,
          statusAfter: "disconnected",
          statusBefore: oauthConnection.status,
          tenantIntegrationId: integration.id,
        })
      }
    }

    if (providerKey === "posthog") {
      await tx
        .delete(integrationApiCredentials)
        .where(
          eq(integrationApiCredentials.tenantIntegrationId, integration.id),
        )
    }

    await tx
      .update(tenantIntegrations)
      .set({
        disconnectedAt: now,
        lastError: null,
        lastErrorAt: null,
        status: "disconnected",
        updatedAt: now,
      })
      .where(eq(tenantIntegrations.id, integration.id))

    const latestDesiredState = await tx
      .select({
        configJson: tenantDesiredStates.configJson,
        version: tenantDesiredStates.version,
      })
      .from(tenantDesiredStates)
      .where(eq(tenantDesiredStates.tenantId, tenantId))
      .orderBy(desc(tenantDesiredStates.version))
      .limit(1)
      .then((rows) => rows[0] ?? null)

    desiredStateVersion = (latestDesiredState?.version ?? 0) + 1

    await tx.insert(tenantDesiredStates).values({
      configJson: buildDisconnectedDesiredStateConfig({
        configJson: latestDesiredState?.configJson,
        providerKey,
      }),
      tenantId,
      version: desiredStateVersion,
    })
  })

  const tenantRuntime = await getTenantRuntimeState(tenantId)

  if (tenantRuntime.isRuntimeReady && providerKey !== "gandi") {
    await enqueueTenantConfigApply({
      desiredStateVersion,
      tenantId,
    })
  }

  return {
    applyQueued: tenantRuntime.isRuntimeReady && providerKey !== "gandi",
    status: "disconnected",
  }
}

export async function enableWorkspaceIntegration(input: {
  orgSlug: string
  providerKey: string
  userExternalId: string
}) {
  const { tenantId } = await getAuthorizedTenantContext(input)
  const providerKey = input.providerKey.trim().toLowerCase()

  if (providerKey !== "gandi") {
    throw new Error(`Enable is not supported for ${providerKey} yet.`)
  }

  const db = getDb()
  const now = new Date()

  await db
    .insert(tenantIntegrations)
    .values({
      connectedAt: now,
      disconnectedAt: null,
      lastError: null,
      lastErrorAt: null,
      providerKey,
      status: "connected",
      tenantId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      set: {
        connectedAt: now,
        disconnectedAt: null,
        lastError: null,
        lastErrorAt: null,
        status: "connected",
        updatedAt: now,
      },
      target: [tenantIntegrations.tenantId, tenantIntegrations.providerKey],
    })

  return {
    applyQueued: false,
    status: "connected",
  }
}

export async function connectWorkspaceApiKeyIntegration(input: {
  apiKey: string
  declaredScopes: string[]
  defaultTargetKey: string
  host: string
  orgSlug: string
  providerKey: string
  targets: Array<{
    environmentId?: string
    key: string
    label: string
    organizationId?: string
    projectId?: string
  }>
  userExternalId: string
}) {
  const { tenantId } = await getAuthorizedTenantContext(input)
  const providerKey = input.providerKey.trim().toLowerCase()

  if (providerKey !== "posthog") {
    throw new Error(`API-key setup is not supported for ${providerKey} yet.`)
  }

  const host = normalizePostHogHost(input.host)
  const now = new Date()
  const firstOrganizationId = input.targets.find(
    (target) => target.organizationId,
  )?.organizationId

  if (firstOrganizationId) {
    await validatePostHogApiKeyConnection({
      apiKey: input.apiKey,
      host,
      organizationId: firstOrganizationId,
    })
  }

  const db = getDb()
  const [integration] = await db
    .insert(tenantIntegrations)
    .values({
      connectedAt: now,
      disconnectedAt: null,
      lastError: null,
      lastErrorAt: null,
      providerKey,
      status: "connected",
      tenantId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      set: {
        connectedAt: now,
        disconnectedAt: null,
        lastError: null,
        lastErrorAt: null,
        status: "connected",
        updatedAt: now,
      },
      target: [tenantIntegrations.tenantId, tenantIntegrations.providerKey],
    })
    .returning({
      id: tenantIntegrations.id,
    })

  await upsertApiCredentialForTenantIntegration({
    apiKey: input.apiKey,
    credentialType: "personal_api_key",
    declaredScopes: input.declaredScopes,
    externalAccountLabel: "PostHog",
    metadata: {
      host,
    },
    providerKey,
    tenantIntegrationId: integration.id,
  })

  await upsertTenantIntegrationState({
    providerKey,
    state: {
      defaultTargetKey: input.defaultTargetKey,
      host,
      targets: input.targets,
    },
    tenantIntegrationId: integration.id,
  })

  return {
    applyQueued: false,
    status: "connected",
  }
}

export function resolvePostHogSetupApiKey(input: {
  providedApiKey?: string
  storedApiKey?: string | null
}) {
  const providedApiKey = input.providedApiKey?.trim()

  if (providedApiKey) {
    return providedApiKey
  }

  const storedApiKey = input.storedApiKey?.trim()

  if (storedApiKey) {
    return storedApiKey
  }

  throw new Error("Enter a PostHog API key before discovering or saving setup.")
}

async function resolvePostHogSetupApiKeyForTenant(input: {
  providedApiKey?: string
  providerKey: string
  tenantId: string
}) {
  if (input.providedApiKey?.trim()) {
    return resolvePostHogSetupApiKey({
      providedApiKey: input.providedApiKey,
      storedApiKey: null,
    })
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
        eq(tenantIntegrations.providerKey, input.providerKey),
      ),
    )
    .limit(1)
  const credential = integration
    ? await getConnectedApiCredentialForTenantIntegration({
        providerKey: input.providerKey,
        tenantIntegrationId: integration.id,
      })
    : null

  return resolvePostHogSetupApiKey({
    providedApiKey: input.providedApiKey,
    storedApiKey: credential?.apiKey,
  })
}

export async function discoverWorkspaceIntegrationSetup(input: {
  apiKey?: string
  host?: string
  orgSlug: string
  providerKey: string
  userExternalId: string
}) {
  const { tenantId } = await getAuthorizedTenantContext(input)
  const providerKey = input.providerKey.trim().toLowerCase()

  if (providerKey !== "posthog") {
    throw new Error(`Setup discovery is not supported for ${providerKey}.`)
  }

  const apiKey = await resolvePostHogSetupApiKeyForTenant({
    providedApiKey: input.apiKey,
    providerKey,
    tenantId,
  })

  return discoverPostHogIntegrationSetup({
    apiKey,
    host: input.host ?? "https://us.posthog.com",
  })
}

export async function applyWorkspaceIntegrationSetup(input: {
  apiKey?: string
  defaultResourceKey?: string
  enabledCapabilityKeys: string[]
  host?: string
  orgSlug: string
  providerKey: string
  selectedResourceKeys: string[]
  userExternalId: string
}) {
  const { tenantId } = await getAuthorizedTenantContext(input)
  const providerKey = input.providerKey.trim().toLowerCase()

  if (providerKey !== "posthog") {
    throw new Error(`Setup apply is not supported for ${providerKey}.`)
  }

  const apiKey = await resolvePostHogSetupApiKeyForTenant({
    providedApiKey: input.apiKey,
    providerKey,
    tenantId,
  })
  const host = normalizePostHogHost(input.host ?? "https://us.posthog.com")
  const discovery = await discoverPostHogIntegrationSetup({
    apiKey,
    host,
  })
  const resources = normalizePostHogSetupResources(discovery.resources)
  const selectedResourceKeys = [...new Set(input.selectedResourceKeys)]
  const selectedResources = resources.filter((resource) =>
    selectedResourceKeys.includes(resource.key),
  )

  if (selectedResources.length === 0) {
    throw new Error(
      "Select at least one discovered project before saving PostHog.",
    )
  }

  const defaultResourceKey =
    input.defaultResourceKey &&
    selectedResources.some(
      (resource) => resource.key === input.defaultResourceKey,
    )
      ? input.defaultResourceKey
      : selectedResources[0]?.key

  if (!defaultResourceKey) {
    throw new Error("Select a default PostHog project before saving.")
  }

  const enabledCapabilityKeys = new Set(input.enabledCapabilityKeys)
  const availableCapabilityKeys = new Set(
    discovery.capabilityRecommendations
      .filter((recommendation) => recommendation.status !== "unavailable")
      .map((recommendation) => recommendation.capabilityKey),
  )
  const now = new Date()
  const db = getDb()
  const [integration] = await db
    .insert(tenantIntegrations)
    .values({
      connectedAt: now,
      disconnectedAt: null,
      lastError: null,
      lastErrorAt: null,
      providerKey,
      status: "connected",
      tenantId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      set: {
        connectedAt: now,
        disconnectedAt: null,
        lastError: null,
        lastErrorAt: null,
        status: "connected",
        updatedAt: now,
      },
      target: [tenantIntegrations.tenantId, tenantIntegrations.providerKey],
    })
    .returning({
      id: tenantIntegrations.id,
    })
  const state = buildPostHogSetupState({
    defaultResourceKey,
    host,
    resources,
    selectedResourceKeys,
  })

  await upsertApiCredentialForTenantIntegration({
    apiKey,
    credentialType: "personal_api_key",
    declaredScopes: discovery.credential.detectedScopes,
    externalAccountLabel: discovery.account?.label ?? "PostHog",
    lastValidatedAt: now,
    metadata: {
      host,
      setup: {
        account: discovery.account,
        appliedAt: now.toISOString(),
        detectedScopes: discovery.credential.detectedScopes,
        warnings: discovery.warnings,
      },
    },
    providerKey,
    tenantIntegrationId: integration.id,
  })

  await upsertTenantIntegrationState({
    providerKey,
    state,
    tenantIntegrationId: integration.id,
  })

  for (const recommendation of discovery.capabilityRecommendations) {
    await upsertTenantIntegrationCapabilityPolicy({
      capabilityKey: recommendation.capabilityKey,
      policy:
        availableCapabilityKeys.has(recommendation.capabilityKey) &&
        enabledCapabilityKeys.has(recommendation.capabilityKey)
          ? { policy: "allow" }
          : { policy: "block" },
      tenantIntegrationId: integration.id,
    })
  }

  return {
    applyQueued: false,
    status: "connected",
  }
}

async function validatePostHogApiKeyConnection(input: {
  apiKey: string
  host: string
  organizationId: string
}) {
  const response = await fetch(
    `${input.host}/api/organizations/${encodeURIComponent(input.organizationId)}/projects/`,
    {
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
      },
      method: "GET",
    },
  )

  if (!response.ok) {
    throw new Error(
      "PostHog API key could not read the configured organization.",
    )
  }
}

export async function enqueueWorkspaceSlackDirectoryResync(input: {
  action: "channels" | "users"
  orgSlug: string
  userExternalId: string
}) {
  const { tenantId } = await getAuthorizedTenantContext(input)
  const integration = await getRuntimeIntegrationForTenant({
    integrationKey: "slack",
    tenantId,
  })

  if (!integration?.status.connected) {
    throw new Error(
      "Slack must be connected before its directory can be synced.",
    )
  }

  const jobId = await enqueueJob({
    jobType:
      input.action === "users"
        ? JOB_TYPES.resyncSlackUsers
        : JOB_TYPES.resyncSlackChannels,
    payload: {
      tenantId,
    },
  })

  return {
    jobId,
    ok: true as const,
  }
}

export async function updateWorkspaceIntegrationCapabilityPolicy(input: {
  capabilityKey: string
  orgSlug: string
  policy: { policy: "allow" | "block" }
  providerKey: string
  userExternalId: string
}) {
  const { tenantId } = await getAuthorizedTenantContext(input)
  const definition = getIntegrationDefinition(
    input.providerKey.trim().toLowerCase(),
  )

  if (!definition?.runtimeSurface) {
    throw new Error(
      `Managed integration ${input.providerKey} is not available.`,
    )
  }

  const runtimeDefinition = definition as typeof definition & {
    runtimeSurface: NonNullable<typeof definition.runtimeSurface>
  }
  const command = listIntegrationCommands({
    definition: runtimeDefinition,
  }).find((entry) => entry.commandKey === input.capabilityKey)
  const providerCapability = runtimeDefinition.agentCapabilities.find(
    (entry) => entry.key === input.capabilityKey,
  )

  if (!command && !providerCapability) {
    throw new Error(
      `${definition.label} does not expose the ${input.capabilityKey} capability.`,
    )
  }

  if (command && !isCommandUserControllable(command)) {
    throw new Error(
      `${definition.label} does not allow workspace policy changes for ${command.commandKey}.`,
    )
  }

  if (
    providerCapability &&
    !isAgentCapabilityUserControllable(providerCapability)
  ) {
    throw new Error(
      `${definition.label} does not allow workspace policy changes for ${providerCapability.key}.`,
    )
  }

  const resolvedCapabilityKey =
    command?.commandKey ?? providerCapability?.key ?? null

  if (!resolvedCapabilityKey) {
    throw new Error(
      `${definition.label} does not expose the ${input.capabilityKey} capability.`,
    )
  }

  const db = getDb()
  const [integration] = await db
    .select({
      id: tenantIntegrations.id,
    })
    .from(tenantIntegrations)
    .where(
      and(
        eq(tenantIntegrations.tenantId, tenantId),
        eq(tenantIntegrations.providerKey, runtimeDefinition.key),
      ),
    )
    .limit(1)

  if (!integration) {
    throw new Error(
      `${definition.label} must be connected before capability policy can be updated.`,
    )
  }

  await upsertTenantIntegrationCapabilityPolicy({
    capabilityKey: resolvedCapabilityKey,
    policy: input.policy,
    tenantIntegrationId: integration.id,
  })

  const rows = await listManagedIntegrationCapabilities({
    integrationKey: runtimeDefinition.key,
    orgSlug: input.orgSlug,
    tenantId,
  })
  const row = rows.find(
    (entry) => entry.capabilityKey === resolvedCapabilityKey,
  )

  if (!row) {
    throw new Error(
      "Capability policy was updated but the capability could not be reloaded.",
    )
  }

  return row
}

export async function updateWorkspaceSlackSettings(input: {
  allowDestructiveChanges?: boolean
  expectedEntryVersion?: number
  orgSlug: string
  patch: Record<string, unknown>
  summary?: string
  userExternalId: string
}) {
  const { tenantId } = await getAuthorizedTenantContext(input)
  const result = await applyRuntimeIntegrationSettingsForTenant({
    allowDestructiveChanges: input.allowDestructiveChanges,
    expectedEntryVersion: input.expectedEntryVersion,
    integrationKey: "slack",
    patch: input.patch,
    summary: input.summary,
    tenantId,
  })

  if (!result) {
    throw new Error("Slack settings are not available for this workspace.")
  }

  return result
}

export async function updateWorkspaceSlackChannelMembership(input: {
  action: "join" | "leave"
  channelId: string
  orgSlug: string
  userExternalId: string
}) {
  const { tenantId } = await getAuthorizedTenantContext(input)
  const integration = await getRuntimeIntegrationForTenant({
    integrationKey: "slack",
    tenantId,
  })

  const db = getDb()
  const [tenantIntegration] = await db
    .select({
      id: tenantIntegrations.id,
    })
    .from(tenantIntegrations)
    .where(
      and(
        eq(tenantIntegrations.tenantId, tenantId),
        eq(tenantIntegrations.providerKey, "slack"),
      ),
    )
    .limit(1)

  if (!integration || !tenantIntegration) {
    throw new Error(
      "Slack must be connected before Otto can join or leave channels.",
    )
  }

  const access = await getConnectedOauthAccessForTenantIntegration({
    providerKey: "slack",
    tenantIntegrationId: tenantIntegration.id,
  })

  if (!access?.accessToken) {
    throw new Error(
      "Slack bot token is unavailable, so Otto cannot update channel membership.",
    )
  }

  if (input.action === "join") {
    await joinSlackChannel({
      botToken: access.accessToken,
      channelId: input.channelId,
    })
  } else {
    await leaveSlackChannel({
      botToken: access.accessToken,
      channelId: input.channelId,
    })
  }

  await enqueueJob({
    jobType: JOB_TYPES.resyncSlackChannels,
    payload: {
      tenantId,
    },
  })

  const settings = await getRuntimeIntegrationSettingsForTenant({
    integrationKey: "slack",
    tenantId,
  })

  if (!settings) {
    throw new Error("Slack settings are not available for this workspace.")
  }

  return {
    applyQueued: false,
    surface: applySlackChannelMembershipToSurface({
      action: input.action,
      channelId: input.channelId,
      surface: settings.surface as MutableSlackSurface,
    }),
  }
}

function applySlackChannelMembershipToSurface(input: {
  action: "join" | "leave"
  channelId: string
  surface: MutableSlackSurface
}) {
  const channels = Array.isArray(input.surface.availableChannels)
    ? input.surface.availableChannels
    : []

  return {
    ...input.surface,
    availableChannels: channels.map((channel) => {
      if (channel.id !== input.channelId) {
        return channel
      }

      return {
        ...channel,
        isMember: input.action === "join",
      }
    }),
  }
}
