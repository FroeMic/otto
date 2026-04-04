import { createHash } from "node:crypto";

import {
  deleteStaleTenantSessions,
  upsertTenantSessionBatch,
  type TenantSessionUpsertInput,
} from "@/db/control-plane";
import { getTenantRuntimeConnection } from "@/lib/runtime/connection";
import { SshClient } from "@/lib/ssh/client";

import { appendJobEvent, markJobFailed, markJobSucceeded } from "./queue";
import {
  type ClaimedJob,
  JOB_TYPES,
  type SyncTenantSessionsPayload,
} from "./types";

type RuntimeSessionEntry = {
  sessionId?: string;
  updatedAt?: number;
  sessionFile?: string;
  channel?: string;
  lastChannel?: string;
  chatType?: string;
  displayName?: string;
  label?: string;
  subject?: string;
  status?: string;
  startedAt?: number;
  endedAt?: number;
  runtimeMs?: number;
  model?: string;
  modelProvider?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheRead?: number;
  cacheWrite?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  parentSessionKey?: string;
  spawnDepth?: number;
  subagentRole?: string;
  lastAccountId?: string;
  lastThreadId?: string | number;
  origin?: {
    provider?: string;
    chatType?: string;
    from?: string;
    to?: string;
    accountId?: string;
    threadId?: string | number;
  };
};

const SESSIONS_JSON_PATH =
  "/home/node/.openclaw/agents/main/sessions/sessions.json";
const SESSIONS_DIR = "/home/node/.openclaw/agents/main/sessions";

const sshClient = new SshClient();

export async function processSyncTenantSessionsJob(
  job: ClaimedJob,
): Promise<void> {
  if (job.jobType !== JOB_TYPES.syncTenantSessions) {
    throw new Error(
      `Unsupported job type for sessions sync handler: ${job.jobType}`,
    );
  }

  const payload = parsePayload(job.payload);

  try {
    await appendJobEvent(
      job.id,
      "connecting_runtime",
      "Connecting to tenant runtime",
    );

    const connection = await getTenantRuntimeConnection(
      payload.tenantId,
      "session refresh",
    );

    await appendJobEvent(
      job.id,
      "reading_session_store",
      "Reading sessions.json from runtime",
    );

    const storeResult = await sshClient.exec(
      connection,
      buildShellCmd(`docker exec openclaw-gateway cat ${SESSIONS_JSON_PATH}`),
      { timeoutMs: 30_000 },
    );

    if (storeResult.exitCode !== 0) {
      throw new Error(
        `Failed to read sessions.json: ${storeResult.stderr || storeResult.stdout}`,
      );
    }

    const store = JSON.parse(storeResult.stdout) as Record<
      string,
      RuntimeSessionEntry
    >;

    // Build set of sessionIds that have a :run: key so we can skip
    // base cron keys that point to the same session.
    const runSessionIds = new Set<string>();
    for (const [key, entry] of Object.entries(store)) {
      if (key.includes(":run:") && entry?.sessionId) {
        runSessionIds.add(entry.sessionId);
      }
    }

    const sessionKeys = Object.keys(store);

    await appendJobEvent(
      job.id,
      "reading_transcripts",
      `Reading transcripts for ${sessionKeys.length} sessions`,
    );

    const sessions: TenantSessionUpsertInput[] = [];

    for (const sessionKey of sessionKeys) {
      const entry = store[sessionKey];
      if (!entry?.sessionId) continue;

      // Skip base cron keys when a run-specific key exists for the same sessionId
      if (!sessionKey.includes(":run:") && runSessionIds.has(entry.sessionId)) {
        continue;
      }

      const filePath = resolveTranscriptPath(entry);
      let transcript: {
        transcriptJsonl: string;
        transcriptHash: string;
        messageCount: number;
      } | null = null;

      if (filePath) {
        try {
          const result = await sshClient.exec(
            connection,
            buildShellCmd(`docker exec openclaw-gateway cat ${shellQuote(filePath)}`),
            { timeoutMs: 30_000 },
          );

          if (result.exitCode === 0 && result.stdout) {
            const content = result.stdout;
            const hash = createHash("sha256").update(content).digest("hex");
            const lineCount = content
              .split("\n")
              .filter((l: string) => l.trim()).length;
            transcript = {
              transcriptJsonl: content,
              transcriptHash: hash,
              messageCount: Math.max(0, lineCount - 1),
            };
          }
        } catch {
          // Transcript file may not exist or be unreadable — skip it
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
        originAccountId:
          entry.lastAccountId ?? entry.origin?.accountId ?? null,
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
      });
    }

    await upsertTenantSessionBatch(payload.tenantId, sessions);

    // Clean up rows for sessions no longer in the runtime session store
    const activeKeys = sessions.map((s) => s.sessionKey);
    const deletedCount = await deleteStaleTenantSessions(
      payload.tenantId,
      activeKeys,
    );

    const withTranscript = sessions.filter((s) => s.transcriptJsonl).length;
    await appendJobEvent(
      job.id,
      "succeeded",
      `Synced ${sessions.length} sessions (${withTranscript} with transcripts), cleaned up ${deletedCount} stale rows`,
    );
    await markJobSucceeded(job.id, {
      syncedSessions: sessions.length,
      syncedTranscripts: withTranscript,
      deletedStale: deletedCount,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    await appendJobEvent(
      job.id,
      "failed",
      `Session refresh failed: ${message}`,
    );
    await markJobFailed(job.id, message);
    throw error;
  }
}

function resolveTranscriptPath(entry: RuntimeSessionEntry): string | null {
  if (entry.sessionFile) return entry.sessionFile;
  if (entry.sessionId) return `${SESSIONS_DIR}/${entry.sessionId}.jsonl`;
  return null;
}

function buildShellCmd(command: string): string {
  return `bash -lc ${shellQuote(command)}`;
}

function shellQuote(s: string): string {
  return `'${s.replaceAll("'", `'"'"'`)}'`;
}

function parsePayload(
  payload: Record<string, unknown>,
): SyncTenantSessionsPayload {
  const tenantId = payload.tenantId;
  if (typeof tenantId !== "string" || tenantId.length === 0) {
    throw new Error("Session sync payload is missing tenantId");
  }
  return { tenantId };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
