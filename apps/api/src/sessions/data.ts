import { getDb } from "@otto/feature-integrations-runtime/db/client"
import {
  integrationMessagingConversations,
  integrationMessagingWorkspaceMembers,
  integrationMessagingWorkspaces,
  tenantIntegrations,
  tenants,
  userChannelIdentities,
  users,
} from "@otto/feature-integrations-runtime/db/schema"
import { getCronSessionTaskKeyMap } from "@otto/feature-runtime-core/scheduled-tasks/queries"
import {
  getTenantSession,
  listTenantSessions,
} from "@otto/feature-runtime-core/sessions/queries"
import type {
  WorkspaceSessionDetailResponse,
  WorkspaceSessionsListResponse,
  WorkspaceSessionsRefreshResponse,
} from "@otto/feature-runtime-core/sessions/workspace-contracts"
import { and, eq } from "drizzle-orm"

import { enqueueJob } from "../jobs/queue"
import { JOB_TYPES } from "../jobs/types"
import {
  getOrganizationTenantForBilling,
  getOrganizationWorkspaceBySlug,
  getWorkspaceSummaryBySlugForUser,
} from "../workspace/data"

function parseSessionKey(sessionKey: string) {
  const parts = sessionKey.split(":")
  const provider = parts[2] ?? null
  const kindRaw = parts[3] ?? "unknown"
  const threadIdx = parts.indexOf("thread")
  const threadId =
    threadIdx !== -1 ? parts.slice(threadIdx + 1).join(":") : null
  const idEnd = threadIdx !== -1 ? threadIdx : parts.length
  const id = parts.slice(4, idEnd).join(":") || null
  const kind =
    threadId !== null ? "thread" : kindRaw === "direct" ? "dm" : kindRaw

  return {
    id,
    kind,
    provider,
    threadId,
  }
}

function canViewSessionDetail(input: {
  currentUserExternalIds: string[]
  isPlatformAdmin: boolean
  sessionKey: string
}) {
  if (input.isPlatformAdmin) {
    return true
  }

  const parsed = parseSessionKey(input.sessionKey)

  if (parsed.kind !== "dm" && parsed.kind !== "main") {
    return true
  }

  if (parsed.kind === "dm" && parsed.id) {
    const parsedId = parsed.id.toLowerCase()

    return input.currentUserExternalIds.some(
      (externalId) => externalId.toLowerCase() === parsedId,
    )
  }

  if (parsed.kind === "main") {
    return false
  }

  return true
}

async function getAuthorizedSessionContext(input: {
  orgSlug: string
  userExternalId: string
}) {
  const workspace = await getWorkspaceSummaryBySlugForUser(input)

  if (!workspace) {
    throw new Error("Organization not found")
  }

  const tenant = await getOrganizationTenantForBilling(workspace.id)

  return {
    dateTimePreferences: {
      locale: workspace.locale,
      timeFormatPreference: workspace.timeFormatPreference,
      timeZone: workspace.timezone,
    },
    organizationId: workspace.id,
    tenantId: tenant?.id ?? null,
  }
}

async function getUserExternalIds(input: {
  organizationId: string
  userExternalId: string
}) {
  const db = getDb()
  const rows = await db
    .select({
      externalId: userChannelIdentities.externalId,
    })
    .from(userChannelIdentities)
    .innerJoin(users, eq(userChannelIdentities.userId, users.id))
    .where(
      and(
        eq(users.externalId, input.userExternalId),
        eq(userChannelIdentities.organizationId, input.organizationId),
      ),
    )

  return rows.map((row) => row.externalId)
}

async function getConversationNameMap(input: { organizationId: string }) {
  const db = getDb()
  const rows = await db
    .select({
      externalId: integrationMessagingConversations.externalConversationId,
      name: integrationMessagingConversations.name,
    })
    .from(integrationMessagingConversations)
    .innerJoin(
      integrationMessagingWorkspaces,
      eq(
        integrationMessagingConversations.messagingWorkspaceId,
        integrationMessagingWorkspaces.id,
      ),
    )
    .innerJoin(
      tenantIntegrations,
      eq(
        integrationMessagingWorkspaces.tenantIntegrationId,
        tenantIntegrations.id,
      ),
    )
    .innerJoin(tenants, eq(tenantIntegrations.tenantId, tenants.id))
    .where(eq(tenants.organizationId, input.organizationId))

  const map = new Map<string, string>()

  for (const row of rows) {
    if (!row.name) {
      continue
    }

    map.set(row.externalId, row.name)
    map.set(row.externalId.toLowerCase(), row.name)
  }

  return map
}

async function getMemberNameMap(input: { organizationId: string }) {
  const db = getDb()
  const rows = await db
    .select({
      displayName: integrationMessagingWorkspaceMembers.displayName,
      externalId: integrationMessagingWorkspaceMembers.externalMemberId,
      fullName: integrationMessagingWorkspaceMembers.fullName,
    })
    .from(integrationMessagingWorkspaceMembers)
    .innerJoin(
      integrationMessagingWorkspaces,
      eq(
        integrationMessagingWorkspaceMembers.messagingWorkspaceId,
        integrationMessagingWorkspaces.id,
      ),
    )
    .innerJoin(
      tenantIntegrations,
      eq(
        integrationMessagingWorkspaces.tenantIntegrationId,
        tenantIntegrations.id,
      ),
    )
    .innerJoin(tenants, eq(tenantIntegrations.tenantId, tenants.id))
    .where(eq(tenants.organizationId, input.organizationId))

  const map = new Map<string, string>()

  for (const row of rows) {
    const name = row.displayName ?? row.fullName

    if (!name) {
      continue
    }

    map.set(row.externalId, name)
    map.set(row.externalId.toLowerCase(), name)
  }

  return map
}

function mapSessionListEntry(
  session: Awaited<ReturnType<typeof listTenantSessions>>[number],
) {
  return {
    createdAt: session.createdAt?.toISOString() ?? null,
    displayName: session.displayName,
    endedAt: session.endedAt?.toISOString() ?? null,
    estimatedCostUsd: session.estimatedCostUsd,
    externalSessionId: session.externalSessionId,
    id: session.id,
    inputTokens: session.inputTokens,
    label: session.label,
    lastMessageAt: session.lastMessageAt,
    lastSyncedAt: session.lastSyncedAt?.toISOString() ?? null,
    messageCount: session.messageCount,
    model: session.model,
    modelProvider: session.modelProvider,
    originFrom: session.originFrom,
    parentSessionKey: session.parentSessionKey,
    runtimeMs: session.runtimeMs,
    sessionKey: session.sessionKey,
    sessionUpdatedAt: session.sessionUpdatedAt,
    spawnDepth: session.spawnDepth,
    startedAt: session.startedAt?.toISOString() ?? null,
    status: session.status,
    subject: session.subject,
    subagentRole: session.subagentRole,
    totalTokens: session.totalTokens,
  } as const
}

function mapSessionDetail(
  session: NonNullable<Awaited<ReturnType<typeof getTenantSession>>>,
) {
  return {
    channel: session.channel,
    channelProvider: session.channelProvider,
    chatType: session.chatType,
    displayName: session.displayName,
    endedAt: session.endedAt?.toISOString() ?? null,
    estimatedCostUsd: session.estimatedCostUsd,
    externalSessionId: session.externalSessionId,
    id: session.id,
    inputTokens: session.inputTokens,
    label: session.label,
    lastSyncedAt: session.lastSyncedAt?.toISOString() ?? null,
    messageCount: session.messageCount,
    model: session.model,
    modelProvider: session.modelProvider,
    originFrom: session.originFrom,
    runtimeMs: session.runtimeMs,
    sessionKey: session.sessionKey,
    startedAt: session.startedAt?.toISOString() ?? null,
    status: session.status,
    subject: session.subject,
    totalTokens: session.totalTokens,
    transcriptJsonl: session.transcriptJsonl,
  } as const
}

function recordFromMap(map: Map<string, string>) {
  return Object.fromEntries(map)
}

export async function listWorkspaceSessions(input: {
  orgSlug: string
  userExternalId: string
}): Promise<WorkspaceSessionsListResponse> {
  const { dateTimePreferences, organizationId, tenantId } =
    await getAuthorizedSessionContext(input)

  if (!tenantId) {
    return {
      channelNames: {},
      cronTaskKeys: {},
      currentUserExternalIds: [],
      dateTimePreferences,
      memberNames: {},
      sessions: [],
      state: "pending_setup",
    }
  }

  const [
    sessions,
    currentUserExternalIds,
    conversationNameMap,
    memberNameMap,
    cronTaskKeyMap,
  ] = await Promise.all([
    listTenantSessions({
      tenantId,
    }),
    getUserExternalIds({
      organizationId,
      userExternalId: input.userExternalId,
    }),
    getConversationNameMap({
      organizationId,
    }),
    getMemberNameMap({
      organizationId,
    }),
    getCronSessionTaskKeyMap({
      tenantId,
    }),
  ])

  return {
    channelNames: recordFromMap(conversationNameMap),
    cronTaskKeys: recordFromMap(cronTaskKeyMap),
    currentUserExternalIds,
    dateTimePreferences,
    memberNames: recordFromMap(memberNameMap),
    sessions: sessions.map(mapSessionListEntry),
    state: "ready",
  }
}

export async function getWorkspaceSessionDetail(input: {
  isPlatformAdmin: boolean
  orgSlug: string
  sessionKey: string
  userExternalId: string
}): Promise<WorkspaceSessionDetailResponse | null> {
  const decodedSessionKey = decodeURIComponent(input.sessionKey)
  const { dateTimePreferences, organizationId, tenantId } =
    await getAuthorizedSessionContext({
      orgSlug: input.orgSlug,
      userExternalId: input.userExternalId,
    })

  if (!tenantId) {
    return {
      channelNames: {},
      cronTaskHref: null,
      currentUserExternalIds: [],
      dateTimePreferences,
      memberNames: {},
      session: null,
      state: "pending_setup",
    }
  }

  const [session, currentUserExternalIds, memberNameMap, conversationNameMap] =
    await Promise.all([
      getTenantSession({
        sessionKey: decodedSessionKey,
        tenantId,
      }),
      getUserExternalIds({
        organizationId,
        userExternalId: input.userExternalId,
      }),
      getMemberNameMap({
        organizationId,
      }),
      getConversationNameMap({
        organizationId,
      }),
    ])

  if (!session) {
    return null
  }

  if (
    !canViewSessionDetail({
      currentUserExternalIds,
      isPlatformAdmin: input.isPlatformAdmin,
      sessionKey: decodedSessionKey,
    })
  ) {
    return null
  }

  const cronTaskKeyMap = await getCronSessionTaskKeyMap({
    tenantId,
  })
  const taskKey = cronTaskKeyMap.get(decodedSessionKey) ?? null

  return {
    channelNames: recordFromMap(conversationNameMap),
    cronTaskHref: taskKey
      ? `/${input.orgSlug}/scheduled-tasks/tasks/${encodeURIComponent(taskKey)}`
      : null,
    currentUserExternalIds,
    dateTimePreferences,
    memberNames: recordFromMap(memberNameMap),
    session: mapSessionDetail(session),
    state: "ready",
  }
}

export async function refreshWorkspaceSessions(input: {
  orgSlug: string
  userExternalId: string
}): Promise<WorkspaceSessionsRefreshResponse> {
  const workspace = await getOrganizationWorkspaceBySlug(input)
  const tenant = await getOrganizationTenantForBilling(workspace.id)

  if (!tenant) {
    throw new Error("No tenant found for organization")
  }

  const jobId = await enqueueJob({
    jobType: JOB_TYPES.syncTenantSessions,
    payload: {
      tenantId: tenant.id,
    },
  })

  return {
    jobId,
    ok: true,
  }
}
