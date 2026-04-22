import { createHash } from "node:crypto"

import {
  listTenantSessionSyncStates,
  type TenantSessionSyncState,
  type TenantSessionUpsertInput,
  upsertTenantSessionBatch,
} from "../../db/control-plane"
import { getTenantRuntimeConnection } from "../runtime/connection"
import { SshClient, type SshConnection } from "../ssh/client"

import { appendJobEvent, markJobFailed, markJobSucceeded } from "./queue"
import {
  type ClaimedJob,
  JOB_TYPES,
  type SyncTenantSessionsPayload,
} from "./types"

type RuntimeSessionEntry = {
  sessionId?: string
  updatedAt?: number
  sessionFile?: string
  channel?: string
  lastChannel?: string
  chatType?: string
  displayName?: string
  label?: string
  subject?: string
  status?: string
  startedAt?: number
  endedAt?: number
  runtimeMs?: number
  model?: string
  modelProvider?: string
  inputTokens?: number
  outputTokens?: number
  cacheRead?: number
  cacheWrite?: number
  totalTokens?: number
  estimatedCostUsd?: number
  parentSessionKey?: string
  spawnDepth?: number
  subagentRole?: string
  lastAccountId?: string
  lastThreadId?: string | number
  origin?: {
    provider?: string
    chatType?: string
    from?: string
    to?: string
    accountId?: string
    threadId?: string | number
  }
}

const SESSIONS_JSON_PATH =
  "/home/node/.openclaw/agents/main/sessions/sessions.json"
const SESSIONS_DIR = "/home/node/.openclaw/agents/main/sessions"

const sshClient = new SshClient()

export async function processSyncTenantSessionsJob(
  job: ClaimedJob,
): Promise<void> {
  if (job.jobType !== JOB_TYPES.syncTenantSessions) {
    throw new Error(
      `Unsupported job type for sessions sync handler: ${job.jobType}`,
    )
  }

  const payload = parsePayload(job.payload)

  try {
    await appendJobEvent(
      job.id,
      "connecting_runtime",
      "Connecting to tenant runtime",
    )

    const connection = await getTenantRuntimeConnection(
      payload.tenantId,
      "session refresh",
    )

    await appendJobEvent(
      job.id,
      "reading_session_store",
      "Reading runtime session store for reconciliation",
    )

    const storeResult = await sshClient.exec(
      connection,
      buildShellCmd(`docker exec openclaw-gateway cat ${SESSIONS_JSON_PATH}`),
      { timeoutMs: 30_000 },
    )

    if (storeResult.exitCode !== 0) {
      throw new Error(
        `Failed to read sessions.json: ${storeResult.stderr || storeResult.stdout}`,
      )
    }

    const store = JSON.parse(storeResult.stdout) as Record<
      string,
      RuntimeSessionEntry
    >

    const sessionKeys = selectCanonicalSessionKeys(store)
    const existingStates = await listTenantSessionSyncStates({
      sessionKeys,
      tenantId: payload.tenantId,
    })
    const existingBySessionKey = new Map(
      existingStates.map((state) => [state.sessionKey, state] as const),
    )

    await appendJobEvent(
      job.id,
      "reading_transcripts",
      `Reconciling ${sessionKeys.length} runtime sessions`,
    )

    const sessions: TenantSessionUpsertInput[] = []
    let skippedUnchanged = 0
    let missingTranscripts = 0
    let transcriptsRead = 0

    for (const sessionKey of sessionKeys) {
      const entry = store[sessionKey]
      if (!entry?.sessionId) continue

      const decision = shouldReconcileSession({
        existing: existingBySessionKey.get(sessionKey) ?? null,
        runtimeSessionUpdatedAt: entry.updatedAt ?? null,
      })

      if (!decision.reconcile) {
        skippedUnchanged += 1
        continue
      }

      const filePath = resolveTranscriptPath(entry)
      let transcript: {
        transcriptJsonl: string
        transcriptHash: string
        messageCount: number
      } | null = null

      if (filePath && decision.readTranscript) {
        transcript = await readTranscriptOverSsh(
          sshClient,
          connection,
          filePath,
        )
        if (transcript) {
          transcriptsRead += 1
        } else {
          missingTranscripts += 1
        }
      }

      sessions.push({
        sessionKey,
        externalSessionId: entry.sessionId,
        displayName: entry.displayName ?? null,
        label: entry.label ?? null,
        subject: entry.subject ?? null,
        channel: entry.channel ?? entry.lastChannel ?? null,
        channelProvider: entry.origin?.provider ?? null,
        chatType: entry.chatType ?? entry.origin?.chatType ?? null,
        originFrom: entry.origin?.from ?? null,
        originTo: entry.origin?.to ?? null,
        originAccountId: entry.lastAccountId ?? entry.origin?.accountId ?? null,
        originThreadId: entry.lastThreadId
          ? String(entry.lastThreadId)
          : entry.origin?.threadId
            ? String(entry.origin.threadId)
            : null,
        status: entry.status ?? "active",
        startedAt: entry.startedAt ?? null,
        endedAt: entry.endedAt ?? null,
        runtimeMs: entry.runtimeMs ?? null,
        model: entry.model ?? null,
        modelProvider: entry.modelProvider ?? null,
        inputTokens: entry.inputTokens ?? null,
        outputTokens: entry.outputTokens ?? null,
        cacheReadTokens: entry.cacheRead ?? null,
        cacheWriteTokens: entry.cacheWrite ?? null,
        totalTokens: entry.totalTokens ?? null,
        estimatedCostUsd: entry.estimatedCostUsd
          ? String(entry.estimatedCostUsd)
          : null,
        parentSessionKey: entry.parentSessionKey ?? null,
        spawnDepth: entry.spawnDepth ?? 0,
        subagentRole: entry.subagentRole ?? null,
        sessionUpdatedAt: entry.updatedAt ?? null,
        syncSource: "reconciliation",
        ...(transcript ?? {}),
      })
    }

    await upsertTenantSessionBatch(payload.tenantId, sessions)

    const withTranscript = sessions.filter((s) => s.transcriptJsonl).length
    await appendJobEvent(
      job.id,
      "succeeded",
      `Reconciled ${sessions.length} sessions (${withTranscript} with transcripts), skipped ${skippedUnchanged} unchanged`,
    )
    await markJobSucceeded(job.id, {
      discoveredSessions: sessionKeys.length,
      missingTranscripts,
      skippedUnchanged,
      syncedSessions: sessions.length,
      syncedTranscripts: withTranscript,
      transcriptsRead,
    })
  } catch (error) {
    const message = getErrorMessage(error)
    await appendJobEvent(job.id, "failed", `Session refresh failed: ${message}`)
    await markJobFailed(job.id, message)
    throw error
  }
}

type SessionReconciliationDecision = {
  readTranscript: boolean
  reason: "missing" | "newer" | "missing_transcript_hash" | "unchanged"
  reconcile: boolean
}

function selectCanonicalSessionKeys(
  store: Record<string, RuntimeSessionEntry>,
): string[] {
  const runSessionIds = new Set<string>()
  for (const [key, entry] of Object.entries(store)) {
    if (key.includes(":run:") && entry?.sessionId) {
      runSessionIds.add(entry.sessionId)
    }
  }

  return Object.keys(store).filter((sessionKey) => {
    const entry = store[sessionKey]
    if (!entry?.sessionId) return false

    return sessionKey.includes(":run:") || !runSessionIds.has(entry.sessionId)
  })
}

function shouldReconcileSession(input: {
  existing: Pick<
    TenantSessionSyncState,
    "sessionUpdatedAt" | "transcriptHash"
  > | null
  runtimeSessionUpdatedAt: number | null
}): SessionReconciliationDecision {
  if (!input.existing) {
    return { readTranscript: true, reconcile: true, reason: "missing" }
  }

  if (!input.existing.transcriptHash) {
    return {
      readTranscript: true,
      reconcile: true,
      reason: "missing_transcript_hash",
    }
  }

  if (
    typeof input.runtimeSessionUpdatedAt === "number" &&
    input.runtimeSessionUpdatedAt > (input.existing.sessionUpdatedAt ?? 0)
  ) {
    return { readTranscript: true, reconcile: true, reason: "newer" }
  }

  return { readTranscript: false, reconcile: false, reason: "unchanged" }
}

type TranscriptResult = {
  transcriptJsonl: string
  transcriptHash: string
  messageCount: number
  lastMessageAt: number | null
}

async function readTranscriptOverSsh(
  ssh: SshClient,
  connection: SshConnection,
  filePath: string,
): Promise<TranscriptResult | null> {
  // Try the primary path first
  const content = await tryReadFileOverSsh(ssh, connection, filePath)
  if (content) return buildTranscriptResult(content)

  // Fall back to .deleted.* or .reset.* variants (one-shot crons, pruned sessions)
  const lsResult = await ssh.exec(
    connection,
    buildShellCmd(
      `docker exec openclaw-gateway sh -c 'ls ${shellQuote(filePath)}.deleted.* ${shellQuote(filePath)}.reset.* 2>/dev/null | head -1'`,
    ),
    { timeoutMs: 10_000 },
  )

  const archivedPath = lsResult.exitCode === 0 ? lsResult.stdout.trim() : ""
  if (!archivedPath) return null

  const archivedContent = await tryReadFileOverSsh(
    ssh,
    connection,
    archivedPath,
  )
  if (archivedContent) return buildTranscriptResult(archivedContent)

  return null
}

async function tryReadFileOverSsh(
  ssh: SshClient,
  connection: SshConnection,
  filePath: string,
): Promise<string | null> {
  try {
    const result = await ssh.exec(
      connection,
      buildShellCmd(`docker exec openclaw-gateway cat ${shellQuote(filePath)}`),
      { timeoutMs: 30_000 },
    )
    return result.exitCode === 0 && result.stdout ? result.stdout : null
  } catch {
    return null
  }
}

function buildTranscriptResult(content: string): TranscriptResult {
  const hash = createHash("sha256").update(content).digest("hex")
  const lines = content.split("\n").filter((l: string) => l.trim())
  let lastMessageAt: number | null = null
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const entry = JSON.parse(lines[i])
      if (
        entry.type === "message" &&
        typeof entry.message?.timestamp === "number"
      ) {
        lastMessageAt = entry.message.timestamp
        break
      }
    } catch {
      /* skip malformed lines */
    }
  }
  return {
    transcriptJsonl: content,
    transcriptHash: hash,
    messageCount: Math.max(0, lines.length - 1),
    lastMessageAt,
  }
}

function resolveTranscriptPath(entry: RuntimeSessionEntry): string | null {
  if (entry.sessionFile) return entry.sessionFile
  if (entry.sessionId) return `${SESSIONS_DIR}/${entry.sessionId}.jsonl`
  return null
}

function buildShellCmd(command: string): string {
  return `bash -lc ${shellQuote(command)}`
}

function shellQuote(s: string): string {
  return `'${s.replaceAll("'", `'"'"'`)}'`
}

function parsePayload(
  payload: Record<string, unknown>,
): SyncTenantSessionsPayload {
  const tenantId = payload.tenantId
  if (typeof tenantId !== "string" || tenantId.length === 0) {
    throw new Error("Session sync payload is missing tenantId")
  }
  const mode = payload.mode
  if (
    mode !== undefined &&
    mode !== "new_or_changed"
  ) {
    throw new Error(`Unsupported session sync mode: ${String(mode)}`)
  }

  const reason = payload.reason
  if (
    reason !== undefined &&
    reason !== "cron_run_pushed" &&
    reason !== "manual" &&
    reason !== "repair" &&
    reason !== "scheduled_backfill"
  ) {
    throw new Error(`Unsupported session sync reason: ${String(reason)}`)
  }

  return { mode, reason, tenantId }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const __testing = {
  selectCanonicalSessionKeys,
  shouldReconcileSession,
}
