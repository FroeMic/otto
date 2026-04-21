import { randomUUID } from "node:crypto"

import { decryptControlPlaneSecret } from "@otto/feature-integrations-runtime/lib/crypto"
import { getDb } from "@otto/feature-integrations-runtime/db/client"
import {
  creditLedgerEntries,
  integrationOauthConnections,
  jobEvents,
  jobRuns,
  memberships,
  organizations,
  providerAccounts,
  providerCredentials,
  providerUsageBuckets,
  providerUsageSettlements,
  tenantApplyRuns,
  tenantDesiredStates,
  tenantIntegrations,
  tenantRuntimeSecrets,
  tenants,
  tenantServers,
  userPlatformRoles,
  users,
} from "@otto/feature-integrations-runtime/db/schema"
import {
  isReservedWorkspaceSlug,
  normalizeWorkspaceSlug,
} from "@otto/feature-workspace-slugs"
import { WorkOS } from "@workos-inc/node"
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  lte,
  ne,
  sql,
} from "drizzle-orm"

import { enqueueJob } from "../jobs/queue"
import { CREDIT_LEDGER_ENTRY_TYPES } from "../billing/credit-pricing"
import {
  buildInitialWorkspaceCreditGrantInput,
  getWorkspaceBillingOverview,
} from "../billing/data"
import { getApiEnv, hasWorkOsConfig } from "../env"
import { syncDefaultTenantManagedSkillsForTenant } from "../runtime/managed-skills-data"
import type { WorkspaceSummary } from "../workspace/data"
import {
  buildInitialWorkspaceRuntimeProvisioningJobInput,
  ensureInitialWorkspaceRuntimeProvisioning,
} from "../workspace/initial-provisioning"
import { inspectObservedRuntimeImageForTenant } from "./runtime"

const OPENAI_PROVIDER_KEY = "openai"
const OPENCLAW_GATEWAY_TOKEN_SECRET_TYPE = "openclaw_gateway_token"
const PLATFORM_ADMIN_ROLE = "PLATFORM_ADMIN"
const PLATFORM_MANUAL_GRANT_SOURCE_TYPE = "platform_manual_grant"

const JOB_TYPES = {
  applyTenantConfig: "apply_tenant_config",
  deleteTenantServer: "delete_tenant_server",
  provisionTenantServer: "provision_tenant_server",
  deleteWorkspace: "delete_workspace",
  provisionTenantOpenAiKey: "provision_tenant_openai_key",
  refreshRuntimeImage: "refresh_runtime_image",
} as const

type PlatformProvisioningStrategy = "legacy_base_image"

async function resolvePlatformOrganizationSlug(input: {
  name: string
  slug?: string
}) {
  const normalizedSlug =
    typeof input.slug === "string" && input.slug.trim().length > 0
      ? normalizeWorkspaceSlug(input.slug)
      : normalizeWorkspaceSlug(input.name)

  if (!normalizedSlug) {
    throw new Error("Organization slug is required")
  }

  if (isReservedWorkspaceSlug(normalizedSlug)) {
    throw new Error("Organization slug is reserved")
  }

  const [existingOrganization] = await getDb()
    .select({
      id: organizations.id,
    })
    .from(organizations)
    .where(eq(organizations.slug, normalizedSlug))
    .limit(1)

  if (existingOrganization) {
    throw new Error("Organization slug is already in use")
  }

  return normalizedSlug
}

function getPlatformWorkOsClient() {
  const env = getApiEnv()

  if (!hasWorkOsConfig(env)) {
    throw new Error("WorkOS is not configured")
  }

  return new WorkOS(env.WORKOS_API_KEY ?? "", {
    clientId: env.WORKOS_CLIENT_ID,
  })
}

function isSyntheticPlatformOrganizationExternalId(externalId: string) {
  return externalId.startsWith("platform_")
}

function getWorkOsMembershipRoleSlug(membership: {
  role?: {
    slug?: string | null
  } | null
}) {
  return membership.role?.slug ?? "admin"
}

function getWorkOsMembershipStatus(membership: { status?: string | null }) {
  return membership.status ?? "active"
}

async function deleteWorkOsOrganizationBestEffort(
  externalOrganizationId: string,
) {
  try {
    await getPlatformWorkOsClient().organizations.deleteOrganization(
      externalOrganizationId,
    )
  } catch (error) {
    console.error(
      `[platform] failed to clean up WorkOS organization ${externalOrganizationId}: ${getErrorMessage(error)}`,
    )
  }
}

async function ensurePlatformOrganizationWorkOsProjection(input: {
  externalId: string
  id: string
  name: string
}) {
  if (!isSyntheticPlatformOrganizationExternalId(input.externalId)) {
    return input.externalId
  }

  const createdOrganization =
    await getPlatformWorkOsClient().organizations.createOrganization({
      name: input.name,
    })

  try {
    await getDb()
      .update(organizations)
      .set({
        externalId: createdOrganization.id,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, input.id))
  } catch (error) {
    await deleteWorkOsOrganizationBestEffort(createdOrganization.id)
    throw error
  }

  return createdOrganization.id
}

async function getOrCreatePlatformAdminMembership(input: {
  organizationExternalId: string
  userExternalId: string
}) {
  const workos = getPlatformWorkOsClient()
  const existingMemberships = await (
    await workos.userManagement.listOrganizationMemberships({
      userId: input.userExternalId,
    })
  ).autoPagination()
  const existingMembership = existingMemberships.find(
    (membership) =>
      membership.organizationId === input.organizationExternalId &&
      String(membership.status) !== "removed",
  )

  if (existingMembership) {
    if (getWorkOsMembershipRoleSlug(existingMembership) === "admin") {
      return existingMembership
    }

    return await workos.userManagement.updateOrganizationMembership(
      existingMembership.id,
      {
        roleSlug: "admin",
      },
    )
  }

  return await workos.userManagement.createOrganizationMembership({
    organizationId: input.organizationExternalId,
    roleSlug: "admin",
    userId: input.userExternalId,
  })
}

function recordFromUnknown(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return null
}

function numberFromValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "bigint") {
    return Number(value)
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function dateFromValue(value: unknown) {
  if (value instanceof Date) {
    return value
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  return null
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }

  return "Unknown error"
}

function extractRuntimeImageVersion(image: string | null) {
  if (!image) {
    return null
  }

  const digestSeparatorIndex = image.indexOf("@")

  if (digestSeparatorIndex >= 0) {
    return image.slice(digestSeparatorIndex + 1)
  }

  const lastColonIndex = image.lastIndexOf(":")
  const lastSlashIndex = image.lastIndexOf("/")

  if (lastColonIndex > lastSlashIndex) {
    return image.slice(lastColonIndex + 1)
  }

  return null
}

function buildSlackIntegrationSummary(
  row:
    | {
        connectedAt: Date | null
        lastError: string | null
        lastErrorAt: Date | null
        status: string
        teamId: string | null
        teamName: string | null
      }
    | null
    | undefined,
) {
  if (!row) {
    return null
  }

  return {
    connectedAt: row.connectedAt,
    lastError: row.lastError,
    lastErrorAt: row.lastErrorAt,
    status: row.status,
    teamId: row.teamId,
    teamName: row.teamName,
  }
}

function buildApplyRunSummary(
  row:
    | {
        desiredStateVersion: number
        error: string | null
        finishedAt: Date | null
        startedAt: Date | null
        status: string
      }
    | null
    | undefined,
) {
  if (!row) {
    return null
  }

  return {
    desiredStateVersion: row.desiredStateVersion,
    error: row.error,
    finishedAt: row.finishedAt,
    startedAt: row.startedAt,
    status: row.status,
  }
}

function buildJobEventMap(
  rows: Array<{
    createdAt: Date
    eventType: string
    jobRunId: string
    message: string
  }>,
) {
  const map = new Map<
    string,
    Array<{
      createdAt: Date
      eventType: string
      message: string
    }>
  >()

  for (const row of rows) {
    const existing = map.get(row.jobRunId) ?? []
    existing.push({
      createdAt: row.createdAt,
      eventType: row.eventType,
      message: row.message,
    })
    map.set(row.jobRunId, existing)
  }

  return map
}

function buildJobSummary(
  row:
    | {
        attempt: number
        createdAt: Date
        error: string | null
        finishedAt: Date | null
        id: string
        jobType: string
        payloadJson: unknown
        startedAt: Date | null
        status: string
      }
    | null
    | undefined,
  eventsByJobId: Map<
    string,
    Array<{
      createdAt: Date
      eventType: string
      message: string
    }>
  >,
) {
  if (!row) {
    return null
  }

  const payloadJson = recordFromUnknown(row.payloadJson)

  return {
    attempt: row.attempt,
    createdAt: row.createdAt,
    error: row.error,
    events: eventsByJobId.get(row.id) ?? [],
    finishedAt: row.finishedAt,
    id: row.id,
    jobType: row.jobType,
    startedAt: row.startedAt,
    status: row.status,
    step: typeof payloadJson?.step === "string" ? payloadJson.step : null,
  }
}

async function getObservedRuntimeImagesByTenant(
  tenantRows: Array<{
    id: string
    serverStatus: string | null
    status: string
  }>,
) {
  const observedImages = await Promise.all(
    tenantRows.map(async (tenant) => {
      const image = await inspectObservedRuntimeImageForTenant({
        serverStatus: tenant.serverStatus,
        status: tenant.status,
        tenantId: tenant.id,
      })

      return [tenant.id, image] as const
    }),
  )

  return new Map(observedImages)
}

async function getTenantOpenAiProviderSummary(tenantId: string) {
  const db = getDb()
  const [providerAccount] = await db
    .select({
      externalProjectId: providerAccounts.externalProjectId,
      id: providerAccounts.id,
      status: providerAccounts.status,
    })
    .from(providerAccounts)
    .where(
      and(
        eq(providerAccounts.tenantId, tenantId),
        eq(providerAccounts.providerKey, OPENAI_PROVIDER_KEY),
      ),
    )
    .limit(1)

  if (!providerAccount) {
    return null
  }

  const credentialRows = await db
    .select({
      createdAt: providerCredentials.createdAt,
      externalApiKeyId: providerCredentials.externalApiKeyId,
      externalServiceAccountId: providerCredentials.externalServiceAccountId,
      revokedAt: providerCredentials.revokedAt,
    })
    .from(providerCredentials)
    .where(eq(providerCredentials.providerAccountId, providerAccount.id))
    .orderBy(desc(providerCredentials.createdAt))

  const activeCredential =
    credentialRows.find((credential) => credential.revokedAt === null) ?? null

  return {
    activeApiKeyId: activeCredential?.externalApiKeyId ?? null,
    activeCredentialCount: credentialRows.filter(
      (credential) => credential.revokedAt === null,
    ).length,
    activeServiceAccountId: activeCredential?.externalServiceAccountId ?? null,
    latestCredentialCreatedAt: credentialRows[0]?.createdAt ?? null,
    projectId: providerAccount.externalProjectId,
    status: providerAccount.status,
    totalCredentialCount: credentialRows.length,
  }
}

async function getLatestDesiredStateVersion(tenantId: string) {
  const db = getDb()
  const [row] = await db
    .select({
      version: tenantDesiredStates.version,
    })
    .from(tenantDesiredStates)
    .where(eq(tenantDesiredStates.tenantId, tenantId))
    .orderBy(desc(tenantDesiredStates.version))
    .limit(1)

  return row?.version ?? null
}

async function getLatestTenantForOrganizationSlug(orgSlug: string) {
  const db = getDb()
  const [tenant] = await db
    .select({
      ipv4: tenantServers.ipv4,
      organizationId: organizations.id,
      orgSlug: organizations.slug,
      serverId: tenantServers.id,
      serverStatus: tenantServers.status,
      tenantId: tenants.id,
      tenantName: tenants.name,
      tenantStatus: tenants.status,
    })
    .from(tenants)
    .innerJoin(organizations, eq(tenants.organizationId, organizations.id))
    .leftJoin(tenantServers, eq(tenantServers.tenantId, tenants.id))
    .where(eq(organizations.slug, orgSlug))
    .orderBy(desc(tenants.createdAt))
    .limit(1)

  return tenant ?? null
}

async function getOrganizationSummaryBySlug(orgSlug: string) {
  const db = getDb()
  const [organization] = await db
    .select({
      externalOrganizationId: organizations.externalId,
      organizationId: organizations.id,
      organizationName: organizations.name,
      organizationSlug: organizations.slug,
    })
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1)

  return organization ?? null
}

export function buildPlatformInitialProvisioningCreditGrantInput(input: {
  tenantId: string
}) {
  const grantInput = buildInitialWorkspaceCreditGrantInput(input)

  return {
    billableUnits: 0,
    creditsDeltaMilli: grantInput.creditsDeltaMilli,
    description: grantInput.description,
    entryType: CREDIT_LEDGER_ENTRY_TYPES.manualGrant,
    sourceId: grantInput.sourceId,
    sourceType: grantInput.sourceType,
    tenantId: input.tenantId,
  } as const
}

export function buildPlatformProvisioningJobInput(input: {
  provisioningStrategy: PlatformProvisioningStrategy
  tenantId: string
}) {
  return buildInitialWorkspaceRuntimeProvisioningJobInput(input)
}

async function hasQueuedTenantServerDeleteJob(tenantId: string) {
  const db = getDb()
  const [job] = await db
    .select({
      id: jobRuns.id,
    })
    .from(jobRuns)
    .where(
      and(
        eq(jobRuns.jobType, JOB_TYPES.deleteTenantServer),
        eq(jobRuns.tenantId, tenantId),
        inArray(jobRuns.status, ["queued", "running"]),
      ),
    )
    .limit(1)

  return Boolean(job)
}

async function hasQueuedWorkspaceDeleteJob(organizationId: string) {
  const db = getDb()
  const queuedJobs = await db
    .select({
      id: jobRuns.id,
      payloadJson: jobRuns.payloadJson,
    })
    .from(jobRuns)
    .where(
      and(
        eq(jobRuns.jobType, JOB_TYPES.deleteWorkspace),
        inArray(jobRuns.status, ["queued", "running"]),
      ),
    )

  return queuedJobs.some((job) => {
    const payload = recordFromUnknown(job.payloadJson)
    return payload?.organizationId === organizationId
  })
}

async function getTenantCreditBalanceSummary(tenantId: string) {
  const db = getDb()
  const [summary] = await db
    .select({
      currentBalanceCreditsMilli: sql`coalesce(sum(${creditLedgerEntries.creditsDeltaMilli}), 0)`,
    })
    .from(creditLedgerEntries)
    .where(eq(creditLedgerEntries.tenantId, tenantId))

  return {
    currentBalanceCreditsMilli: numberFromValue(
      summary?.currentBalanceCreditsMilli,
    ),
  }
}

export async function getPlatformOrganizations(input: {
  userExternalId: string
}) {
  const db = getDb()
  const organizationRows = await db
    .select({
      id: organizations.id,
      isReady: organizations.isReady,
      locale: organizations.locale,
      name: organizations.name,
      slug: organizations.slug,
      timeFormatPreference: organizations.timeFormatPreference,
      timezone: organizations.timezone,
    })
    .from(organizations)
    .orderBy(asc(organizations.name), asc(organizations.slug))

  if (organizationRows.length === 0) {
    return []
  }

  const configuredRuntimeImage = getApiEnv().RUNTIME_OPENCLAW_IMAGE ?? null
  const configuredRuntimeImageVersion =
    extractRuntimeImageVersion(configuredRuntimeImage)
  const organizationIds = organizationRows.map((organization) => organization.id)
  const tenantRows = await db
    .select({
      createdAt: tenants.createdAt,
      id: tenants.id,
      ipv4: tenantServers.ipv4,
      organizationId: tenants.organizationId,
      name: tenants.name,
      provisioningStrategy: tenantServers.provisioningStrategy,
      serverStatus: tenantServers.status,
      status: tenants.status,
      sourceImage: tenantServers.sourceImage,
    })
    .from(tenants)
    .leftJoin(tenantServers, eq(tenantServers.tenantId, tenants.id))
    .where(inArray(tenants.organizationId, organizationIds))
    .orderBy(desc(tenants.createdAt))

  const latestTenantByOrganizationId = new Map<
    string,
    (typeof tenantRows)[number]
  >()

  for (const tenant of tenantRows) {
    if (!latestTenantByOrganizationId.has(tenant.organizationId)) {
      latestTenantByOrganizationId.set(tenant.organizationId, tenant)
    }
  }

  const tenantIds = Array.from(latestTenantByOrganizationId.values()).map(
    (tenant) => tenant.id,
  )
  const observedRuntimeImagesByTenant = await getObservedRuntimeImagesByTenant(
    Array.from(latestTenantByOrganizationId.values()).map((tenant) => ({
      id: tenant.id,
      serverStatus: tenant.serverStatus,
      status: tenant.status,
    })),
  )

  const slackRows =
    tenantIds.length === 0
      ? []
      : await db
          .select({
            connectedAt: tenantIntegrations.connectedAt,
            externalAccountId: integrationOauthConnections.externalAccountId,
            externalAccountLabel:
              integrationOauthConnections.externalAccountLabel,
            lastError: tenantIntegrations.lastError,
            lastErrorAt: tenantIntegrations.lastErrorAt,
            status: tenantIntegrations.status,
            tenantId: tenantIntegrations.tenantId,
          })
          .from(tenantIntegrations)
          .leftJoin(
            integrationOauthConnections,
            eq(
              integrationOauthConnections.tenantIntegrationId,
              tenantIntegrations.id,
            ),
          )
          .where(
            and(
              inArray(tenantIntegrations.tenantId, tenantIds),
              eq(tenantIntegrations.providerKey, "slack"),
            ),
          )

  const slackByTenantId = new Map<
    string,
    {
      connectedAt: Date | null
      lastError: string | null
      lastErrorAt: Date | null
      status: string
      teamId: string | null
      teamName: string | null
    }
  >()

  for (const row of slackRows) {
    if (slackByTenantId.has(row.tenantId)) {
      continue
    }

    const teamId =
      typeof row.externalAccountId === "string" ? row.externalAccountId : null
    const teamName =
      typeof row.externalAccountLabel === "string"
        ? row.externalAccountLabel
        : null

    slackByTenantId.set(row.tenantId, {
      connectedAt: row.connectedAt,
      lastError: row.lastError,
      lastErrorAt: row.lastErrorAt,
      status: row.status,
      teamId,
      teamName,
    })
  }

  const latestApplyRunRows =
    tenantIds.length === 0
      ? []
      : await db
          .select({
            desiredStateVersion: tenantApplyRuns.desiredStateVersion,
            error: tenantApplyRuns.error,
            finishedAt: tenantApplyRuns.finishedAt,
            startedAt: tenantApplyRuns.startedAt,
            status: tenantApplyRuns.status,
            tenantId: tenantApplyRuns.tenantId,
          })
          .from(tenantApplyRuns)
          .where(inArray(tenantApplyRuns.tenantId, tenantIds))
          .orderBy(desc(tenantApplyRuns.createdAt))

  const latestApplyRunByTenantId = new Map<
    string,
    (typeof latestApplyRunRows)[number]
  >()

  for (const row of latestApplyRunRows) {
    if (!latestApplyRunByTenantId.has(row.tenantId)) {
      latestApplyRunByTenantId.set(row.tenantId, row)
    }
  }

  const latestJobRows =
    tenantIds.length === 0
      ? []
      : await db
          .select({
            attempt: jobRuns.attempt,
            createdAt: jobRuns.createdAt,
            error: jobRuns.error,
            finishedAt: jobRuns.finishedAt,
            id: jobRuns.id,
            jobType: jobRuns.jobType,
            payloadJson: jobRuns.payloadJson,
            startedAt: jobRuns.startedAt,
            status: jobRuns.status,
            tenantId: jobRuns.tenantId,
          })
          .from(jobRuns)
          .where(inArray(jobRuns.tenantId, tenantIds))
          .orderBy(desc(jobRuns.createdAt))

  const latestJobByTenantId = new Map<string, (typeof latestJobRows)[number]>()

  for (const row of latestJobRows) {
    if (row.tenantId && !latestJobByTenantId.has(row.tenantId)) {
      latestJobByTenantId.set(row.tenantId, row)
    }
  }

  const latestJobIds = Array.from(latestJobByTenantId.values()).map((row) => row.id)
  const latestJobEventRows =
    latestJobIds.length === 0
      ? []
      : await db
          .select({
            createdAt: jobEvents.createdAt,
            eventType: jobEvents.eventType,
            jobRunId: jobEvents.jobRunId,
            message: jobEvents.message,
          })
          .from(jobEvents)
          .where(inArray(jobEvents.jobRunId, latestJobIds))
          .orderBy(desc(jobEvents.createdAt))

  const jobEventsByJobId = buildJobEventMap(latestJobEventRows)

  return organizationRows.map((organization) => {
    const tenant = latestTenantByOrganizationId.get(organization.id) ?? null
    const observedRuntimeImage = tenant
      ? (observedRuntimeImagesByTenant.get(tenant.id) ?? null)
      : null

    return {
      configuredRuntimeImage,
      configuredRuntimeImageVersion,
      id: organization.id,
      isReady: organization.isReady,
      locale: organization.locale,
      name: organization.name,
      observedRuntimeImage,
      observedRuntimeImageVersion: extractRuntimeImageVersion(observedRuntimeImage),
      slackIntegration: buildSlackIntegrationSummary(
        tenant ? slackByTenantId.get(tenant.id) : null,
      ),
      slug: organization.slug,
      tenant: tenant
        ? {
            id: tenant.id,
            ipv4: tenant.ipv4,
            latestApplyRun: buildApplyRunSummary(
              latestApplyRunByTenantId.get(tenant.id),
            ),
            latestJob: buildJobSummary(
              latestJobByTenantId.get(tenant.id),
              jobEventsByJobId,
            ),
            name: tenant.name,
            provisioningStrategy: tenant.provisioningStrategy,
            serverStatus: tenant.serverStatus,
            status: tenant.status,
            sourceImage: tenant.sourceImage,
          }
        : null,
      timeFormatPreference: organization.timeFormatPreference,
      timezone: organization.timezone,
    }
  })
}

export async function createPlatformOrganization(input: {
  name: string
  slug?: string
  userExternalId: string
}) {
  const workspaceName = input.name.trim()
  const slug = await resolvePlatformOrganizationSlug({
    name: workspaceName,
    slug: input.slug,
  })
  const createdWorkOsOrganization =
    await getPlatformWorkOsClient().organizations.createOrganization({
      name: workspaceName,
    })
  let createdOrganization:
    | {
        id: string
        isReady: boolean
        locale: string
        name: string
        slug: string
        timeFormatPreference: string
        timezone: string
      }
    | undefined

  try {
    const [insertedOrganization] = await getDb()
      .insert(organizations)
      .values({
        externalId: createdWorkOsOrganization.id,
        isReady: false,
        name: workspaceName,
        slug,
      })
      .returning({
        id: organizations.id,
        isReady: organizations.isReady,
        locale: organizations.locale,
        name: organizations.name,
        slug: organizations.slug,
        timeFormatPreference: organizations.timeFormatPreference,
        timezone: organizations.timezone,
      })

    createdOrganization = insertedOrganization
  } catch (error) {
    await deleteWorkOsOrganizationBestEffort(createdWorkOsOrganization.id)
    throw error
  }

  if (!createdOrganization) {
    await deleteWorkOsOrganizationBestEffort(createdWorkOsOrganization.id)
    throw new Error("Failed to create platform organization")
  }

  try {
    await addCurrentUserAsPlatformOrganizationAdmin({
      orgSlug: createdOrganization.slug,
      userExternalId: input.userExternalId,
    })
  } catch (error) {
    await getDb()
      .delete(organizations)
      .where(eq(organizations.id, createdOrganization.id))
      .catch(() => undefined)
    await deleteWorkOsOrganizationBestEffort(createdWorkOsOrganization.id)
    throw error
  }

  return {
    configuredRuntimeImage: getApiEnv().RUNTIME_OPENCLAW_IMAGE ?? null,
    configuredRuntimeImageVersion: extractRuntimeImageVersion(
      getApiEnv().RUNTIME_OPENCLAW_IMAGE ?? null,
    ),
    id: createdOrganization.id,
    isReady: createdOrganization.isReady,
    locale: createdOrganization.locale,
    name: createdOrganization.name,
    observedRuntimeImage: null,
    observedRuntimeImageVersion: null,
    slackIntegration: null,
    slug: createdOrganization.slug,
    tenant: null,
    timeFormatPreference: createdOrganization.timeFormatPreference,
    timezone: createdOrganization.timezone,
  }
}

export async function addCurrentUserAsPlatformOrganizationAdmin(input: {
  orgSlug: string
  userExternalId: string
}) {
  const db = getDb()
  const now = new Date()
  const [organization] = await db
    .select({
      externalId: organizations.externalId,
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
    })
    .from(organizations)
    .where(eq(organizations.slug, input.orgSlug))
    .limit(1)

  if (!organization) {
    throw new Error("Platform organization not found")
  }

  const [user] = await db
    .select({
      id: users.id,
    })
    .from(users)
    .where(eq(users.externalId, input.userExternalId))
    .limit(1)

  if (!user) {
    throw new Error("Platform user not found")
  }

  const organizationExternalId =
    await ensurePlatformOrganizationWorkOsProjection({
      externalId: organization.externalId,
      id: organization.id,
      name: organization.name,
    })
  const workOsMembership = await getOrCreatePlatformAdminMembership({
    organizationExternalId,
    userExternalId: input.userExternalId,
  })
  const role = getWorkOsMembershipRoleSlug(workOsMembership)
  const status = getWorkOsMembershipStatus(workOsMembership)

  const [membership] = await db
    .insert(memberships)
    .values({
      externalId: workOsMembership.id,
      lastSyncedAt: now,
      organizationId: organization.id,
      role,
      status,
      userId: user.id,
    })
    .onConflictDoUpdate({
      target: [memberships.userId, memberships.organizationId],
      set: {
        externalId: workOsMembership.id,
        lastSyncedAt: now,
        removedAt: null,
        role,
        status,
        updatedAt: now,
      },
    })
    .returning({
      id: memberships.id,
      organizationId: memberships.organizationId,
      role: memberships.role,
      status: memberships.status,
    })

  if (!membership) {
    throw new Error("Failed to add platform organization admin")
  }

  return {
    membership: {
      id: membership.id,
      organizationId: membership.organizationId,
      organizationSlug: organization.slug,
      role: membership.role,
      status: membership.status,
    },
  }
}

export async function getPlatformOrganizationDetail(input: {
  orgSlug: string
  userExternalId: string
}) {
  const db = getDb()
  const [organization] = await db
    .select({
      id: organizations.id,
      isReady: organizations.isReady,
      locale: organizations.locale,
      name: organizations.name,
      slug: organizations.slug,
      timeFormatPreference: organizations.timeFormatPreference,
      timezone: organizations.timezone,
    })
    .from(organizations)
    .where(eq(organizations.slug, input.orgSlug))
    .limit(1)

  if (!organization) {
    return null
  }

  const configuredRuntimeImage = getApiEnv().RUNTIME_OPENCLAW_IMAGE ?? null
  const configuredRuntimeImageVersion =
    extractRuntimeImageVersion(configuredRuntimeImage)

  const [tenant] = await db
    .select({
      createdAt: tenants.createdAt,
      id: tenants.id,
      ipv4: tenantServers.ipv4,
      name: tenants.name,
      provisioningStrategy: tenantServers.provisioningStrategy,
      serverStatus: tenantServers.status,
      status: tenants.status,
      sourceImage: tenantServers.sourceImage,
    })
    .from(tenants)
    .leftJoin(tenantServers, eq(tenantServers.tenantId, tenants.id))
    .where(eq(tenants.organizationId, organization.id))
    .orderBy(desc(tenants.createdAt))
    .limit(1)

  if (!tenant) {
    return {
      billing: null,
      configuredRuntimeImage,
      configuredRuntimeImageVersion,
      id: organization.id,
      isReady: organization.isReady,
      locale: organization.locale,
      name: organization.name,
      observedRuntimeImage: null,
      observedRuntimeImageVersion: null,
      slackIntegration: null,
      slug: organization.slug,
      tenant: null,
      timeFormatPreference: organization.timeFormatPreference,
      timezone: organization.timezone,
    }
  }

  const [
    slackRows,
    applyRunRows,
    recentJobRows,
    recentEventRows,
    latestDesiredStateVersion,
    openAiProvider,
    observedRuntimeImagesByTenant,
    billingOverview,
  ] = await Promise.all([
    db
      .select({
        connectedAt: tenantIntegrations.connectedAt,
        externalAccountId: integrationOauthConnections.externalAccountId,
        externalAccountLabel: integrationOauthConnections.externalAccountLabel,
        lastError: tenantIntegrations.lastError,
        lastErrorAt: tenantIntegrations.lastErrorAt,
        status: tenantIntegrations.status,
      })
      .from(tenantIntegrations)
      .leftJoin(
        integrationOauthConnections,
        eq(
          integrationOauthConnections.tenantIntegrationId,
          tenantIntegrations.id,
        ),
      )
      .where(
        and(
          eq(tenantIntegrations.tenantId, tenant.id),
          eq(tenantIntegrations.providerKey, "slack"),
        ),
      )
      .limit(1),
    db
      .select({
        createdAt: tenantApplyRuns.createdAt,
        desiredStateVersion: tenantApplyRuns.desiredStateVersion,
        error: tenantApplyRuns.error,
        finishedAt: tenantApplyRuns.finishedAt,
        id: tenantApplyRuns.id,
        restartStderr: tenantApplyRuns.restartStderr,
        restartStdout: tenantApplyRuns.restartStdout,
        startedAt: tenantApplyRuns.startedAt,
        status: tenantApplyRuns.status,
        verifyStderr: tenantApplyRuns.verifyStderr,
        verifyStdout: tenantApplyRuns.verifyStdout,
      })
      .from(tenantApplyRuns)
      .where(eq(tenantApplyRuns.tenantId, tenant.id))
      .orderBy(desc(tenantApplyRuns.createdAt))
      .limit(8),
    db
      .select({
        attempt: jobRuns.attempt,
        createdAt: jobRuns.createdAt,
        error: jobRuns.error,
        finishedAt: jobRuns.finishedAt,
        id: jobRuns.id,
        jobType: jobRuns.jobType,
        payloadJson: jobRuns.payloadJson,
        resultJson: jobRuns.resultJson,
        startedAt: jobRuns.startedAt,
        status: jobRuns.status,
      })
      .from(jobRuns)
      .where(eq(jobRuns.tenantId, tenant.id))
      .orderBy(desc(jobRuns.createdAt))
      .limit(50),
    db
      .select({
        createdAt: jobEvents.createdAt,
        eventType: jobEvents.eventType,
        jobRunId: jobEvents.jobRunId,
        jobStatus: jobRuns.status,
        jobType: jobRuns.jobType,
        message: jobEvents.message,
        payloadJson: jobRuns.payloadJson,
      })
      .from(jobEvents)
      .innerJoin(jobRuns, eq(jobRuns.id, jobEvents.jobRunId))
      .where(eq(jobRuns.tenantId, tenant.id))
      .orderBy(desc(jobEvents.createdAt))
      .limit(200),
    getLatestDesiredStateVersion(tenant.id),
    getTenantOpenAiProviderSummary(tenant.id),
    getObservedRuntimeImagesByTenant([
      {
        id: tenant.id,
        serverStatus: tenant.serverStatus,
        status: tenant.status,
      },
    ]),
    getWorkspaceBillingOverview({
      organizationId: organization.id,
    }),
  ])

  const recentJobIds = recentJobRows.map((job) => job.id)
  const recentJobEventRows =
    recentJobIds.length === 0
      ? []
      : await db
          .select({
            createdAt: jobEvents.createdAt,
            eventType: jobEvents.eventType,
            jobRunId: jobEvents.jobRunId,
            message: jobEvents.message,
          })
          .from(jobEvents)
          .where(inArray(jobEvents.jobRunId, recentJobIds))
          .orderBy(desc(jobEvents.createdAt))
          .limit(500)
  const jobEventsByJobId = buildJobEventMap(recentJobEventRows)

  const slackRow = slackRows[0] ?? null
  const slackIntegration = buildSlackIntegrationSummary(
    slackRow
      ? {
          connectedAt: slackRow.connectedAt,
          lastError: slackRow.lastError,
          lastErrorAt: slackRow.lastErrorAt,
          status: slackRow.status,
          teamId:
            typeof slackRow.externalAccountId === "string"
              ? slackRow.externalAccountId
              : null,
          teamName:
            typeof slackRow.externalAccountLabel === "string"
              ? slackRow.externalAccountLabel
              : null,
        }
      : null,
  )

  const observedRuntimeImage = observedRuntimeImagesByTenant.get(tenant.id) ?? null

  return {
    billing: tenant
      ? {
          currentBalanceCreditsMilli:
            billingOverview.balance.currentBalanceCreditsMilli,
          currentPeriodEnd: billingOverview.subscription?.currentPeriodEnd ?? null,
          currentPeriodStart:
            billingOverview.subscription?.currentPeriodStart ?? null,
          totalDebitedCreditsMilli:
            billingOverview.balance.totalDebitedCreditsMilli,
          totalGrantedCreditsMilli:
            billingOverview.balance.totalGrantedCreditsMilli,
        }
      : null,
    configuredRuntimeImage,
    configuredRuntimeImageVersion,
    id: organization.id,
    isReady: organization.isReady,
    locale: organization.locale,
    name: organization.name,
    observedRuntimeImage,
    observedRuntimeImageVersion: extractRuntimeImageVersion(observedRuntimeImage),
    slackIntegration,
    slug: organization.slug,
    tenant: {
      id: tenant.id,
      ipv4: tenant.ipv4,
      latestApplyRun: buildApplyRunSummary(applyRunRows[0]),
      latestDesiredStateVersion,
      latestJob: buildJobSummary(recentJobRows[0], jobEventsByJobId),
      name: tenant.name,
      openAiProvider,
      provisioningStrategy: tenant.provisioningStrategy,
      recentApplyRuns: applyRunRows.map((row) => ({
        createdAt: row.createdAt,
        desiredStateVersion: row.desiredStateVersion,
        error: row.error,
        finishedAt: row.finishedAt,
        id: row.id,
        restartStderr: row.restartStderr,
        restartStdout: row.restartStdout,
        startedAt: row.startedAt,
        status: row.status,
        verifyStderr: row.verifyStderr,
        verifyStdout: row.verifyStdout,
      })),
      recentEvents: recentEventRows.map((row) => {
        const payloadJson = recordFromUnknown(row.payloadJson)

        return {
          createdAt: row.createdAt,
          eventType: row.eventType,
          id: `${row.jobRunId}:${row.eventType}:${row.createdAt.toISOString()}`,
          jobRunId: row.jobRunId,
          jobStatus: row.jobStatus,
          jobType: row.jobType,
          message: row.message,
          step: typeof payloadJson?.step === "string" ? payloadJson.step : null,
        }
      }),
      recentJobs: recentJobRows.map((row) => {
        const payloadJson = recordFromUnknown(row.payloadJson)

        return {
          attempt: row.attempt,
          createdAt: row.createdAt,
          error: row.error,
          events: jobEventsByJobId.get(row.id) ?? [],
          finishedAt: row.finishedAt,
          id: row.id,
          jobType: row.jobType,
          result: recordFromUnknown(row.resultJson),
          startedAt: row.startedAt,
          status: row.status,
          step: typeof payloadJson?.step === "string" ? payloadJson.step : null,
        }
      }),
      serverStatus: tenant.serverStatus,
      status: tenant.status,
      sourceImage: tenant.sourceImage,
    },
    timeFormatPreference: organization.timeFormatPreference,
    timezone: organization.timezone,
  }
}

export async function getPlatformUsage(input: {
  from: Date
  orgSlug: string
  to: Date
  userExternalId: string
}) {
  const tenant = await getLatestTenantForOrganizationSlug(input.orgSlug)

  if (!tenant) {
    return null
  }

  const db = getDb()
  const rangeMs = input.to.getTime() - input.from.getTime()
  const useHourlyGranularity = rangeMs <= 48 * 60 * 60 * 1000
  const bucketTruncExpression = useHourlyGranularity
    ? sql<Date>`date_trunc('hour', ${providerUsageBuckets.bucketStartAt})`
    : sql<Date>`date_trunc('day', ${providerUsageBuckets.bucketStartAt})`
  const totalTokensExpression = sql`coalesce(sum(coalesce(${providerUsageBuckets.inputTokens}, 0) + coalesce(${providerUsageBuckets.outputTokens}, 0)), 0)`
  const requestCountExpression = sql`coalesce(sum(coalesce(${providerUsageBuckets.itemCount}, 0)), 0)`
  const creditsBurnedMilliExpression = sql`coalesce(sum(coalesce(${providerUsageSettlements.creditsBurnedMilli}, 0)), 0)`
  const providerCostMicrosExpression = sql`coalesce(sum(coalesce(${providerUsageSettlements.providerCostMicros}, 0)), 0)`
  const rangeFilter = and(
    eq(providerUsageBuckets.tenantId, tenant.tenantId),
    gte(providerUsageBuckets.bucketStartAt, input.from),
    lte(providerUsageBuckets.bucketStartAt, input.to),
  )
  const settlementJoin = eq(
    providerUsageSettlements.providerUsageBucketId,
    providerUsageBuckets.id,
  )
  const [summaryRows, timeSeriesRows, usageTypeRows, modelRows] =
    await Promise.all([
      db
        .select({
          activeApiKeys: sql`count(distinct nullif(${providerUsageBuckets.externalApiKeyId}, ''))`,
          activeModels: sql`count(distinct nullif(${providerUsageBuckets.model}, ''))`,
          totalCreditsBurnedMilli: creditsBurnedMilliExpression,
          totalInputTokens: sql`coalesce(sum(${providerUsageBuckets.inputTokens}), 0)`,
          totalOutputTokens: sql`coalesce(sum(${providerUsageBuckets.outputTokens}), 0)`,
          totalProviderCostMicros: providerCostMicrosExpression,
          totalRequests: requestCountExpression,
        })
        .from(providerUsageBuckets)
        .leftJoin(providerUsageSettlements, settlementJoin)
        .where(rangeFilter),
      db
        .select({
          bucketTime: bucketTruncExpression,
          creditsBurnedMilli: creditsBurnedMilliExpression,
          providerCostMicros: providerCostMicrosExpression,
          inputAudioTokens: sql`coalesce(sum(${providerUsageBuckets.inputAudioTokens}), 0)`,
          inputCachedTokens: sql`coalesce(sum(${providerUsageBuckets.inputCachedTokens}), 0)`,
          inputImageTokens: sql`coalesce(sum(${providerUsageBuckets.inputImageTokens}), 0)`,
          inputTextTokens: sql`coalesce(sum(${providerUsageBuckets.inputTextTokens}), 0)`,
          inputTokens: sql`coalesce(sum(${providerUsageBuckets.inputTokens}), 0)`,
          outputAudioTokens: sql`coalesce(sum(${providerUsageBuckets.outputAudioTokens}), 0)`,
          outputTextTokens: sql`coalesce(sum(${providerUsageBuckets.outputTextTokens}), 0)`,
          outputTokens: sql`coalesce(sum(${providerUsageBuckets.outputTokens}), 0)`,
          requestCount: requestCountExpression,
        })
        .from(providerUsageBuckets)
        .leftJoin(providerUsageSettlements, settlementJoin)
        .where(rangeFilter)
        .groupBy(bucketTruncExpression)
        .orderBy(asc(bucketTruncExpression)),
      db
        .select({
          creditsBurnedMilli: creditsBurnedMilliExpression,
          providerCostMicros: providerCostMicrosExpression,
          requestCount: requestCountExpression,
          totalTokens: totalTokensExpression,
          usageType: providerUsageBuckets.usageType,
        })
        .from(providerUsageBuckets)
        .leftJoin(providerUsageSettlements, settlementJoin)
        .where(rangeFilter)
        .groupBy(providerUsageBuckets.usageType)
        .orderBy(desc(totalTokensExpression), asc(providerUsageBuckets.usageType)),
      db
        .select({
          creditsBurnedMilli: creditsBurnedMilliExpression,
          inputTokens: sql`coalesce(sum(${providerUsageBuckets.inputTokens}), 0)`,
          model: providerUsageBuckets.model,
          outputTokens: sql`coalesce(sum(${providerUsageBuckets.outputTokens}), 0)`,
          providerCostMicros: providerCostMicrosExpression,
          requestCount: requestCountExpression,
          totalTokens: totalTokensExpression,
          usageType: providerUsageBuckets.usageType,
        })
        .from(providerUsageBuckets)
        .leftJoin(providerUsageSettlements, settlementJoin)
        .where(and(rangeFilter, ne(providerUsageBuckets.model, "")))
        .groupBy(providerUsageBuckets.usageType, providerUsageBuckets.model)
        .orderBy(desc(totalTokensExpression), desc(requestCountExpression))
        .limit(8),
    ])

  const summary = summaryRows[0] ?? {
    activeApiKeys: 0,
    activeModels: 0,
    totalCreditsBurnedMilli: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalProviderCostMicros: 0,
    totalRequests: 0,
  }

  return {
    summary: {
      activeApiKeys: numberFromValue(summary.activeApiKeys),
      activeModels: numberFromValue(summary.activeModels),
      totalCreditsBurnedMilli: numberFromValue(summary.totalCreditsBurnedMilli),
      totalInputTokens: numberFromValue(summary.totalInputTokens),
      totalOutputTokens: numberFromValue(summary.totalOutputTokens),
      totalProviderCostMicros: numberFromValue(summary.totalProviderCostMicros),
      totalRequests: numberFromValue(summary.totalRequests),
    },
    timeSeries: timeSeriesRows.map((row) => ({
      bucketTime: (dateFromValue(row.bucketTime) ?? new Date(0)).toISOString(),
      creditsBurnedMilli: numberFromValue(row.creditsBurnedMilli),
      inputAudioTokens: numberFromValue(row.inputAudioTokens),
      inputCachedTokens: numberFromValue(row.inputCachedTokens),
      inputImageTokens: numberFromValue(row.inputImageTokens),
      inputTextTokens: numberFromValue(row.inputTextTokens),
      inputTokens: numberFromValue(row.inputTokens),
      outputAudioTokens: numberFromValue(row.outputAudioTokens),
      outputTextTokens: numberFromValue(row.outputTextTokens),
      outputTokens: numberFromValue(row.outputTokens),
      providerCostMicros: numberFromValue(row.providerCostMicros),
      requestCount: numberFromValue(row.requestCount),
    })),
    usageByModel: modelRows.map((row) => ({
      creditsBurnedMilli: numberFromValue(row.creditsBurnedMilli),
      inputTokens: numberFromValue(row.inputTokens),
      model: row.model,
      outputTokens: numberFromValue(row.outputTokens),
      providerCostMicros: numberFromValue(row.providerCostMicros),
      requestCount: numberFromValue(row.requestCount),
      totalTokens: numberFromValue(row.totalTokens),
      usageType: row.usageType,
    })),
    usageByType: usageTypeRows.map((row) => ({
      creditsBurnedMilli: numberFromValue(row.creditsBurnedMilli),
      providerCostMicros: numberFromValue(row.providerCostMicros),
      requestCount: numberFromValue(row.requestCount),
      totalTokens: numberFromValue(row.totalTokens),
      usageType: row.usageType,
    })),
  }
}

export async function getTenantRuntimeGatewayToken(tenantId: string) {
  const db = getDb()
  const [secret] = await db
    .select({
      ciphertext: tenantRuntimeSecrets.ciphertext,
    })
    .from(tenantRuntimeSecrets)
    .where(
      and(
        eq(tenantRuntimeSecrets.tenantId, tenantId),
        eq(tenantRuntimeSecrets.secretType, OPENCLAW_GATEWAY_TOKEN_SECRET_TYPE),
      ),
    )
    .limit(1)

  return secret ? decryptControlPlaneSecret(secret.ciphertext) : null
}

export async function getPlatformJobStatus(input: {
  jobId: string
  orgSlug: string
  userExternalId: string
}) {
  const organization = await getOrganizationSummaryBySlug(input.orgSlug)

  if (!organization) {
    return null
  }

  const tenant = await getLatestTenantForOrganizationSlug(input.orgSlug)

  const db = getDb()
  const [job] = await db
    .select({
      error: jobRuns.error,
      finishedAt: jobRuns.finishedAt,
      payloadJson: jobRuns.payloadJson,
      status: jobRuns.status,
      tenantId: jobRuns.tenantId,
    })
    .from(jobRuns)
    .where(eq(jobRuns.id, input.jobId))
    .limit(1)

  if (!job) {
    return null
  }

  if (job.tenantId) {
    if (!tenant || job.tenantId !== tenant.tenantId) {
      return null
    }
  } else {
    const payloadJson = recordFromUnknown(job.payloadJson)
    const payloadOrganizationId =
      typeof payloadJson?.organizationId === "string"
        ? payloadJson.organizationId
        : null
    const payloadOrganizationSlug =
      typeof payloadJson?.organizationSlug === "string"
        ? payloadJson.organizationSlug
        : null

    if (
      payloadOrganizationId !== organization.organizationId &&
      payloadOrganizationSlug !== organization.organizationSlug
    ) {
      return null
    }
  }

  return {
    error: job.error,
    finishedAt: job.finishedAt,
    ok: job.status === "succeeded",
    status: job.status,
  }
}

async function getDesiredStateVersionForApply(tenantId: string) {
  const version = await getLatestDesiredStateVersion(tenantId)

  if (version === null) {
    throw new Error("No desired state exists for this tenant yet.")
  }

  return {
    changed: false,
    version,
  }
}

export async function triggerPlatformOrganizationApply(input: {
  orgSlug: string
  userExternalId: string
}) {
  const tenant = await getLatestTenantForOrganizationSlug(input.orgSlug)

  if (!tenant) {
    throw new Error("Organization tenant not found")
  }

  const desiredState = await getDesiredStateVersionForApply(tenant.tenantId)
  const jobId = await enqueueJob({
    jobType: JOB_TYPES.applyTenantConfig,
    payload: {
      desiredStateVersion: desiredState.version,
      tenantId: tenant.tenantId,
    },
  })
  const db = getDb()
  await db.insert(tenantApplyRuns).values({
    desiredStateVersion: desiredState.version,
    jobRunId: jobId,
    status: "queued",
    tenantId: tenant.tenantId,
  })

  return {
    desiredStateChanged: desiredState.changed,
    desiredStateVersion: desiredState.version,
    jobId,
    queued: true,
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName,
  }
}

export async function triggerPlatformOrganizationSyncSkills(input: {
  orgSlug: string
  userExternalId: string
}) {
  const tenant = await getLatestTenantForOrganizationSlug(input.orgSlug)

  if (!tenant) {
    throw new Error("Organization tenant not found")
  }

  const syncResult = await syncDefaultTenantManagedSkillsForTenant({
    tenantId: tenant.tenantId,
  })
  const desiredStateVersion =
    syncResult.desiredStateVersion ??
    (await getDesiredStateVersionForApply(tenant.tenantId)).version
  const jobId = await enqueueJob({
    jobType: JOB_TYPES.applyTenantConfig,
    payload: {
      desiredStateVersion,
      tenantId: tenant.tenantId,
    },
  })
  const db = getDb()
  await db.insert(tenantApplyRuns).values({
    desiredStateVersion,
    jobRunId: jobId,
    status: "queued",
    tenantId: tenant.tenantId,
  })

  return {
    desiredStateChanged: syncResult.changed,
    desiredStateVersion,
    jobId,
    queued: true,
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName,
  }
}

export async function triggerPlatformOrganizationProvisionServer(input: {
  orgSlug: string
  provisioningStrategy: PlatformProvisioningStrategy
  userExternalId: string
}) {
  const organization = await getOrganizationSummaryBySlug(input.orgSlug)

  if (!organization) {
    throw new Error("Platform organization not found")
  }

  await addCurrentUserAsPlatformOrganizationAdmin({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  })

  const provisioning = await ensureInitialWorkspaceRuntimeProvisioning({
    createOrUpdateOnboardingRunForUserExternalId: input.userExternalId,
    failIfTenantServerExists: true,
    organizationId: organization.organizationId,
    provisioningStrategy: input.provisioningStrategy,
  })

  return {
    jobId: provisioning.jobId,
    provisionedTenant: provisioning.provisionedTenant,
    provisioningStrategy: provisioning.provisioningStrategy,
    queued: provisioning.queued,
    tenantId: provisioning.tenantId,
    tenantName: provisioning.tenantName,
  }
}

export async function triggerPlatformOrganizationDeleteTenantServer(input: {
  orgSlug: string
  userExternalId: string
}) {
  const tenant = await getLatestTenantForOrganizationSlug(input.orgSlug)

  if (!tenant) {
    throw new Error("Organization tenant not found")
  }

  if (!tenant.serverId) {
    throw new Error("Organization tenant server not found")
  }

  if (await hasQueuedTenantServerDeleteJob(tenant.tenantId)) {
    throw new Error("Tenant server deletion is already queued or running")
  }

  const jobId = await enqueueJob({
    jobType: JOB_TYPES.deleteTenantServer,
    payload: {
      tenantId: tenant.tenantId,
    },
  })

  return {
    jobId,
    queued: true,
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName,
  }
}

export async function triggerPlatformOrganizationDeployRuntime(input: {
  orgSlug: string
  userExternalId: string
}) {
  const tenant = await getLatestTenantForOrganizationSlug(input.orgSlug)

  if (!tenant) {
    throw new Error("Organization tenant not found")
  }

  const desiredState = await getDesiredStateVersionForApply(tenant.tenantId)
  const jobId = await enqueueJob({
    jobType: JOB_TYPES.applyTenantConfig,
    payload: {
      desiredStateVersion: desiredState.version,
      pullImageFirst: true,
      tenantId: tenant.tenantId,
    },
  })
  const db = getDb()
  await db.insert(tenantApplyRuns).values({
    desiredStateVersion: desiredState.version,
    jobRunId: jobId,
    status: "queued",
    tenantId: tenant.tenantId,
  })

  return {
    desiredStateChanged: desiredState.changed,
    desiredStateVersion: desiredState.version,
    jobId,
    queued: true,
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName,
  }
}

export async function triggerPlatformOrganizationProvisionOpenAiKey(input: {
  orgSlug: string
  userExternalId: string
}) {
  const tenant = await getLatestTenantForOrganizationSlug(input.orgSlug)

  if (!tenant) {
    throw new Error("Organization tenant not found")
  }

  const existingProvider = await getTenantOpenAiProviderSummary(tenant.tenantId)
  const jobId = await enqueueJob({
    jobType: JOB_TYPES.provisionTenantOpenAiKey,
    payload: {
      tenantId: tenant.tenantId,
    },
  })

  return {
    action: existingProvider ? "rotate" : "provision",
    jobId,
    queued: true,
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName,
  }
}

export async function triggerPlatformOrganizationRefreshImage(input: {
  orgSlug: string
  userExternalId: string
}) {
  const tenant = await getLatestTenantForOrganizationSlug(input.orgSlug)

  if (!tenant) {
    throw new Error("Organization tenant not found")
  }

  const jobId = await enqueueJob({
    jobType: JOB_TYPES.refreshRuntimeImage,
    payload: {
      tenantId: tenant.tenantId,
    },
  })

  return {
    jobId,
    queued: true,
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName,
  }
}

export async function triggerPlatformOrganizationDeleteWorkspace(input: {
  orgSlug: string
  userExternalId: string
}) {
  const organization = await getOrganizationSummaryBySlug(input.orgSlug)

  if (!organization) {
    throw new Error("Platform organization not found")
  }

  if (await hasQueuedWorkspaceDeleteJob(organization.organizationId)) {
    throw new Error("Workspace deletion is already queued or running")
  }

  const jobId = await enqueueJob({
    jobType: JOB_TYPES.deleteWorkspace,
    payload: {
      organizationId: organization.organizationId,
      organizationSlug: organization.organizationSlug,
      organizationExternalId: organization.externalOrganizationId,
    },
  })

  return {
    jobId,
    organizationId: organization.organizationId,
    organizationName: organization.organizationName,
    organizationSlug: organization.organizationSlug,
    queued: true,
  }
}

export async function grantPlatformOrganizationCredits(input: {
  credits: number
  note: string
  orgSlug: string
  userExternalId: string
}) {
  const tenant = await getLatestTenantForOrganizationSlug(input.orgSlug)

  if (!tenant) {
    throw new Error("Organization tenant not found")
  }

  const credits = Number(input.credits)
  const creditsDeltaMilli = Math.round(credits * 1_000)
  const note = input.note.trim()

  if (!Number.isFinite(credits) || credits <= 0 || creditsDeltaMilli <= 0) {
    throw new Error("Credits must be a positive number.")
  }

  if (note.length === 0) {
    throw new Error("A reason is required for manual credit grants.")
  }

  const db = getDb()
  const [grant] = await db
    .insert(creditLedgerEntries)
    .values({
      billableUnits: 0,
      creditsDeltaMilli,
      description: `Manual credit grant by ${input.userExternalId}: ${note}`,
      entryType: CREDIT_LEDGER_ENTRY_TYPES.manualGrant,
      sourceId: randomUUID(),
      sourceType: PLATFORM_MANUAL_GRANT_SOURCE_TYPE,
      tenantId: tenant.tenantId,
    })
    .returning({
      creditsDeltaMilli: creditLedgerEntries.creditsDeltaMilli,
      id: creditLedgerEntries.id,
    })

  if (!grant) {
    throw new Error("Failed to create manual credit grant.")
  }

  const balance = await getTenantCreditBalanceSummary(tenant.tenantId)

  return {
    balanceCreditsMilli: balance.currentBalanceCreditsMilli,
    grantedCreditsMilli: grant.creditsDeltaMilli,
    ledgerEntryId: grant.id,
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName,
  }
}

export async function hasPlatformAdminRole(userExternalId: string) {
  const db = getDb()
  const [role] = await db
    .select({
      role: userPlatformRoles.role,
    })
    .from(userPlatformRoles)
    .innerJoin(users, eq(userPlatformRoles.userId, users.id))
    .where(
      and(
        eq(users.externalId, userExternalId),
        eq(userPlatformRoles.role, PLATFORM_ADMIN_ROLE),
      ),
    )
    .limit(1)

  return Boolean(role)
}

export async function getDashboardOrganizations(
  userExternalId: string,
): Promise<WorkspaceSummary[]> {
  const db = getDb()
  const rows = await db
    .select({
      agentPersonalizedAt: organizations.agentPersonalizedAt,
      id: organizations.id,
      isReady: organizations.isReady,
      locale: organizations.locale,
      name: organizations.name,
      slug: organizations.slug,
      timeFormatPreference: organizations.timeFormatPreference,
      timezone: organizations.timezone,
    })
    .from(organizations)
    .orderBy(asc(organizations.name), asc(organizations.slug))

  return rows.map((row) => ({
    agentPersonalizedAt: row.agentPersonalizedAt?.toISOString() ?? null,
    id: row.id,
    isReady: row.isReady,
    locale: row.locale,
    name: row.name,
    slug: row.slug,
    timeFormatPreference: row.timeFormatPreference,
    timezone: row.timezone,
  }))
}
