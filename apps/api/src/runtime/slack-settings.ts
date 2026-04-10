import { getDb } from "@otto/feature-integrations-runtime/db/client"
import {
  integrationMessagingConversations,
  integrationMessagingWorkspaceMembers,
  integrationMessagingWorkspaces,
  integrationSlackInstallations,
  organizations,
  tenantApplyRuns,
  tenantDesiredStates,
  tenantIntegrations,
  tenantManagedConfigVersions,
  tenantRuntimeConfigEntries,
  tenantRuntimeConfigMutations,
  tenantServers,
  tenants,
} from "@otto/feature-integrations-runtime/db/schema"
import {
  buildRuntimeIntegrationSettingsContract,
  getIntegrationDefinition,
  type RuntimeIntegrationSummaryResponse,
} from "@otto/feature-integrations-runtime/integrations/framework"
import {
  deriveSlackPolicyEffects,
  isSlackPolicyDestructive,
} from "@otto/feature-integrations-runtime/integrations/library/slack/policy"
import {
  slackActionMeanings,
  slackAgentCapabilities,
  slackAgentOperations,
  slackFieldMeanings,
} from "@otto/feature-integrations-runtime/integrations/library/slack/settings-metadata"
import { getSlackDestructiveChangeError } from "@otto/feature-integrations-runtime/integrations/library/slack/update-policy"
import {
  getDefaultSlackRuntimeConfig,
  parseSlackRuntimeConfig,
  SLACK_RUNTIME_CONFIG_DESCRIPTION,
  SLACK_RUNTIME_CONFIG_LABEL,
  SLACK_RUNTIME_CONFIG_SCHEMA_SOURCE,
  SLACK_RUNTIME_CONFIG_SCHEMA_VERSION,
  SLACK_RUNTIME_CONFIG_SURFACE_KEY,
  SLACK_RUNTIME_CONFIG_SURFACE_KIND,
  slackRuntimeConfigJsonSchema,
  slackRuntimeConfigPatchSchema,
  slackRuntimeConfigUiHints,
  type SlackRuntimeConfig,
} from "@otto/feature-integrations-runtime/lib/slack-config"
import { and, desc, eq } from "drizzle-orm"

import { enqueueJob } from "../jobs/queue"
import { JOB_TYPES } from "../jobs/types"

type ToolInstallState = "installed" | "uninstalled"

type SlackDirectoryOption = {
  description: string | null
  id: string
  isArchived?: boolean
  isMember?: boolean
  label: string
  memberCount?: number | null
  secondaryLabel: string | null
  visibility?: "private" | "public" | null
}

type SlackRuntimeConfigEntry = {
  config: SlackRuntimeConfig
  enabled: boolean
  entryVersion: number
  id: string
  installState: ToolInstallState
  schemaVersion: string
}

type SlackConnectionProfile = {
  installerUserId: string | null
  slackBotUserId: string | null
  teamId: string
  teamName: string | null
}

export class TenantRuntimeConfigVersionConflictError extends Error {
  constructor(
    readonly expectedVersion: number,
    readonly currentVersion: number,
  ) {
    super(
      `Managed runtime config version mismatch: expected ${expectedVersion}, current ${currentVersion}`,
    )
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeInstallState(value: string | null | undefined): ToolInstallState {
  return value === "uninstalled" ? "uninstalled" : "installed"
}

function buildTenantSlackRuntimeConfig(input: SlackRuntimeConfigEntry) {
  return {
    ...input.config,
    enabled: input.enabled,
    entryVersion: input.entryVersion,
    installState: input.installState,
    schemaVersion: input.schemaVersion,
  }
}

function getSlackSurfaceAllowedActions(input: {
  enabled: boolean
  installState: ToolInstallState
}) {
  if (input.installState === "uninstalled") {
    return ["install"] as const
  }

  return [
    "update",
    input.enabled ? "disable" : "enable",
    "uninstall",
    "reapply",
  ] as const
}

function buildSlackConnectionProfile(input: {
  installerUserId: string | null
  slackBotUserId: string | null
  slackTeamId: string | null
  slackTeamName: string | null
}) {
  const teamId =
    typeof input.slackTeamId === "string" && input.slackTeamId.trim()
      ? input.slackTeamId.trim()
      : null

  if (!teamId) {
    return null
  }

  return {
    installerUserId: input.installerUserId,
    slackBotUserId: input.slackBotUserId,
    teamId,
    teamName: input.slackTeamName,
  } satisfies SlackConnectionProfile
}

async function getOrganizationSlugForTenant(tenantId: string) {
  const db = getDb()
  const [organization] = await db
    .select({
      slug: organizations.slug,
    })
    .from(tenants)
    .innerJoin(organizations, eq(tenants.organizationId, organizations.id))
    .where(eq(tenants.id, tenantId))
    .limit(1)

  return organization?.slug ?? null
}

async function getLatestDesiredState(tenantId: string) {
  const db = getDb()
  const [state] = await db
    .select({
      configJson: tenantDesiredStates.configJson,
      version: tenantDesiredStates.version,
    })
    .from(tenantDesiredStates)
    .where(eq(tenantDesiredStates.tenantId, tenantId))
    .orderBy(desc(tenantDesiredStates.version))
    .limit(1)

  return state ?? null
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

async function getOrCreateTenantSlackRuntimeConfigEntry(
  tenantId: string,
): Promise<SlackRuntimeConfigEntry> {
  const db = getDb()
  const [existingEntry] = await db
    .select({
      configJson: tenantRuntimeConfigEntries.configJson,
      enabled: tenantRuntimeConfigEntries.enabled,
      entryVersion: tenantRuntimeConfigEntries.entryVersion,
      id: tenantRuntimeConfigEntries.id,
      installState: tenantRuntimeConfigEntries.installState,
      schemaVersion: tenantRuntimeConfigEntries.schemaVersion,
    })
    .from(tenantRuntimeConfigEntries)
    .where(
      and(
        eq(tenantRuntimeConfigEntries.tenantId, tenantId),
        eq(
          tenantRuntimeConfigEntries.surfaceKind,
          SLACK_RUNTIME_CONFIG_SURFACE_KIND,
        ),
        eq(
          tenantRuntimeConfigEntries.surfaceKey,
          SLACK_RUNTIME_CONFIG_SURFACE_KEY,
        ),
      ),
    )
    .limit(1)

  if (existingEntry) {
    return {
      config: parseSlackRuntimeConfig(existingEntry.configJson),
      enabled: existingEntry.enabled,
      entryVersion: existingEntry.entryVersion,
      id: existingEntry.id,
      installState: normalizeInstallState(existingEntry.installState),
      schemaVersion: existingEntry.schemaVersion,
    }
  }

  const now = new Date()
  const [createdEntry] = await db
    .insert(tenantRuntimeConfigEntries)
    .values({
      changeSummary: "Seeded default Slack runtime config",
      configJson: getDefaultSlackRuntimeConfig(),
      createdByType: "system",
      enabled: true,
      installState: "installed",
      lastValidatedAt: now,
      schemaSource: SLACK_RUNTIME_CONFIG_SCHEMA_SOURCE,
      schemaVersion: SLACK_RUNTIME_CONFIG_SCHEMA_VERSION,
      surfaceKey: SLACK_RUNTIME_CONFIG_SURFACE_KEY,
      surfaceKind: SLACK_RUNTIME_CONFIG_SURFACE_KIND,
      tenantId,
      updatedAt: now,
      updatedByType: "system",
    })
    .returning({
      configJson: tenantRuntimeConfigEntries.configJson,
      enabled: tenantRuntimeConfigEntries.enabled,
      entryVersion: tenantRuntimeConfigEntries.entryVersion,
      id: tenantRuntimeConfigEntries.id,
      installState: tenantRuntimeConfigEntries.installState,
      schemaVersion: tenantRuntimeConfigEntries.schemaVersion,
    })

  return {
    config: parseSlackRuntimeConfig(createdEntry.configJson),
    enabled: createdEntry.enabled,
    entryVersion: createdEntry.entryVersion,
    id: createdEntry.id,
    installState: normalizeInstallState(createdEntry.installState),
    schemaVersion: createdEntry.schemaVersion,
  }
}

async function getConnectedSlackIntegrationForTenant(tenantId: string) {
  const db = getDb()
  const [integration] = await db
    .select({
      connectedAt: tenantIntegrations.connectedAt,
      disconnectedAt: tenantIntegrations.disconnectedAt,
      installerUserId: integrationSlackInstallations.installerUserId,
      slackBotUserId: integrationSlackInstallations.slackBotUserId,
      slackTeamId: integrationSlackInstallations.slackTeamId,
      slackTeamName: integrationSlackInstallations.slackTeamName,
      tenantIntegrationId: tenantIntegrations.id,
    })
    .from(tenantIntegrations)
    .leftJoin(
      integrationSlackInstallations,
      eq(
        integrationSlackInstallations.tenantIntegrationId,
        tenantIntegrations.id,
      ),
    )
    .where(
      and(
        eq(tenantIntegrations.tenantId, tenantId),
        eq(tenantIntegrations.providerKey, "slack"),
      ),
    )
    .limit(1)

  if (!integration?.connectedAt || integration.disconnectedAt) {
    return null
  }

  const profile = buildSlackConnectionProfile({
    installerUserId: integration.installerUserId,
    slackBotUserId: integration.slackBotUserId,
    slackTeamId: integration.slackTeamId,
    slackTeamName: integration.slackTeamName,
  })

  if (!profile) {
    return null
  }

  return {
    profile,
    tenantIntegrationId: integration.tenantIntegrationId,
  }
}

async function getSlackDirectoryOptionsForTenant(tenantId: string) {
  const db = getDb()
  const [workspace] = await db
    .select({
      id: integrationMessagingWorkspaces.id,
    })
    .from(integrationMessagingWorkspaces)
    .innerJoin(
      tenantIntegrations,
      eq(integrationMessagingWorkspaces.tenantIntegrationId, tenantIntegrations.id),
    )
    .where(
      and(
        eq(tenantIntegrations.tenantId, tenantId),
        eq(tenantIntegrations.providerKey, "slack"),
      ),
    )
    .limit(1)

  if (!workspace) {
    return {
      availableChannels: [] as SlackDirectoryOption[],
      availableUsers: [] as SlackDirectoryOption[],
    }
  }

  const [channelRows, userRows] = await Promise.all([
    db
      .select({
        description: integrationMessagingConversations.topic,
        id: integrationMessagingConversations.externalConversationId,
        isArchived: integrationMessagingConversations.isArchived,
        label: integrationMessagingConversations.name,
        metadataJson: integrationMessagingConversations.metadataJson,
        purpose: integrationMessagingConversations.purpose,
        type: integrationMessagingConversations.conversationType,
      })
      .from(integrationMessagingConversations)
      .where(eq(integrationMessagingConversations.messagingWorkspaceId, workspace.id)),
    db
      .select({
        description: integrationMessagingWorkspaceMembers.fullName,
        id: integrationMessagingWorkspaceMembers.externalMemberId,
        isDeleted: integrationMessagingWorkspaceMembers.isDeleted,
        label: integrationMessagingWorkspaceMembers.displayName,
        secondaryLabel: integrationMessagingWorkspaceMembers.username,
      })
      .from(integrationMessagingWorkspaceMembers)
      .where(
        eq(
          integrationMessagingWorkspaceMembers.messagingWorkspaceId,
          workspace.id,
        ),
      ),
  ])

  return {
    availableChannels: channelRows.map((channel) => ({
      description: channel.purpose ?? channel.description ?? null,
      id: channel.id,
      isArchived: channel.isArchived,
      isMember:
        isRecord(channel.metadataJson) && "is_member" in channel.metadataJson
          ? Boolean(channel.metadataJson.is_member)
          : false,
      label: channel.label ?? channel.id,
      memberCount:
        isRecord(channel.metadataJson) &&
        typeof channel.metadataJson.num_members === "number"
          ? channel.metadataJson.num_members
          : null,
      secondaryLabel: channel.type === "private_channel" ? "Private" : "Public",
      visibility: channel.type === "private_channel" ? "private" : "public",
    })),
    availableUsers: userRows
      .filter((user) => !user.isDeleted)
      .map((user) => ({
        description: user.description ?? null,
        id: user.id,
        label: user.label ?? user.id,
        secondaryLabel: user.secondaryLabel ?? null,
      })),
  }
}

async function validateSlackRuntimeConfigSemanticsForTenant(input: {
  config: SlackRuntimeConfig
  tenantId: string
}) {
  const { availableChannels, availableUsers } =
    await getSlackDirectoryOptionsForTenant(input.tenantId)

  if (
    availableChannels.length === 0 &&
    availableUsers.length === 0 &&
    input.config.allowedChannelIds.length === 0 &&
    input.config.allowedUserIds.length === 0
  ) {
    return
  }

  const availableUserIds = new Set(availableUsers.map((user) => user.id))
  const missingUserIds = input.config.allowedUserIds.filter(
    (userId) => !availableUserIds.has(userId),
  )

  if (missingUserIds.length > 0) {
    throw new Error(
      `Slack users not found in the latest directory sync: ${missingUserIds.join(", ")}`,
    )
  }

  if (input.config.channelAccessMode === "member_of_channels") {
    return
  }

  const channelsById = new Map(
    availableChannels.map((channel) => [channel.id, channel] as const),
  )
  const missingChannelIds = input.config.allowedChannelIds.filter(
    (channelId) => !channelsById.has(channelId),
  )

  if (missingChannelIds.length > 0) {
    throw new Error(
      `Slack channels not found in the latest directory sync: ${missingChannelIds.join(", ")}`,
    )
  }

  const archivedChannelIds = input.config.allowedChannelIds.filter(
    (channelId) => channelsById.get(channelId)?.isArchived,
  )

  if (archivedChannelIds.length > 0) {
    throw new Error(
      `Slack channels are archived and cannot be allowlisted: ${archivedChannelIds.join(", ")}`,
    )
  }
}

async function evaluateSlackPolicyForTenant(input: {
  config: SlackRuntimeConfig
  currentConfig?: SlackRuntimeConfig
  tenantId: string
}) {
  const { availableChannels } = await getSlackDirectoryOptionsForTenant(
    input.tenantId,
  )

  return deriveSlackPolicyEffects({
    config: input.config,
    currentConfig: input.currentConfig,
    directoryChannels: availableChannels.map((channel) => ({
      id: channel.id,
      isArchived: channel.isArchived,
      isMember: channel.isMember,
    })),
  })
}

async function getSlackMemberChannelIds(tenantId: string) {
  const { availableChannels } = await getSlackDirectoryOptionsForTenant(tenantId)

  return availableChannels
    .filter((channel) => channel.isMember && !channel.isArchived)
    .map((channel) => channel.id)
}

async function getTenantSlackRuntimeConfigSurfaceForTenant(tenantId: string) {
  const [entry, directory, slackIntegration, organizationSlug] =
    await Promise.all([
      getOrCreateTenantSlackRuntimeConfigEntry(tenantId),
      getSlackDirectoryOptionsForTenant(tenantId),
      getConnectedSlackIntegrationForTenant(tenantId),
      getOrganizationSlugForTenant(tenantId),
    ])
  const definition = getIntegrationDefinition("slack")
  const effects = await evaluateSlackPolicyForTenant({
    config: entry.config,
    tenantId,
  })

  return {
    actionMeanings: slackActionMeanings,
    agentCapabilities: slackAgentCapabilities,
    agentOperations: slackAgentOperations,
    allowedActions: getSlackSurfaceAllowedActions({
      enabled: entry.enabled,
      installState: entry.installState,
    }),
    availability: slackIntegration ? "available" : "blocked",
    availableChannels: directory.availableChannels,
    availableUsers: directory.availableUsers,
    blockingReason: slackIntegration
      ? null
      : "Connect Slack before changing Slack runtime behavior.",
    canAgentEdit: Boolean(slackIntegration),
    canUserEdit: true,
    config: buildTenantSlackRuntimeConfig(entry),
    derivedEffects: effects,
    description: SLACK_RUNTIME_CONFIG_DESCRIPTION,
    fieldMeanings: slackFieldMeanings,
    id: `${SLACK_RUNTIME_CONFIG_SURFACE_KIND}:${SLACK_RUNTIME_CONFIG_SURFACE_KEY}`,
    key: SLACK_RUNTIME_CONFIG_SURFACE_KEY,
    kind: SLACK_RUNTIME_CONFIG_SURFACE_KIND,
    label: SLACK_RUNTIME_CONFIG_LABEL,
    schema: slackRuntimeConfigJsonSchema,
    settingsUrl:
      organizationSlug && definition
        ? definition.settingsPath(organizationSlug)
        : null,
    setupUrl:
      organizationSlug && definition
        ? definition.settingsPath(organizationSlug)
        : null,
    surfaceType: "integration" as const,
    uiGroup: "integrations" as const,
    uiHints: slackRuntimeConfigUiHints,
  }
}

async function createNextDesiredStateVersionForSlack(input: {
  config: SlackRuntimeConfig
  profile: SlackConnectionProfile
  tenantId: string
}) {
  const db = getDb()
  const latestDesiredState = await getLatestDesiredState(input.tenantId)
  const nextVersion = (latestDesiredState?.version ?? 0) + 1
  const currentConfig = isRecord(latestDesiredState?.configJson)
    ? { ...latestDesiredState.configJson }
    : {}
  const integrations = Array.isArray(currentConfig.integrations)
    ? currentConfig.integrations.filter(
        (entry): entry is string => typeof entry === "string" && entry !== "slack",
      )
    : []
  const effectiveAllowedChannelIds =
    input.config.channelAccessMode === "member_of_channels"
      ? await getSlackMemberChannelIds(input.tenantId)
      : input.config.allowedChannelIds

  integrations.push("slack")

  const [latestManagedConfig] = await db
    .select({
      version: tenantManagedConfigVersions.version,
    })
    .from(tenantManagedConfigVersions)
    .where(eq(tenantManagedConfigVersions.tenantId, input.tenantId))
    .orderBy(desc(tenantManagedConfigVersions.version))
    .limit(1)

  const [workspace] = await db
    .select({
      locale: organizations.locale,
      timeFormatPreference: organizations.timeFormatPreference,
      timezone: organizations.timezone,
    })
    .from(tenants)
    .innerJoin(organizations, eq(organizations.id, tenants.organizationId))
    .where(eq(tenants.id, input.tenantId))
    .limit(1)

  const configJson = {
    ...(workspace
      ? {
          locale: workspace.locale,
          timeFormat: workspace.timeFormatPreference,
          timezone: workspace.timezone,
        }
      : {}),
    ...(latestManagedConfig
      ? {
          managedConfigVersion: latestManagedConfig.version,
        }
      : {}),
    ...currentConfig,
    integrations: [...new Set(integrations)],
    media:
      isRecord(currentConfig.media) && isRecord(currentConfig.media.audio)
        ? currentConfig.media
        : {
            audio: {
              attachmentsMode: "first",
              echoTranscript: false,
              enabled: true,
              maxBytes: 20 * 1024 * 1024,
              model: "gpt-4o-mini-transcribe",
              provider: "openai",
            },
          },
    slack: {
      ackReactionEnabled: input.config.ackReactionEnabled,
      allowedChannelIds: effectiveAllowedChannelIds,
      allowedUserIds: input.config.allowedUserIds,
      answerInThreads: input.config.answerInThreads,
      channelAccessMode: input.config.channelAccessMode,
      installerUserId: input.profile.installerUserId,
      requireMentionInChannels: input.config.requireMentionInChannels,
      slackBotUserId: input.profile.slackBotUserId,
      teamId: input.profile.teamId,
      teamName: input.profile.teamName,
    },
  }

  const [createdDesiredState] = await db
    .insert(tenantDesiredStates)
    .values({
      configJson,
      tenantId: input.tenantId,
      version: nextVersion,
    })
    .returning({
      version: tenantDesiredStates.version,
    })

  return createdDesiredState
}

export async function getSlackRuntimeIntegrationSettingsForTenant(input: {
  integration: RuntimeIntegrationSummaryResponse
  tenantId: string
}) {
  const surface = await getTenantSlackRuntimeConfigSurfaceForTenant(input.tenantId)

  return {
    contract: buildRuntimeIntegrationSettingsContract({
      config: surface.config as Record<string, unknown>,
      fieldMeanings: surface.fieldMeanings,
      patchSchema: surface.schema,
      settingsExamples: input.integration.settings?.examples ?? [],
      settingsLabel: input.integration.settings?.label ?? "Configuration",
      uiFields:
        typeof surface.uiHints === "object" &&
        surface.uiHints &&
        "fields" in surface.uiHints
          ? ((surface.uiHints as { fields?: Record<string, unknown> }).fields ?? {})
          : {},
      workflow: input.integration.settings?.recommendedWorkflow ?? [],
    }),
    integration: {
      key: input.integration.key,
      label: input.integration.label,
      settings: input.integration.settings,
      status: input.integration.status,
    },
    surface,
  }
}

export async function validateSlackRuntimeIntegrationSettingsForTenant(input: {
  integration: RuntimeIntegrationSummaryResponse
  patch: Record<string, unknown>
  tenantId: string
}) {
  const parsedPatch = slackRuntimeConfigPatchSchema.parse(input.patch)
  const currentEntry = await getOrCreateTenantSlackRuntimeConfigEntry(input.tenantId)

  if (currentEntry.installState !== "installed") {
    throw new Error("Slack config must be installed before it can be updated")
  }

  const nextConfig = parseSlackRuntimeConfig({
    ...currentEntry.config,
    ...parsedPatch,
  })

  await validateSlackRuntimeConfigSemanticsForTenant({
    config: nextConfig,
    tenantId: input.tenantId,
  })
  const effects = await evaluateSlackPolicyForTenant({
    config: nextConfig,
    currentConfig: currentEntry.config,
    tenantId: input.tenantId,
  })
  const destructiveChangeError = getSlackDestructiveChangeError({
    createdByType: "runtime",
    isDestructive: isSlackPolicyDestructive(effects),
    wouldFullyLockOutSlack: effects.wouldFullyLockOutSlack,
  })

  if (destructiveChangeError) {
    throw new Error(destructiveChangeError)
  }

  const settings = await getSlackRuntimeIntegrationSettingsForTenant({
    integration: input.integration,
    tenantId: input.tenantId,
  })

  return {
    effects,
    integration: settings.integration,
    nextConfig,
    surface: settings.surface,
    validation: {
      ok: true,
      warnings: effects.warnings,
    },
  }
}

export async function applySlackRuntimeIntegrationSettingsForTenant(input: {
  expectedEntryVersion?: number
  integration: RuntimeIntegrationSummaryResponse
  patch: Record<string, unknown>
  summary?: string
  tenantId: string
}) {
  const parsedPatch = slackRuntimeConfigPatchSchema.parse(input.patch)
  const slackIntegration = await getConnectedSlackIntegrationForTenant(input.tenantId)

  if (!slackIntegration) {
    throw new Error("Slack must be connected before its runtime config can be updated")
  }

  const currentEntry = await getOrCreateTenantSlackRuntimeConfigEntry(input.tenantId)

  if (currentEntry.installState !== "installed") {
    throw new Error("Slack config must be installed before it can be updated")
  }

  if (
    typeof input.expectedEntryVersion === "number" &&
    currentEntry.entryVersion !== input.expectedEntryVersion
  ) {
    throw new TenantRuntimeConfigVersionConflictError(
      input.expectedEntryVersion,
      currentEntry.entryVersion,
    )
  }

  const nextConfig = parseSlackRuntimeConfig({
    ...currentEntry.config,
    ...parsedPatch,
  })

  await validateSlackRuntimeConfigSemanticsForTenant({
    config: nextConfig,
    tenantId: input.tenantId,
  })
  const effects = await evaluateSlackPolicyForTenant({
    config: nextConfig,
    currentConfig: currentEntry.config,
    tenantId: input.tenantId,
  })
  const destructiveChangeError = getSlackDestructiveChangeError({
    createdByType: "runtime",
    isDestructive: isSlackPolicyDestructive(effects),
    wouldFullyLockOutSlack: effects.wouldFullyLockOutSlack,
  })

  if (destructiveChangeError) {
    throw new Error(destructiveChangeError)
  }

  if (JSON.stringify(currentEntry.config) === JSON.stringify(nextConfig)) {
    const settings = await getSlackRuntimeIntegrationSettingsForTenant({
      integration: input.integration,
      tenantId: input.tenantId,
    })

    return {
      applyQueued: false,
      changed: false,
      currentEntryVersion: currentEntry.entryVersion,
      integration: settings.integration,
      surface: settings.surface,
      validation: {
        ok: true,
        warnings: effects.warnings,
      },
    }
  }

  const now = new Date()
  const nextEntryVersion = currentEntry.entryVersion + 1
  const db = getDb()

  await db
    .update(tenantRuntimeConfigEntries)
    .set({
      changeSummary: input.summary ?? "Updated Slack runtime config",
      configJson: nextConfig,
      entryVersion: nextEntryVersion,
      installState: "installed",
      lastValidatedAt: now,
      lastValidationError: null,
      schemaVersion: SLACK_RUNTIME_CONFIG_SCHEMA_VERSION,
      updatedAt: now,
      updatedByExternalId: null,
      updatedByType: "runtime",
    })
    .where(eq(tenantRuntimeConfigEntries.id, currentEntry.id))

  const desiredStateVersion = await createNextDesiredStateVersionForSlack({
    config: nextConfig,
    profile: slackIntegration.profile,
    tenantId: input.tenantId,
  })
  const tenantRuntime = await getTenantRuntimeState(input.tenantId)

  await db.insert(tenantRuntimeConfigMutations).values({
    actorExternalId: null,
    actorType: "runtime",
    desiredStateVersion: desiredStateVersion.version,
    expectedEntryVersion: input.expectedEntryVersion ?? null,
    mutationType: "update",
    patchJson: parsedPatch,
    resultJson: nextConfig,
    resultingEntryVersion: nextEntryVersion,
    tenantId: input.tenantId,
    tenantRuntimeConfigEntryId: currentEntry.id,
  })

  if (tenantRuntime.isRuntimeReady) {
    const jobId = await enqueueJob({
      jobType: JOB_TYPES.applyTenantConfig,
      payload: {
        desiredStateVersion: desiredStateVersion.version,
        tenantId: input.tenantId,
      },
    })

    await db.insert(tenantApplyRuns).values({
      desiredStateVersion: desiredStateVersion.version,
      jobRunId: jobId,
      status: "queued",
      tenantId: input.tenantId,
    })
  }

  const settings = await getSlackRuntimeIntegrationSettingsForTenant({
    integration: input.integration,
    tenantId: input.tenantId,
  })

  return {
    applyQueued: tenantRuntime.isRuntimeReady,
    changed: true,
    currentEntryVersion: nextEntryVersion,
    desiredStateVersion: desiredStateVersion.version,
    effects,
    installState: "installed" as const,
    integration: settings.integration,
    surface: settings.surface,
    validation: {
      ok: true,
      warnings: effects.warnings,
    },
  }
}
