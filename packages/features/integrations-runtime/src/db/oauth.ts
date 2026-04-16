import { and, eq, isNotNull, lte, or } from "drizzle-orm"
import {
  decryptControlPlaneSecret,
  encryptControlPlaneSecret,
} from "../lib/crypto"
import type { OAuthTokenExchangeResult } from "../lib/oauth/providers/types"
import { getDb } from "./client"
import {
  integrationOauthConnections,
  integrationOauthCredentials,
  integrationOauthEvents,
  integrationOauthSessions,
  organizations,
  tenantIntegrations,
  users,
} from "./schema"

type DbTransaction = Parameters<
  Parameters<ReturnType<typeof getDb>["transaction"]>[0]
>[0]

export type IntegrationOAuthSessionRecord = {
  authorizeParams: Record<string, string>
  consumedAt: Date | null
  expiresAt: Date
  id: string
  mode: string
  organizationId: string
  organizationSlug: string
  pkceCodeVerifier: string | null
  providerKey: string
  requestedScopes: string[]
  stateNonce: string
  tenantId: string
  tenantIntegrationId: string | null
  userId: string
}

export type RefreshableOAuthConnection = {
  connectionId: string
  credentialsExpiresAt: Date | null
  providerKey: string
  refreshRetryAfter: Date | null
  status: string
  tenantId: string
  tenantIntegrationId: string
}

export type ClaimedOAuthRefreshConnection = {
  connectionId: string
  currentStatus: string
  lastRefreshStartedAt: Date | null
  providerKey: string
  refreshAttemptCount: number
  refreshToken: string | null
  tenantIntegrationId: string
  tokenVersion: number
}

export type ConnectedOauthAccessRecord = {
  accessToken: string
  connectionId: string
  credentialsExpiresAt: Date | null
  externalAccountId: string | null
  externalAccountLabel: string | null
  grantedScopes: string[]
  providerKey: string
  requestedScopes: string[]
  status: string
  tenantIntegrationId: string
}

export async function createIntegrationOauthSession(input: {
  authorizeParams: Record<string, string>
  expiresAt: Date
  mode: "connect" | "reconnect"
  organizationId: string
  pkceCodeVerifier: string | null
  providerKey: string
  requestedScopes: string[]
  stateNonce: string
  tenantId: string
  tenantIntegrationId?: string | null
  userId: string
}) {
  const db = getDb()
  const [created] = await db
    .insert(integrationOauthSessions)
    .values({
      authorizeParamsJson: input.authorizeParams,
      expiresAt: input.expiresAt,
      mode: input.mode,
      organizationId: input.organizationId,
      pkceCodeVerifier: input.pkceCodeVerifier,
      providerKey: input.providerKey,
      requestedScopesCsv: joinScopeCsv(input.requestedScopes),
      stateNonce: input.stateNonce,
      tenantId: input.tenantId,
      tenantIntegrationId: input.tenantIntegrationId ?? null,
      userId: input.userId,
    })
    .returning({
      id: integrationOauthSessions.id,
    })

  return created
}

export async function getLocalUserIdForExternalId(userExternalId: string) {
  const db = getDb()
  const [row] = await db
    .select({
      id: users.id,
    })
    .from(users)
    .where(eq(users.externalId, userExternalId))
    .limit(1)

  return row?.id ?? null
}

export async function getIntegrationOauthSessionRecord(input: {
  providerKey: string
  sessionId: string
}) {
  const db = getDb()
  const [row] = await db
    .select({
      authorizeParams: integrationOauthSessions.authorizeParamsJson,
      consumedAt: integrationOauthSessions.consumedAt,
      expiresAt: integrationOauthSessions.expiresAt,
      id: integrationOauthSessions.id,
      mode: integrationOauthSessions.mode,
      organizationId: integrationOauthSessions.organizationId,
      organizationSlug: organizations.slug,
      pkceCodeVerifier: integrationOauthSessions.pkceCodeVerifier,
      providerKey: integrationOauthSessions.providerKey,
      requestedScopesCsv: integrationOauthSessions.requestedScopesCsv,
      stateNonce: integrationOauthSessions.stateNonce,
      tenantId: integrationOauthSessions.tenantId,
      tenantIntegrationId: integrationOauthSessions.tenantIntegrationId,
      userId: integrationOauthSessions.userId,
    })
    .from(integrationOauthSessions)
    .innerJoin(
      organizations,
      eq(organizations.id, integrationOauthSessions.organizationId),
    )
    .where(
      and(
        eq(integrationOauthSessions.id, input.sessionId),
        eq(integrationOauthSessions.providerKey, input.providerKey),
      ),
    )
    .limit(1)

  if (!row) {
    return null
  }

  return {
    authorizeParams: row.authorizeParams,
    consumedAt: row.consumedAt,
    expiresAt: row.expiresAt,
    id: row.id,
    mode: row.mode,
    organizationId: row.organizationId,
    organizationSlug: row.organizationSlug,
    pkceCodeVerifier: row.pkceCodeVerifier,
    providerKey: row.providerKey,
    requestedScopes: splitScopeCsv(row.requestedScopesCsv),
    stateNonce: row.stateNonce,
    tenantId: row.tenantId,
    tenantIntegrationId: row.tenantIntegrationId,
    userId: row.userId,
  } satisfies IntegrationOAuthSessionRecord
}

export async function getConnectedOauthAccessForTenantIntegration(input: {
  providerKey: string
  tenantIntegrationId: string
}) {
  const db = getDb()
  const [row] = await db
    .select({
      accessTokenCiphertext: integrationOauthCredentials.accessTokenCiphertext,
      connectionId: integrationOauthConnections.id,
      credentialsExpiresAt: integrationOauthConnections.credentialsExpiresAt,
      externalAccountId: integrationOauthConnections.externalAccountId,
      externalAccountLabel: integrationOauthConnections.externalAccountLabel,
      grantedScopesCsv: integrationOauthConnections.grantedScopesCsv,
      providerKey: integrationOauthConnections.providerKey,
      requestedScopesCsv: integrationOauthConnections.requestedScopesCsv,
      status: integrationOauthConnections.status,
      tenantIntegrationId: integrationOauthConnections.tenantIntegrationId,
    })
    .from(integrationOauthConnections)
    .innerJoin(
      integrationOauthCredentials,
      eq(
        integrationOauthCredentials.connectionId,
        integrationOauthConnections.id,
      ),
    )
    .where(
      and(
        eq(
          integrationOauthConnections.tenantIntegrationId,
          input.tenantIntegrationId,
        ),
        eq(integrationOauthConnections.providerKey, input.providerKey),
      ),
    )
    .limit(1)

  if (!row) {
    return null
  }

  return {
    accessToken: decryptControlPlaneSecret(row.accessTokenCiphertext),
    connectionId: row.connectionId,
    credentialsExpiresAt: row.credentialsExpiresAt,
    externalAccountId: row.externalAccountId,
    externalAccountLabel: row.externalAccountLabel,
    grantedScopes: splitScopeCsv(row.grantedScopesCsv),
    providerKey: row.providerKey,
    requestedScopes: splitScopeCsv(row.requestedScopesCsv),
    status: row.status,
    tenantIntegrationId: row.tenantIntegrationId,
  } satisfies ConnectedOauthAccessRecord
}

export async function appendIntegrationOauthEventTx(
  tx: DbTransaction,
  input: {
    connectionId?: string | null
    details?: Record<string, unknown>
    errorMessage?: string | null
    eventType: string
    providerKey: string
    statusAfter?: string | null
    statusBefore?: string | null
    tenantIntegrationId?: string | null
  },
) {
  await tx.insert(integrationOauthEvents).values({
    connectionId: input.connectionId ?? null,
    detailsJson: input.details ?? {},
    errorMessage: input.errorMessage ?? null,
    eventType: input.eventType,
    providerKey: input.providerKey,
    statusAfter: input.statusAfter ?? null,
    statusBefore: input.statusBefore ?? null,
    tenantIntegrationId: input.tenantIntegrationId ?? null,
  })
}

export async function markIntegrationOauthSessionConsumedTx(
  tx: DbTransaction,
  sessionId: string,
  now: Date,
) {
  await tx
    .update(integrationOauthSessions)
    .set({
      consumedAt: now,
      updatedAt: now,
    })
    .where(eq(integrationOauthSessions.id, sessionId))
}

export async function upsertOauthConnectionForTenantIntegrationTx(
  tx: DbTransaction,
  input: {
    actorType: string | null
    eventType: "connect" | "reconnect"
    externalAccountId?: string | null
    externalAccountLabel?: string | null
    now: Date
    providerKey: string
    requestedScopes: string[]
    tenantIntegrationId: string
    tokenResult: OAuthTokenExchangeResult
  },
) {
  const [existingConnection] = await tx
    .select({
      id: integrationOauthConnections.id,
      status: integrationOauthConnections.status,
      tokenVersion: integrationOauthConnections.tokenVersion,
    })
    .from(integrationOauthConnections)
    .where(
      eq(
        integrationOauthConnections.tenantIntegrationId,
        input.tenantIntegrationId,
      ),
    )
    .limit(1)

  let connectionId = existingConnection?.id ?? null
  const nextTokenVersion = (existingConnection?.tokenVersion ?? 0) + 1

  if (connectionId) {
    await tx
      .update(integrationOauthConnections)
      .set({
        actorType: input.actorType,
        credentialsExpiresAt: input.tokenResult.expiresAt,
        externalAccountId:
          input.externalAccountId ??
          input.tokenResult.identity?.externalAccountId ??
          null,
        externalAccountLabel:
          input.externalAccountLabel ??
          input.tokenResult.identity?.externalAccountLabel ??
          null,
        grantedScopesCsv: joinScopeCsv(input.tokenResult.grantedScopes),
        lastError: null,
        lastErrorAt: null,
        lastRefreshSucceededAt: input.now,
        providerKey: input.providerKey,
        refreshAttemptCount: 0,
        refreshRetryAfter: null,
        refreshTokenExpiresAt: input.tokenResult.refreshTokenExpiresAt,
        requestedScopesCsv: joinScopeCsv(input.requestedScopes),
        status: "connected",
        tokenVersion: nextTokenVersion,
        updatedAt: input.now,
      })
      .where(eq(integrationOauthConnections.id, connectionId))
  } else {
    const [created] = await tx
      .insert(integrationOauthConnections)
      .values({
        actorType: input.actorType,
        authMode: "oauth2_authorization_code",
        credentialsExpiresAt: input.tokenResult.expiresAt,
        externalAccountId:
          input.externalAccountId ??
          input.tokenResult.identity?.externalAccountId ??
          null,
        externalAccountLabel:
          input.externalAccountLabel ??
          input.tokenResult.identity?.externalAccountLabel ??
          null,
        grantedScopesCsv: joinScopeCsv(input.tokenResult.grantedScopes),
        lastRefreshSucceededAt: input.now,
        providerKey: input.providerKey,
        refreshTokenExpiresAt: input.tokenResult.refreshTokenExpiresAt,
        requestedScopesCsv: joinScopeCsv(input.requestedScopes),
        status: "connected",
        tenantIntegrationId: input.tenantIntegrationId,
        tokenVersion: nextTokenVersion,
      })
      .returning({
        id: integrationOauthConnections.id,
      })

    connectionId = created.id
  }

  if (!connectionId) {
    throw new Error("OAuth connection could not be created.")
  }

  const [existingCredentials] = await tx
    .select({
      id: integrationOauthCredentials.id,
    })
    .from(integrationOauthCredentials)
    .where(eq(integrationOauthCredentials.connectionId, connectionId))
    .limit(1)

  const credentialValues = {
    accessTokenCiphertext: encryptControlPlaneSecret(
      input.tokenResult.accessToken,
    ),
    idTokenCiphertext: input.tokenResult.idToken
      ? encryptControlPlaneSecret(input.tokenResult.idToken)
      : null,
    rawTokenResponseJson: input.tokenResult.raw,
    refreshTokenCiphertext: input.tokenResult.refreshToken
      ? encryptControlPlaneSecret(input.tokenResult.refreshToken)
      : null,
    rotatedAt: input.now,
    tokenType: input.tokenResult.tokenType,
    updatedAt: input.now,
  }

  if (existingCredentials) {
    await tx
      .update(integrationOauthCredentials)
      .set(credentialValues)
      .where(eq(integrationOauthCredentials.id, existingCredentials.id))
  } else {
    await tx.insert(integrationOauthCredentials).values({
      ...credentialValues,
      connectionId,
    })
  }

  await appendIntegrationOauthEventTx(tx, {
    connectionId,
    details: {
      actorType: input.actorType,
      grantedScopes: input.tokenResult.grantedScopes,
      requestedScopes: input.requestedScopes,
      tokenVersion: nextTokenVersion,
    },
    eventType: input.eventType,
    providerKey: input.providerKey,
    statusAfter: "connected",
    statusBefore: existingConnection?.status ?? null,
    tenantIntegrationId: input.tenantIntegrationId,
  })

  return {
    connectionId,
  }
}

export async function listOauthConnectionsNeedingRefresh(input?: {
  bufferMs?: number
  limit?: number
}) {
  const db = getDb()
  const now = new Date()
  const refreshCutoff = new Date(
    now.getTime() + (input?.bufferMs ?? 5 * 60 * 1000),
  )
  const staleRefreshCutoff = new Date(now.getTime() - 15 * 60 * 1000)
  const rows = await db
    .select({
      connectionId: integrationOauthConnections.id,
      credentialsExpiresAt: integrationOauthConnections.credentialsExpiresAt,
      providerKey: integrationOauthConnections.providerKey,
      refreshRetryAfter: integrationOauthConnections.refreshRetryAfter,
      status: integrationOauthConnections.status,
      tenantId: tenantIntegrations.tenantId,
      tenantIntegrationId: integrationOauthConnections.tenantIntegrationId,
    })
    .from(integrationOauthConnections)
    .innerJoin(
      tenantIntegrations,
      eq(
        tenantIntegrations.id,
        integrationOauthConnections.tenantIntegrationId,
      ),
    )
    .innerJoin(
      integrationOauthCredentials,
      eq(
        integrationOauthCredentials.connectionId,
        integrationOauthConnections.id,
      ),
    )
    .where(
      and(
        isNotNull(integrationOauthCredentials.refreshTokenCiphertext),
        or(
          and(
            eq(integrationOauthConnections.status, "connected"),
            or(
              lte(
                integrationOauthConnections.credentialsExpiresAt,
                refreshCutoff,
              ),
              lte(integrationOauthConnections.refreshRetryAfter, now),
            ),
          ),
          and(
            eq(integrationOauthConnections.status, "refreshing"),
            lte(
              integrationOauthConnections.lastRefreshStartedAt,
              staleRefreshCutoff,
            ),
          ),
        ),
      ),
    )
    .limit(input?.limit ?? 10)

  return rows satisfies RefreshableOAuthConnection[]
}

export async function claimOauthConnectionForRefresh(input: {
  connectionId: string
}) {
  const db = getDb()
  const now = new Date()
  const staleRefreshCutoff = new Date(now.getTime() - 15 * 60 * 1000)

  return db.transaction(async (tx) => {
    const [connection] = await tx
      .update(integrationOauthConnections)
      .set({
        lastRefreshStartedAt: now,
        status: "refreshing",
        updatedAt: now,
      })
      .where(
        and(
          eq(integrationOauthConnections.id, input.connectionId),
          or(
            eq(integrationOauthConnections.status, "connected"),
            and(
              eq(integrationOauthConnections.status, "refreshing"),
              lte(
                integrationOauthConnections.lastRefreshStartedAt,
                staleRefreshCutoff,
              ),
            ),
          ),
        ),
      )
      .returning({
        id: integrationOauthConnections.id,
        lastRefreshStartedAt: integrationOauthConnections.lastRefreshStartedAt,
        providerKey: integrationOauthConnections.providerKey,
        refreshAttemptCount: integrationOauthConnections.refreshAttemptCount,
        status: integrationOauthConnections.status,
        tenantIntegrationId: integrationOauthConnections.tenantIntegrationId,
        tokenVersion: integrationOauthConnections.tokenVersion,
      })

    if (!connection) {
      return null
    }

    const [credentials] = await tx
      .select({
        refreshTokenCiphertext:
          integrationOauthCredentials.refreshTokenCiphertext,
      })
      .from(integrationOauthCredentials)
      .where(eq(integrationOauthCredentials.connectionId, connection.id))
      .limit(1)

    return {
      connectionId: connection.id,
      currentStatus: connection.status,
      lastRefreshStartedAt: connection.lastRefreshStartedAt,
      providerKey: connection.providerKey,
      refreshAttemptCount: connection.refreshAttemptCount,
      refreshToken: credentials?.refreshTokenCiphertext
        ? decryptControlPlaneSecret(credentials.refreshTokenCiphertext)
        : null,
      tenantIntegrationId: connection.tenantIntegrationId,
      tokenVersion: connection.tokenVersion,
    } satisfies ClaimedOAuthRefreshConnection
  })
}

export async function applyOauthRefreshSuccess(input: {
  connectionId: string
  providerKey: string
  requestedScopes: string[]
  tenantIntegrationId: string
  tokenResult: OAuthTokenExchangeResult
}) {
  const db = getDb()
  const now = new Date()

  await db.transaction(async (tx) => {
    const [existingConnection] = await tx
      .select({
        status: integrationOauthConnections.status,
        tokenVersion: integrationOauthConnections.tokenVersion,
      })
      .from(integrationOauthConnections)
      .where(eq(integrationOauthConnections.id, input.connectionId))
      .limit(1)

    if (!existingConnection) {
      throw new Error("OAuth connection not found.")
    }

    await tx
      .update(integrationOauthConnections)
      .set({
        credentialsExpiresAt: input.tokenResult.expiresAt,
        grantedScopesCsv: joinScopeCsv(input.tokenResult.grantedScopes),
        lastError: null,
        lastErrorAt: null,
        lastRefreshFailedAt: null,
        lastRefreshSucceededAt: now,
        refreshAttemptCount: 0,
        refreshRetryAfter: null,
        refreshTokenExpiresAt: input.tokenResult.refreshTokenExpiresAt,
        status: "connected",
        tokenVersion: existingConnection.tokenVersion + 1,
        updatedAt: now,
      })
      .where(eq(integrationOauthConnections.id, input.connectionId))

    await tx
      .update(integrationOauthCredentials)
      .set({
        accessTokenCiphertext: encryptControlPlaneSecret(
          input.tokenResult.accessToken,
        ),
        idTokenCiphertext: input.tokenResult.idToken
          ? encryptControlPlaneSecret(input.tokenResult.idToken)
          : null,
        rawTokenResponseJson: input.tokenResult.raw,
        refreshTokenCiphertext: input.tokenResult.refreshToken
          ? encryptControlPlaneSecret(input.tokenResult.refreshToken)
          : null,
        rotatedAt: now,
        tokenType: input.tokenResult.tokenType,
        updatedAt: now,
      })
      .where(eq(integrationOauthCredentials.connectionId, input.connectionId))

    await tx
      .update(tenantIntegrations)
      .set({
        connectedAt: now,
        disconnectedAt: null,
        lastError: null,
        lastErrorAt: null,
        status: "connected",
        updatedAt: now,
      })
      .where(eq(tenantIntegrations.id, input.tenantIntegrationId))

    await appendIntegrationOauthEventTx(tx, {
      connectionId: input.connectionId,
      details: {
        grantedScopes: input.tokenResult.grantedScopes,
        requestedScopes: input.requestedScopes,
      },
      eventType: "refresh_succeeded",
      providerKey: input.providerKey,
      statusAfter: "connected",
      statusBefore: existingConnection.status,
      tenantIntegrationId: input.tenantIntegrationId,
    })
  })
}

export async function recordOauthRefreshFailure(input: {
  connectionId: string
  errorMessage: string
  kind: "reauthorize" | "transient"
  providerKey: string
  tenantIntegrationId: string
}) {
  const db = getDb()
  const now = new Date()
  const retryAfter =
    input.kind === "transient" ? new Date(now.getTime() + 5 * 60 * 1000) : null

  await db.transaction(async (tx) => {
    const [existingConnection] = await tx
      .select({
        refreshAttemptCount: integrationOauthConnections.refreshAttemptCount,
        status: integrationOauthConnections.status,
      })
      .from(integrationOauthConnections)
      .where(eq(integrationOauthConnections.id, input.connectionId))
      .limit(1)

    if (!existingConnection) {
      return
    }

    const nextStatus =
      input.kind === "reauthorize" ? "needs_attention" : "connected"

    await tx
      .update(integrationOauthConnections)
      .set({
        lastError: input.errorMessage,
        lastErrorAt: now,
        lastRefreshFailedAt: now,
        refreshAttemptCount: existingConnection.refreshAttemptCount + 1,
        refreshRetryAfter: retryAfter,
        status: nextStatus,
        updatedAt: now,
      })
      .where(eq(integrationOauthConnections.id, input.connectionId))

    await tx
      .update(tenantIntegrations)
      .set({
        lastError: input.kind === "reauthorize" ? input.errorMessage : null,
        lastErrorAt: input.kind === "reauthorize" ? now : null,
        status: input.kind === "reauthorize" ? "error" : "connected",
        updatedAt: now,
      })
      .where(eq(tenantIntegrations.id, input.tenantIntegrationId))

    await appendIntegrationOauthEventTx(tx, {
      connectionId: input.connectionId,
      errorMessage: input.errorMessage,
      eventType:
        input.kind === "reauthorize"
          ? "refresh_failed_reauthorize"
          : "refresh_failed_transient",
      providerKey: input.providerKey,
      statusAfter: nextStatus,
      statusBefore: existingConnection.status,
      tenantIntegrationId: input.tenantIntegrationId,
    })
  })
}

export async function recordOauthConnectionAttention(input: {
  connectionId: string
  errorMessage: string
  eventType: string
  providerKey: string
  tenantIntegrationId: string
}) {
  const db = getDb()
  const now = new Date()

  await db.transaction(async (tx) => {
    const [existingConnection] = await tx
      .select({
        status: integrationOauthConnections.status,
      })
      .from(integrationOauthConnections)
      .where(eq(integrationOauthConnections.id, input.connectionId))
      .limit(1)

    if (!existingConnection) {
      return
    }

    await tx
      .update(integrationOauthConnections)
      .set({
        lastError: input.errorMessage,
        lastErrorAt: now,
        status: "needs_attention",
        updatedAt: now,
      })
      .where(eq(integrationOauthConnections.id, input.connectionId))

    await tx
      .update(tenantIntegrations)
      .set({
        lastError: input.errorMessage,
        lastErrorAt: now,
        status: "error",
        updatedAt: now,
      })
      .where(eq(tenantIntegrations.id, input.tenantIntegrationId))

    await appendIntegrationOauthEventTx(tx, {
      connectionId: input.connectionId,
      errorMessage: input.errorMessage,
      eventType: input.eventType,
      providerKey: input.providerKey,
      statusAfter: "needs_attention",
      statusBefore: existingConnection.status,
      tenantIntegrationId: input.tenantIntegrationId,
    })
  })
}

function joinScopeCsv(scopes: string[]) {
  return scopes.length > 0 ? scopes.join(",") : null
}

function splitScopeCsv(csv: string | null) {
  if (!csv) {
    return []
  }

  return csv
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean)
}
