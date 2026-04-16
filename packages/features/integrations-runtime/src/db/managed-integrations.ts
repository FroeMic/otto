import { and, desc, eq } from "drizzle-orm"
import type { OAuthTokenExchangeResult } from "../lib/oauth/providers/types"
import { getDb } from "./client"
import {
  markIntegrationOauthSessionConsumedTx,
  upsertOauthConnectionForTenantIntegrationTx,
} from "./oauth"
import {
  memberships,
  organizations,
  tenantIntegrations,
  tenantServers,
  tenants,
  users,
} from "./schema"

const ACTIVE_WORKSPACE_MEMBERSHIP_STATUS = "active"
const LINEAR_PROVIDER_KEY = "linear"
const SLACK_PROVIDER_KEY = "slack"

type DbTransaction = Parameters<
  Parameters<ReturnType<typeof getDb>["transaction"]>[0]
>[0]

export type TenantManagedIntegrationConnectContext = {
  integrationStatus: string | null
  organizationId: string
  organizationName: string
  organizationSlug: string
  serverStatus: string | null
  tenantId: string
  tenantIntegrationId: string | null
  tenantStatus: string
  userEmail: string
  userId: string
}

export type CompletedManagedIntegrationOauthConnection = {
  organizationSlug: string
  shouldEnqueueApply: boolean
  tenantId: string
  tenantIntegrationId: string
}

export type CompletedManagedSlackOauthConnection =
  CompletedManagedIntegrationOauthConnection & {
    slackTeamId: string
    slackTeamName: string | null
  }

export async function getTenantManagedIntegrationConnectContext(input: {
  orgSlug: string
  providerKey: string
  userExternalId: string
}): Promise<TenantManagedIntegrationConnectContext | null> {
  const db = getDb()
  const normalizedProviderKey = input.providerKey.trim().toLowerCase()
  const [row] = await db
    .select({
      integrationStatus: tenantIntegrations.status,
      organizationId: organizations.id,
      organizationName: organizations.name,
      organizationSlug: organizations.slug,
      serverStatus: tenantServers.status,
      tenantId: tenants.id,
      tenantIntegrationId: tenantIntegrations.id,
      tenantStatus: tenants.status,
      userEmail: users.email,
      userId: users.id,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .innerJoin(tenants, eq(tenants.organizationId, organizations.id))
    .leftJoin(tenantServers, eq(tenantServers.tenantId, tenants.id))
    .leftJoin(
      tenantIntegrations,
      and(
        eq(tenantIntegrations.tenantId, tenants.id),
        eq(tenantIntegrations.providerKey, normalizedProviderKey),
      ),
    )
    .where(
      and(
        eq(organizations.slug, input.orgSlug),
        eq(memberships.status, ACTIVE_WORKSPACE_MEMBERSHIP_STATUS),
        eq(users.externalId, input.userExternalId),
      ),
    )
    .orderBy(desc(tenants.createdAt))
    .limit(1)

  if (!row) {
    return null
  }

  if (
    normalizedProviderKey !== LINEAR_PROVIDER_KEY &&
    normalizedProviderKey !== SLACK_PROVIDER_KEY
  ) {
    throw new Error(
      `Managed integration ${input.providerKey} does not support connect sessions yet.`,
    )
  }

  return row
}

export async function persistManagedLinearOauthConnection(input: {
  actorType: string | null
  externalAccountId?: string | null
  externalAccountLabel?: string | null
  mode: "connect" | "reconnect"
  organizationId: string
  requestedScopes: string[]
  sessionId: string
  tokenResult: OAuthTokenExchangeResult
}) {
  const db = getDb()
  const now = new Date()

  return db.transaction(async (tx) => {
    const authorizedTenant = await getAuthorizedTenantForOrganization(tx, {
      organizationId: input.organizationId,
      providerLabel: "Linear",
    })
    const tenantIntegrationId = await upsertLinearIntegrationForTenantTx(tx, {
      now,
      tenantId: authorizedTenant.tenantId,
    })

    await upsertOauthConnectionForTenantIntegrationTx(tx, {
      actorType: input.actorType,
      eventType: input.mode === "reconnect" ? "reconnect" : "connect",
      externalAccountId: input.externalAccountId ?? null,
      externalAccountLabel: input.externalAccountLabel ?? null,
      now,
      providerKey: LINEAR_PROVIDER_KEY,
      requestedScopes: input.requestedScopes,
      tenantIntegrationId,
      tokenResult: input.tokenResult,
    })
    await markIntegrationOauthSessionConsumedTx(tx, input.sessionId, now)

    return {
      organizationSlug: authorizedTenant.organizationSlug,
      shouldEnqueueApply: authorizedTenant.shouldEnqueueApply,
      tenantId: authorizedTenant.tenantId,
      tenantIntegrationId,
    } satisfies CompletedManagedIntegrationOauthConnection
  })
}

export async function persistManagedSlackOauthConnection(input: {
  mode: "connect" | "reconnect"
  organizationId: string
  requestedScopes: string[]
  sessionId: string
  tokenResult: OAuthTokenExchangeResult
}) {
  const metadata = input.tokenResult.identity?.providerMetadata ?? {}
  const slackTeamId =
    input.tokenResult.identity?.externalAccountId ??
    getStringMetadataValue(metadata, "slackTeamId")
  const slackTeamName =
    input.tokenResult.identity?.externalAccountLabel ??
    getNullableStringMetadataValue(metadata, "slackTeamName")

  if (!slackTeamId) {
    throw new Error("Slack workspace id is missing from the OAuth response.")
  }

  const db = getDb()
  const now = new Date()

  return db.transaction(async (tx) => {
    const authorizedTenant = await getAuthorizedTenantForOrganization(tx, {
      organizationId: input.organizationId,
      providerLabel: "Slack",
    })
    const tenantIntegrationId = await upsertSlackIntegrationForTenantTx(tx, {
      now,
      tenantId: authorizedTenant.tenantId,
    })

    await upsertOauthConnectionForTenantIntegrationTx(tx, {
      actorType: input.tokenResult.actorType,
      eventType: input.mode === "reconnect" ? "reconnect" : "connect",
      externalAccountId: input.tokenResult.identity?.externalAccountId ?? null,
      externalAccountLabel:
        input.tokenResult.identity?.externalAccountLabel ?? null,
      now,
      providerKey: SLACK_PROVIDER_KEY,
      requestedScopes: input.requestedScopes,
      tenantIntegrationId,
      tokenResult: input.tokenResult,
    })
    await markIntegrationOauthSessionConsumedTx(tx, input.sessionId, now)

    return {
      organizationSlug: authorizedTenant.organizationSlug,
      shouldEnqueueApply: authorizedTenant.shouldEnqueueApply,
      slackTeamId,
      slackTeamName,
      tenantId: authorizedTenant.tenantId,
      tenantIntegrationId,
    } satisfies CompletedManagedSlackOauthConnection
  })
}

export async function recordLinearOauthFailure(input: {
  error: string
  organizationId: string
}) {
  const db = getDb()
  const now = new Date()

  await db.transaction(async (tx) => {
    const authorizedTenant = await getTenantIdForOrganizationTx(tx, {
      organizationId: input.organizationId,
      providerLabel: "Linear refresh failure",
    })

    await recordLinearIntegrationErrorTx(tx, {
      error: input.error,
      now,
      tenantId: authorizedTenant.tenantId,
    })
  })
}

export async function recordSlackManagedOauthFailure(input: {
  error: string
  organizationId: string
}) {
  const db = getDb()
  const now = new Date()

  await db.transaction(async (tx) => {
    const authorizedTenant = await getTenantIdForOrganizationTx(tx, {
      organizationId: input.organizationId,
      providerLabel: "Slack OAuth failure",
    })

    await recordSlackIntegrationErrorTx(tx, {
      error: input.error,
      now,
      tenantId: authorizedTenant.tenantId,
    })
  })
}

async function getAuthorizedTenantForOrganization(
  tx: DbTransaction,
  input: {
    organizationId: string
    providerLabel: string
  },
) {
  const [authorizedTenant] = await tx
    .select({
      organizationSlug: organizations.slug,
      serverStatus: tenantServers.status,
      tenantId: tenants.id,
      tenantStatus: tenants.status,
    })
    .from(organizations)
    .innerJoin(tenants, eq(tenants.organizationId, organizations.id))
    .leftJoin(tenantServers, eq(tenantServers.tenantId, tenants.id))
    .where(eq(organizations.id, input.organizationId))
    .orderBy(desc(tenants.createdAt))
    .limit(1)

  if (!authorizedTenant) {
    throw new Error(
      `The ${input.providerLabel} connection could not be matched to a workspace.`,
    )
  }

  return {
    organizationSlug: authorizedTenant.organizationSlug,
    shouldEnqueueApply:
      authorizedTenant.tenantStatus === "ready" &&
      authorizedTenant.serverStatus === "ready",
    tenantId: authorizedTenant.tenantId,
  }
}

async function getTenantIdForOrganizationTx(
  tx: DbTransaction,
  input: {
    organizationId: string
    providerLabel: string
  },
) {
  const [authorizedTenant] = await tx
    .select({
      tenantId: tenants.id,
    })
    .from(organizations)
    .innerJoin(tenants, eq(tenants.organizationId, organizations.id))
    .where(eq(organizations.id, input.organizationId))
    .orderBy(desc(tenants.createdAt))
    .limit(1)

  if (!authorizedTenant) {
    throw new Error(
      `The ${input.providerLabel} could not be matched to a workspace.`,
    )
  }

  return authorizedTenant
}

async function upsertSlackIntegrationForTenantTx(
  tx: DbTransaction,
  input: {
    now: Date
    tenantId: string
  },
) {
  const [existingIntegration] = await tx
    .select({
      id: tenantIntegrations.id,
    })
    .from(tenantIntegrations)
    .where(
      and(
        eq(tenantIntegrations.tenantId, input.tenantId),
        eq(tenantIntegrations.providerKey, SLACK_PROVIDER_KEY),
      ),
    )
    .limit(1)

  let tenantIntegrationId = existingIntegration?.id ?? null

  if (tenantIntegrationId) {
    await tx
      .update(tenantIntegrations)
      .set({
        connectedAt: input.now,
        disconnectedAt: null,
        lastError: null,
        lastErrorAt: null,
        status: "connected",
        updatedAt: input.now,
      })
      .where(eq(tenantIntegrations.id, tenantIntegrationId))
  } else {
    const [createdIntegration] = await tx
      .insert(tenantIntegrations)
      .values({
        connectedAt: input.now,
        providerKey: SLACK_PROVIDER_KEY,
        status: "connected",
        tenantId: input.tenantId,
      })
      .returning({
        id: tenantIntegrations.id,
      })

    tenantIntegrationId = createdIntegration.id
  }

  if (!tenantIntegrationId) {
    throw new Error("Slack integration could not be created.")
  }

  return tenantIntegrationId
}

async function upsertLinearIntegrationForTenantTx(
  tx: DbTransaction,
  input: {
    now: Date
    tenantId: string
  },
) {
  const [existingIntegration] = await tx
    .select({
      id: tenantIntegrations.id,
    })
    .from(tenantIntegrations)
    .where(
      and(
        eq(tenantIntegrations.tenantId, input.tenantId),
        eq(tenantIntegrations.providerKey, LINEAR_PROVIDER_KEY),
      ),
    )
    .limit(1)

  let tenantIntegrationId = existingIntegration?.id ?? null

  if (tenantIntegrationId) {
    await tx
      .update(tenantIntegrations)
      .set({
        connectedAt: input.now,
        disconnectedAt: null,
        lastError: null,
        lastErrorAt: null,
        status: "connected",
        updatedAt: input.now,
      })
      .where(eq(tenantIntegrations.id, tenantIntegrationId))
  } else {
    const [createdIntegration] = await tx
      .insert(tenantIntegrations)
      .values({
        connectedAt: input.now,
        providerKey: LINEAR_PROVIDER_KEY,
        status: "connected",
        tenantId: input.tenantId,
      })
      .returning({
        id: tenantIntegrations.id,
      })

    tenantIntegrationId = createdIntegration.id
  }

  if (!tenantIntegrationId) {
    throw new Error("Linear integration could not be created.")
  }

  return tenantIntegrationId
}

async function recordSlackIntegrationErrorTx(
  tx: DbTransaction,
  input: {
    error: string
    now: Date
    tenantId: string
  },
) {
  const [existingIntegration] = await tx
    .select({
      connectedAt: tenantIntegrations.connectedAt,
      id: tenantIntegrations.id,
      status: tenantIntegrations.status,
    })
    .from(tenantIntegrations)
    .where(
      and(
        eq(tenantIntegrations.tenantId, input.tenantId),
        eq(tenantIntegrations.providerKey, SLACK_PROVIDER_KEY),
      ),
    )
    .limit(1)

  if (!existingIntegration) {
    await tx.insert(tenantIntegrations).values({
      lastError: input.error,
      lastErrorAt: input.now,
      providerKey: SLACK_PROVIDER_KEY,
      status: "error",
      tenantId: input.tenantId,
    })
    return
  }

  await tx
    .update(tenantIntegrations)
    .set({
      lastError: input.error,
      lastErrorAt: input.now,
      status: existingIntegration.connectedAt
        ? existingIntegration.status
        : "error",
      updatedAt: input.now,
    })
    .where(eq(tenantIntegrations.id, existingIntegration.id))
}

async function recordLinearIntegrationErrorTx(
  tx: DbTransaction,
  input: {
    error: string
    now: Date
    tenantId: string
  },
) {
  const [existingIntegration] = await tx
    .select({
      connectedAt: tenantIntegrations.connectedAt,
      id: tenantIntegrations.id,
      status: tenantIntegrations.status,
    })
    .from(tenantIntegrations)
    .where(
      and(
        eq(tenantIntegrations.tenantId, input.tenantId),
        eq(tenantIntegrations.providerKey, LINEAR_PROVIDER_KEY),
      ),
    )
    .limit(1)

  if (!existingIntegration) {
    await tx.insert(tenantIntegrations).values({
      lastError: input.error,
      lastErrorAt: input.now,
      providerKey: LINEAR_PROVIDER_KEY,
      status: "error",
      tenantId: input.tenantId,
    })
    return
  }

  await tx
    .update(tenantIntegrations)
    .set({
      lastError: input.error,
      lastErrorAt: input.now,
      status: existingIntegration.connectedAt
        ? existingIntegration.status
        : "error",
      updatedAt: input.now,
    })
    .where(eq(tenantIntegrations.id, existingIntegration.id))
}

function getStringMetadataValue(
  metadata: Record<string, unknown>,
  key: string,
) {
  const value = metadata[key]

  return typeof value === "string" && value.trim().length > 0 ? value : null
}

function getNullableStringMetadataValue(
  metadata: Record<string, unknown>,
  key: string,
) {
  const value = metadata[key]

  if (value === null || value === undefined) {
    return null
  }

  return typeof value === "string" ? value : null
}
