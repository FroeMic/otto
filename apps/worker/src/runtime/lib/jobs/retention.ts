import { sql } from "drizzle-orm"

import { getDb } from "../../db/client"

import { appendJobEvent, markJobFailed, requeueJob } from "./queue"
import {
  type ClaimedJob,
  JOB_STATUSES,
  JOB_TYPES,
  type JobType,
  type PruneJobHistoryPayload,
} from "./types"

export const JOB_GC_INTERVAL_MS = 60 * 60 * 1000

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_PRUNE_BATCH_SIZE = 500

export interface JobRetentionPolicy {
  deleteFailed: boolean
  retentionMs: number
}

export const JOB_RETENTION_POLICIES = {
  [JOB_TYPES.provisionTenantServer]: {
    deleteFailed: false,
    retentionMs: 180 * DAY_MS,
  },
  [JOB_TYPES.provisionTenantOpenAiKey]: {
    deleteFailed: false,
    retentionMs: 180 * DAY_MS,
  },
  [JOB_TYPES.applyTenantConfig]: {
    deleteFailed: false,
    retentionMs: 7 * DAY_MS,
  },
  [JOB_TYPES.deleteTenantServer]: {
    deleteFailed: false,
    retentionMs: 180 * DAY_MS,
  },
  [JOB_TYPES.deleteWorkspace]: {
    deleteFailed: false,
    retentionMs: 180 * DAY_MS,
  },
  [JOB_TYPES.refreshRuntimeImage]: {
    deleteFailed: false,
    retentionMs: 7 * DAY_MS,
  },
  [JOB_TYPES.runWorkspaceChatTurn]: {
    deleteFailed: true,
    retentionMs: DAY_MS,
  },
  [JOB_TYPES.scheduleOauthConnectionRefresh]: {
    deleteFailed: true,
    retentionMs: 14 * DAY_MS,
  },
  [JOB_TYPES.refreshOauthConnection]: {
    deleteFailed: true,
    retentionMs: 30 * DAY_MS,
  },
  [JOB_TYPES.scheduleOpenAiUsageSync]: {
    deleteFailed: true,
    retentionMs: 60 * 60 * 1000,
  },
  [JOB_TYPES.syncOpenAiUsageTarget]: {
    deleteFailed: true,
    retentionMs: 90 * DAY_MS,
  },
  [JOB_TYPES.scheduleCreditSettlement]: {
    deleteFailed: true,
    retentionMs: 14 * DAY_MS,
  },
  [JOB_TYPES.settleCreditUsageChunk]: {
    deleteFailed: true,
    retentionMs: 90 * DAY_MS,
  },
  [JOB_TYPES.scheduleBillingAutoTopOffEnqueue]: {
    deleteFailed: true,
    retentionMs: 14 * DAY_MS,
  },
  [JOB_TYPES.executeBillingAutoTopOff]: {
    deleteFailed: false,
    retentionMs: 180 * DAY_MS,
  },
  [JOB_TYPES.reconcileTenantScheduledTasks]: {
    deleteFailed: true,
    retentionMs: 90 * DAY_MS,
  },
  [JOB_TYPES.whatsappLinkSession]: {
    deleteFailed: false,
    retentionMs: 90 * DAY_MS,
  },
  [JOB_TYPES.whatsappDisconnect]: {
    deleteFailed: false,
    retentionMs: 90 * DAY_MS,
  },
  [JOB_TYPES.resyncSlackUsers]: {
    deleteFailed: true,
    retentionMs: 30 * DAY_MS,
  },
  [JOB_TYPES.resyncSlackChannels]: {
    deleteFailed: true,
    retentionMs: 30 * DAY_MS,
  },
  [JOB_TYPES.syncTenantSessions]: {
    deleteFailed: true,
    retentionMs: 30 * DAY_MS,
  },
  [JOB_TYPES.pruneJobHistory]: {
    deleteFailed: true,
    retentionMs: 14 * DAY_MS,
  },
} as const satisfies Record<JobType, JobRetentionPolicy>

export function getJobRetentionPolicy(jobType: JobType): JobRetentionPolicy {
  return JOB_RETENTION_POLICIES[jobType]
}

export function getJobRetentionCutoff(jobType: JobType, now = new Date()) {
  const policy = getJobRetentionPolicy(jobType)
  return new Date(now.getTime() - policy.retentionMs)
}

export async function processPruneJobHistoryJob(job: ClaimedJob) {
  if (job.jobType !== JOB_TYPES.pruneJobHistory) {
    throw new Error(
      `Unsupported job type for job history retention handler: ${job.jobType}`,
    )
  }

  const payload = parsePruneJobHistoryPayload(job.payload)

  try {
    const result = await pruneJobHistory()

    await appendJobEvent(
      job.id,
      "job_history_pruned",
      `Pruned ${result.deletedJobCount} old job runs`,
      result,
    )
    await requeueJob(job.id, payload, new Date(Date.now() + JOB_GC_INTERVAL_MS))
  } catch (error) {
    const message = getErrorMessage(error)

    await appendJobEvent(
      job.id,
      "job_history_prune_failed",
      `Job history pruning failed: ${message}`,
    )
    await markJobFailed(
      job.id,
      message,
      new Date(Date.now() + JOB_GC_INTERVAL_MS),
    )
  }
}

export async function pruneJobHistory(input?: {
  batchSize?: number
  now?: Date
}) {
  const batchSize = input?.batchSize ?? DEFAULT_PRUNE_BATCH_SIZE
  const now = input?.now ?? new Date()
  const deletedByJobType: Partial<Record<JobType, number>> = {}
  let deletedJobCount = 0

  for (const jobType of Object.values(JOB_TYPES)) {
    const deletedForType = await pruneJobHistoryForType({
      batchSize,
      cutoff: getJobRetentionCutoff(jobType, now),
      jobType,
      policy: getJobRetentionPolicy(jobType),
    })

    if (deletedForType > 0) {
      deletedByJobType[jobType] = deletedForType
      deletedJobCount += deletedForType
    }
  }

  return {
    deletedByJobType,
    deletedJobCount,
  }
}

async function pruneJobHistoryForType(input: {
  batchSize: number
  cutoff: Date
  jobType: JobType
  policy: JobRetentionPolicy
}) {
  const db = getDb()
  const statuses = input.policy.deleteFailed
    ? [JOB_STATUSES.succeeded, JOB_STATUSES.failed]
    : [JOB_STATUSES.succeeded]
  const statusSql = statuses.map((status) => sql`${status}`)

  const deletedRows = await db.execute<{ id: string }>(sql`
    with deleted_jobs as (
      delete from job_runs
      where id in (
        select id
        from job_runs
        where job_type = ${input.jobType}
          and status in (${sql.join(statusSql, sql`, `)})
          and finished_at is not null
          and finished_at < ${input.cutoff}
        order by finished_at asc
        limit ${input.batchSize}
      )
      returning id
    )
    select id from deleted_jobs
  `)

  return deletedRows.length
}

function parsePruneJobHistoryPayload(
  _payload: Record<string, unknown>,
): PruneJobHistoryPayload {
  return {}
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }

  return "Unknown job history pruning error"
}
