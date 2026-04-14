import { getDb } from "@otto/feature-integrations-runtime/db/client"
import {
  memberships,
  organizations,
  providerUsageBuckets,
  providerUsageSettlements,
  tenants,
  userPlatformRoles,
  users,
} from "@otto/feature-integrations-runtime/db/schema"
import {
  isReservedWorkspaceSlug,
  normalizeWorkspaceSlug,
} from "@otto/feature-workspace-slugs"
import { WorkOS } from "@workos-inc/node"
import { and, asc, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm"

import { getApiEnv, hasWorkOsConfig } from "../env"

const ACTIVE_WORKSPACE_MEMBERSHIP_STATUS = "active"
const PLATFORM_ADMIN_ROLE = "PLATFORM_ADMIN"

type WorkspaceShellUser = {
  email: string
  firstName?: string | null
  id: string
  lastName?: string | null
}

export type WorkspaceSummary = {
  id: string
  isReady: boolean
  locale: string
  name: string
  slug: string
  timeFormatPreference: string
  timezone: string
}

export async function syncUserFromSession(user: WorkspaceShellUser) {
  const syncedUser = await upsertLocalUser(user)

  if (hasWorkOsConfig(getApiEnv())) {
    await reconcileWorkspaceMembershipsFromWorkOs({
      localUserId: syncedUser.id,
      userExternalId: user.id,
    })
  }

  return syncedUser
}

export async function reconcileWorkspaceMembershipProjectionForUser(
  userExternalId: string,
) {
  if (!hasWorkOsConfig(getApiEnv())) {
    return
  }

  await reconcileWorkspaceMembershipsFromWorkOs({
    userExternalId,
  })
}

export async function syncOrganizationProjectionFromWorkOs(input: {
  organization: {
    id: string
    name: string
  }
}) {
  const db = getDb()

  await db
    .update(organizations)
    .set({
      name: input.organization.name,
      updatedAt: new Date(),
    })
    .where(eq(organizations.externalId, input.organization.id))
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
      id: organizations.id,
      isReady: organizations.isReady,
      locale: organizations.locale,
      name: organizations.name,
      slug: organizations.slug,
      timeFormatPreference: organizations.timeFormatPreference,
      timezone: organizations.timezone,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(
      and(
        eq(users.externalId, userExternalId),
        eq(memberships.status, ACTIVE_WORKSPACE_MEMBERSHIP_STATUS),
      ),
    )
    .orderBy(asc(organizations.name), asc(organizations.slug))

  return rows
}

export async function getWorkspaceSummaryBySlugForUser(input: {
  orgSlug: string
  userExternalId: string
}): Promise<WorkspaceSummary | null> {
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
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(
      and(
        eq(organizations.slug, input.orgSlug),
        eq(users.externalId, input.userExternalId),
        eq(memberships.status, ACTIVE_WORKSPACE_MEMBERSHIP_STATUS),
      ),
    )
    .limit(1)

  return organization ?? null
}

export async function getOrganizationWorkspaceBySlug(input: {
  orgSlug: string
  userExternalId: string
}) {
  const organization = await getWorkspaceSummaryBySlugForUser(input)

  if (!organization) {
    throw new Error("Organization not found")
  }

  const db = getDb()
  const [row] = await db
    .select({
      externalId: organizations.externalId,
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(
      and(
        eq(organizations.id, organization.id),
        eq(users.externalId, input.userExternalId),
        eq(memberships.status, ACTIVE_WORKSPACE_MEMBERSHIP_STATUS),
      ),
    )
    .limit(1)

  if (!row) {
    throw new Error("Organization not found")
  }

  return row
}

export async function getOrganizationTenantForBilling(organizationId: string) {
  const db = getDb()
  const [tenant] = await db
    .select({
      id: tenants.id,
      name: tenants.name,
    })
    .from(tenants)
    .where(eq(tenants.organizationId, organizationId))
    .orderBy(desc(tenants.createdAt))
    .limit(1)

  return tenant ?? null
}

export async function renameOrganization(input: {
  externalOrganizationId: string
  name: string
  organizationId: string
}) {
  const env = getApiEnv()

  if (hasWorkOsConfig(env)) {
    const workos = new WorkOS(env.WORKOS_API_KEY ?? "", {
      clientId: env.WORKOS_CLIENT_ID,
    })

    await workos.organizations.updateOrganization({
      name: input.name,
      organization: input.externalOrganizationId,
    })
  }

  const db = getDb()
  await db
    .update(organizations)
    .set({
      name: input.name,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, input.organizationId))
}

export async function updateOrganizationSlug(input: {
  organizationId: string
  slug: string
}) {
  const db = getDb()
  const [existing] = await db
    .select({
      id: organizations.id,
    })
    .from(organizations)
    .where(eq(organizations.slug, input.slug))
    .limit(1)

  if (existing && existing.id !== input.organizationId) {
    return "slug_taken" as const
  }

  await db
    .update(organizations)
    .set({
      slug: input.slug,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, input.organizationId))

  return "ok" as const
}

export async function updateWorkspaceDateTimePreferences(input: {
  organizationId: string
  locale?: string
  timeFormatPreference?: string
  timezone?: string
}) {
  const db = getDb()
  const [currentOrganization] = await db
    .select({
      locale: organizations.locale,
      timeFormatPreference: organizations.timeFormatPreference,
      timezone: organizations.timezone,
    })
    .from(organizations)
    .where(eq(organizations.id, input.organizationId))
    .limit(1)

  if (!currentOrganization) {
    throw new Error("Organization not found")
  }

  const nextLocale = input.locale ?? currentOrganization.locale
  const nextTimeFormatPreference =
    input.timeFormatPreference ?? currentOrganization.timeFormatPreference
  const nextTimezone = input.timezone ?? currentOrganization.timezone

  await db
    .update(organizations)
    .set({
      locale: nextLocale,
      timeFormatPreference: nextTimeFormatPreference,
      timezone: nextTimezone,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, input.organizationId))

  return {
    applyQueued: false,
    locale: nextLocale,
    timeFormatPreference: nextTimeFormatPreference,
    timezone: nextTimezone,
  }
}

export async function getTenantProviderUsageOverview(input: {
  from: Date
  tenantId: string
  to: Date
}) {
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
    eq(providerUsageBuckets.tenantId, input.tenantId),
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
          bucketStart: bucketTruncExpression,
          creditsBurnedMilli: creditsBurnedMilliExpression,
          inputTokens: sql`coalesce(sum(${providerUsageBuckets.inputTokens}), 0)`,
          outputTokens: sql`coalesce(sum(${providerUsageBuckets.outputTokens}), 0)`,
          requests: requestCountExpression,
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
          requests: requestCountExpression,
          totalTokens: totalTokensExpression,
          usageType: providerUsageBuckets.usageType,
        })
        .from(providerUsageBuckets)
        .leftJoin(providerUsageSettlements, settlementJoin)
        .where(rangeFilter)
        .groupBy(providerUsageBuckets.usageType)
        .orderBy(
          desc(totalTokensExpression),
          asc(providerUsageBuckets.usageType),
        ),
      db
        .select({
          creditsBurnedMilli: creditsBurnedMilliExpression,
          inputTokens: sql`coalesce(sum(${providerUsageBuckets.inputTokens}), 0)`,
          model: providerUsageBuckets.model,
          outputTokens: sql`coalesce(sum(${providerUsageBuckets.outputTokens}), 0)`,
          provider: sql<string>`null`,
          requests: requestCountExpression,
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
      bucketStart:
        dateFromValue(row.bucketStart)?.toISOString() ??
        new Date(0).toISOString(),
      creditsBurnedMilli: numberFromValue(row.creditsBurnedMilli),
      inputTokens: numberFromValue(row.inputTokens),
      outputTokens: numberFromValue(row.outputTokens),
      requests: numberFromValue(row.requests),
    })),
    usageByModel: modelRows.map((row) => ({
      creditsBurnedMilli: numberFromValue(row.creditsBurnedMilli),
      inputTokens: numberFromValue(row.inputTokens),
      model: row.model,
      outputTokens: numberFromValue(row.outputTokens),
      provider: row.provider,
      requests: numberFromValue(row.requests),
    })),
    usageByType: usageTypeRows.map((row) => ({
      creditsBurnedMilli: numberFromValue(row.creditsBurnedMilli),
      providerCostMicros: numberFromValue(row.providerCostMicros),
      requests: numberFromValue(row.requests),
      totalTokens: numberFromValue(row.totalTokens),
      usageType: row.usageType,
    })),
  }
}

async function upsertLocalUser(user: Pick<WorkspaceShellUser, "email" | "id">) {
  const db = getDb()
  const [upsertedUser] = await db
    .insert(users)
    .values({
      externalId: user.id,
      email: user.email,
    })
    .onConflictDoUpdate({
      target: users.externalId,
      set: {
        email: user.email,
        updatedAt: new Date(),
      },
    })
    .returning({
      id: users.id,
    })

  if (!upsertedUser) {
    throw new Error("Failed to upsert workspace user")
  }

  return upsertedUser
}

async function reconcileWorkspaceMembershipsFromWorkOs(input: {
  localUserId?: string
  userExternalId: string
}) {
  const env = getApiEnv()
  const workos = new WorkOS(env.WORKOS_API_KEY ?? "", {
    clientId: env.WORKOS_CLIENT_ID,
  })
  const db = getDb()
  const now = new Date()
  const localUser =
    input.localUserId !== undefined
      ? { id: input.localUserId }
      : await upsertLocalUser(
          await workos.userManagement.getUser(input.userExternalId),
        )
  const workosMemberships = await (
    await workos.userManagement.listOrganizationMemberships({
      userId: input.userExternalId,
    })
  ).autoPagination()
  const externalOrganizationIds = Array.from(
    new Set(workosMemberships.map((membership) => membership.organizationId)),
  )
  const existingOrganizations =
    externalOrganizationIds.length === 0
      ? []
      : await db
          .select({
            externalId: organizations.externalId,
            id: organizations.id,
            name: organizations.name,
          })
          .from(organizations)
          .where(inArray(organizations.externalId, externalOrganizationIds))
  const organizationsByExternalId = new Map(
    existingOrganizations.map((organization) => [
      organization.externalId,
      organization,
    ]),
  )
  const existingMembershipRows = await db
    .select({
      externalId: memberships.externalId,
      id: memberships.id,
      organizationId: memberships.organizationId,
      role: memberships.role,
      status: memberships.status,
    })
    .from(memberships)
    .where(eq(memberships.userId, localUser.id))
  const existingMembershipsByOrgId = new Map(
    existingMembershipRows.map((membership) => [
      membership.organizationId,
      membership,
    ]),
  )
  const seenOrganizationIds = new Set<string>()

  for (const membership of workosMemberships) {
    let localOrganization = organizationsByExternalId.get(
      membership.organizationId,
    )

    if (!localOrganization) {
      const slug = await generateOrganizationSlugFromWorkOs({
        organizationExternalId: membership.organizationId,
        organizationName: membership.organizationName,
      })
      const [createdOrganization] = await db
        .insert(organizations)
        .values({
          externalId: membership.organizationId,
          isReady: false,
          name: membership.organizationName,
          slug,
        })
        .returning({
          externalId: organizations.externalId,
          id: organizations.id,
          name: organizations.name,
        })

      if (!createdOrganization) {
        throw new Error("Failed to create organization projection")
      }

      localOrganization = createdOrganization
      organizationsByExternalId.set(
        createdOrganization.externalId,
        createdOrganization,
      )
    } else if (localOrganization.name !== membership.organizationName) {
      await db
        .update(organizations)
        .set({
          name: membership.organizationName,
          updatedAt: now,
        })
        .where(eq(organizations.id, localOrganization.id))
    }

    const existingMembership = existingMembershipsByOrgId.get(
      localOrganization.id,
    )
    const nextStatus = normalizeWorkspaceMembershipStatus(membership.status)

    if (existingMembership) {
      seenOrganizationIds.add(localOrganization.id)

      if (
        existingMembership.externalId !== membership.id ||
        existingMembership.role !== membership.role.slug ||
        existingMembership.status !== nextStatus
      ) {
        await db
          .update(memberships)
          .set({
            externalId: membership.id,
            lastSyncedAt: now,
            role: membership.role.slug,
            removedAt: null,
            status: nextStatus,
            updatedAt: now,
          })
          .where(eq(memberships.id, existingMembership.id))
      }

      continue
    }

    seenOrganizationIds.add(localOrganization.id)

    await db.insert(memberships).values({
      externalId: membership.id,
      lastSyncedAt: now,
      organizationId: localOrganization.id,
      role: membership.role.slug,
      status: nextStatus,
      userId: localUser.id,
    })
  }

  const staleMembershipIds = existingMembershipRows
    .filter((membership) => !seenOrganizationIds.has(membership.organizationId))
    .map((membership) => membership.id)

  if (staleMembershipIds.length > 0) {
    await db
      .update(memberships)
      .set({
        lastSyncedAt: now,
        removedAt: now,
        status: "removed",
        updatedAt: now,
      })
      .where(inArray(memberships.id, staleMembershipIds))
  }
}

async function generateOrganizationSlugFromWorkOs(input: {
  organizationExternalId: string
  organizationName: string
}) {
  return generateUniqueWorkspaceSlug({
    organizationExternalId: input.organizationExternalId,
    slugSuffixHint: input.organizationExternalId,
    workspaceName: input.organizationName,
  })
}

export async function generateUniqueWorkspaceSlug(input: {
  organizationExternalId?: string | null
  slugSuffixHint?: string | null
  workspaceName: string
}) {
  const db = getDb()
  const baseSlug = normalizeWorkspaceSlug(input.workspaceName) || "workspace"
  const suffixHint = (input.slugSuffixHint ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(-8)
  const fallbackSlug = suffixHint
    ? `${baseSlug}-${suffixHint}`
    : `${baseSlug}-workspace`
  const candidates = [baseSlug, fallbackSlug]

  for (const candidate of candidates) {
    if (isReservedWorkspaceSlug(candidate)) {
      continue
    }

    const [existingOrganization] = await db
      .select({
        externalId: organizations.externalId,
      })
      .from(organizations)
      .where(eq(organizations.slug, candidate))
      .limit(1)

    if (
      !existingOrganization ||
      existingOrganization.externalId === input.organizationExternalId
    ) {
      return candidate
    }
  }

  for (let index = 2; ; index += 1) {
    const candidate = `${fallbackSlug}-${index}`

    if (isReservedWorkspaceSlug(candidate)) {
      continue
    }

    const [existingOrganization] = await db
      .select({
        externalId: organizations.externalId,
      })
      .from(organizations)
      .where(eq(organizations.slug, candidate))
      .limit(1)

    if (
      !existingOrganization ||
      existingOrganization.externalId === input.organizationExternalId
    ) {
      return candidate
    }
  }
}

function normalizeWorkspaceMembershipStatus(status: string) {
  return status.trim().toLowerCase()
}

function dateFromValue(value: unknown) {
  if (value instanceof Date) {
    return value
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
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

  if (typeof value === "string" && value.trim().length > 0) {
    const numberValue = Number(value)
    return Number.isFinite(numberValue) ? numberValue : 0
  }

  return 0
}
