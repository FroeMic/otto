import { getDb } from "@otto/feature-integrations-runtime/db/client"
import { tenantSessions } from "@otto/feature-integrations-runtime/db/schema"
import { and, desc, eq, notInArray } from "drizzle-orm"

export type TenantSessionUpsertInput = {
  cacheReadTokens?: number | null
  cacheWriteTokens?: number | null
  channel?: string | null
  channelProvider?: string | null
  chatType?: string | null
  displayName?: string | null
  endedAt?: number | null
  estimatedCostUsd?: string | null
  externalSessionId?: string | null
  inputTokens?: number | null
  label?: string | null
  lastMessageAt?: number | null
  messageCount?: number | null
  model?: string | null
  modelProvider?: string | null
  originAccountId?: string | null
  originFrom?: string | null
  originThreadId?: string | null
  originTo?: string | null
  outputTokens?: number | null
  parentSessionKey?: string | null
  runtimeMs?: number | null
  sessionKey: string
  sessionUpdatedAt?: number | null
  spawnDepth?: number | null
  startedAt?: number | null
  status: string
  subject?: string | null
  subagentRole?: string | null
  syncSource: string
  totalTokens?: number | null
  transcriptHash?: string | null
  transcriptJsonl?: string | null
}

function extractStartedAtFromTranscript(
  transcriptJsonl: string | null | undefined,
): number | null {
  if (!transcriptJsonl) {
    return null
  }

  const lines = transcriptJsonl.split("\n")

  for (const line of lines) {
    if (!line.trim()) {
      continue
    }

    try {
      const parsed = JSON.parse(line) as {
        message?: {
          timestamp?: number
        }
        timestamp?: string
        type?: string
      }

      if (parsed.type === "session" && parsed.timestamp) {
        const timestampMs = new Date(parsed.timestamp).getTime()

        if (Number.isFinite(timestampMs)) {
          return timestampMs
        }
      }

      if (
        parsed.type === "message" &&
        typeof parsed.message?.timestamp === "number"
      ) {
        return parsed.message.timestamp
      }
    } catch {}
  }

  return null
}

export async function upsertTenantSessionBatch(
  tenantId: string,
  sessions: TenantSessionUpsertInput[],
) {
  if (sessions.length === 0) {
    return
  }

  const db = getDb()
  const now = new Date()

  for (const session of sessions) {
    const effectiveStartedAt =
      session.startedAt ??
      extractStartedAtFromTranscript(session.transcriptJsonl)

    await db
      .insert(tenantSessions)
      .values({
        cacheReadTokens: session.cacheReadTokens ?? null,
        cacheWriteTokens: session.cacheWriteTokens ?? null,
        channel: session.channel ?? null,
        channelProvider: session.channelProvider ?? null,
        chatType: session.chatType ?? null,
        displayName: session.displayName ?? null,
        endedAt: session.endedAt ? new Date(session.endedAt) : null,
        estimatedCostUsd: session.estimatedCostUsd ?? null,
        externalSessionId: session.externalSessionId ?? "unknown",
        inputTokens: session.inputTokens ?? null,
        label: session.label ?? null,
        lastMessageAt: session.lastMessageAt ?? null,
        lastSyncError: null,
        lastSyncedAt: now,
        messageCount: session.messageCount ?? null,
        model: session.model ?? null,
        modelProvider: session.modelProvider ?? null,
        originAccountId: session.originAccountId ?? null,
        originFrom: session.originFrom ?? null,
        originThreadId: session.originThreadId ?? null,
        originTo: session.originTo ?? null,
        outputTokens: session.outputTokens ?? null,
        parentSessionKey: session.parentSessionKey ?? null,
        runtimeMs: session.runtimeMs ?? null,
        sessionKey: session.sessionKey,
        sessionUpdatedAt: session.sessionUpdatedAt ?? null,
        spawnDepth: session.spawnDepth ?? 0,
        startedAt: effectiveStartedAt ? new Date(effectiveStartedAt) : null,
        status: session.status,
        subject: session.subject ?? null,
        subagentRole: session.subagentRole ?? null,
        syncSource: session.syncSource,
        tenantId,
        totalTokens: session.totalTokens ?? null,
        transcriptHash: session.transcriptHash ?? null,
        transcriptJsonl: session.transcriptJsonl ?? null,
      })
      .onConflictDoUpdate({
        set: {
          cacheReadTokens: session.cacheReadTokens ?? undefined,
          cacheWriteTokens: session.cacheWriteTokens ?? undefined,
          channel: session.channel ?? undefined,
          channelProvider: session.channelProvider ?? undefined,
          chatType: session.chatType ?? undefined,
          displayName: session.displayName ?? undefined,
          endedAt: session.endedAt ? new Date(session.endedAt) : undefined,
          estimatedCostUsd: session.estimatedCostUsd ?? undefined,
          inputTokens: session.inputTokens ?? undefined,
          label: session.label ?? undefined,
          lastMessageAt: session.lastMessageAt ?? undefined,
          lastSyncError: null,
          lastSyncedAt: now,
          messageCount: session.messageCount ?? undefined,
          model: session.model ?? undefined,
          modelProvider: session.modelProvider ?? undefined,
          originAccountId: session.originAccountId ?? undefined,
          originFrom: session.originFrom ?? undefined,
          originThreadId: session.originThreadId ?? undefined,
          originTo: session.originTo ?? undefined,
          outputTokens: session.outputTokens ?? undefined,
          parentSessionKey: session.parentSessionKey ?? undefined,
          runtimeMs: session.runtimeMs ?? undefined,
          sessionUpdatedAt: session.sessionUpdatedAt ?? undefined,
          spawnDepth: session.spawnDepth ?? undefined,
          startedAt: effectiveStartedAt
            ? new Date(effectiveStartedAt)
            : undefined,
          status: session.status,
          subject: session.subject ?? undefined,
          subagentRole: session.subagentRole ?? undefined,
          syncSource: session.syncSource,
          totalTokens: session.totalTokens ?? undefined,
          transcriptHash: session.transcriptHash ?? undefined,
          transcriptJsonl: session.transcriptJsonl ?? undefined,
          updatedAt: now,
        },
        target: [
          tenantSessions.tenantId,
          tenantSessions.sessionKey,
          tenantSessions.externalSessionId,
        ],
      })
  }
}

export async function listTenantSessions(input: {
  limit?: number
  offset?: number
  tenantId: string
}) {
  const db = getDb()
  const limit = input.limit ?? 100
  const offset = input.offset ?? 0

  return db
    .select({
      createdAt: tenantSessions.createdAt,
      displayName: tenantSessions.displayName,
      endedAt: tenantSessions.endedAt,
      estimatedCostUsd: tenantSessions.estimatedCostUsd,
      externalSessionId: tenantSessions.externalSessionId,
      id: tenantSessions.id,
      inputTokens: tenantSessions.inputTokens,
      label: tenantSessions.label,
      lastMessageAt: tenantSessions.lastMessageAt,
      lastSyncedAt: tenantSessions.lastSyncedAt,
      messageCount: tenantSessions.messageCount,
      model: tenantSessions.model,
      modelProvider: tenantSessions.modelProvider,
      originFrom: tenantSessions.originFrom,
      parentSessionKey: tenantSessions.parentSessionKey,
      runtimeMs: tenantSessions.runtimeMs,
      sessionKey: tenantSessions.sessionKey,
      sessionUpdatedAt: tenantSessions.sessionUpdatedAt,
      spawnDepth: tenantSessions.spawnDepth,
      startedAt: tenantSessions.startedAt,
      status: tenantSessions.status,
      subject: tenantSessions.subject,
      subagentRole: tenantSessions.subagentRole,
      totalTokens: tenantSessions.totalTokens,
    })
    .from(tenantSessions)
    .where(eq(tenantSessions.tenantId, input.tenantId))
    .orderBy(desc(tenantSessions.lastMessageAt))
    .limit(limit)
    .offset(offset)
}

export async function getTenantSession(input: {
  sessionKey: string
  tenantId: string
}) {
  const db = getDb()

  const [session] = await db
    .select({
      channel: tenantSessions.channel,
      channelProvider: tenantSessions.channelProvider,
      chatType: tenantSessions.chatType,
      displayName: tenantSessions.displayName,
      endedAt: tenantSessions.endedAt,
      estimatedCostUsd: tenantSessions.estimatedCostUsd,
      externalSessionId: tenantSessions.externalSessionId,
      id: tenantSessions.id,
      inputTokens: tenantSessions.inputTokens,
      label: tenantSessions.label,
      lastSyncedAt: tenantSessions.lastSyncedAt,
      messageCount: tenantSessions.messageCount,
      model: tenantSessions.model,
      modelProvider: tenantSessions.modelProvider,
      originFrom: tenantSessions.originFrom,
      runtimeMs: tenantSessions.runtimeMs,
      sessionKey: tenantSessions.sessionKey,
      startedAt: tenantSessions.startedAt,
      status: tenantSessions.status,
      subject: tenantSessions.subject,
      totalTokens: tenantSessions.totalTokens,
      transcriptJsonl: tenantSessions.transcriptJsonl,
    })
    .from(tenantSessions)
    .where(
      and(
        eq(tenantSessions.tenantId, input.tenantId),
        eq(tenantSessions.sessionKey, input.sessionKey),
      ),
    )
    .orderBy(desc(tenantSessions.updatedAt))
    .limit(1)

  return session ?? null
}

export async function deleteStaleTenantSessions(
  tenantId: string,
  activeSessionKeys: string[],
) {
  const db = getDb()

  if (activeSessionKeys.length === 0) {
    const deletedRows = await db
      .delete(tenantSessions)
      .where(eq(tenantSessions.tenantId, tenantId))
      .returning({
        id: tenantSessions.id,
      })

    return deletedRows.length
  }

  const deletedRows = await db
    .delete(tenantSessions)
    .where(
      and(
        eq(tenantSessions.tenantId, tenantId),
        notInArray(tenantSessions.sessionKey, activeSessionKeys),
      ),
    )
    .returning({
      id: tenantSessions.id,
    })

  return deletedRows.length
}
