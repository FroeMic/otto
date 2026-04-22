import {
  beginProviderUsageSyncAttempt,
  getOpenAiUsageSyncTargetByProviderAccountId,
  listDueOpenAiUsageSyncTargets,
  markProviderUsageSyncFailed,
  markProviderUsageSyncSucceeded,
  upsertProviderUsageBuckets,
} from "../../db/provider-usage"
import { OpenAiUsageCollector } from "../providers/openai/usage"
import {
  PROVIDER_USAGE_BUCKET_WIDTHS,
  PROVIDER_USAGE_GROUP_BY_FIELDS,
  PROVIDER_USAGE_TYPES,
  type ProviderUsageGroupByField,
  type ProviderUsageType,
} from "../providers/types"

import {
  appendJobEvent,
  enqueueJob,
  listQueuedOrRunningJobsByType,
  markJobFailed,
  markJobSucceeded,
  requeueJob,
} from "./queue"
import {
  type ClaimedJob,
  JOB_TYPES,
  type ScheduleOpenAiUsageSyncPayload,
  type SyncOpenAiUsageTargetPayload,
} from "./types"

const openAiUsageCollector = new OpenAiUsageCollector()

const OPENAI_USAGE_POLL_INTERVAL_MS = 60_000
const OPENAI_USAGE_SCHEDULER_SWEEP_INTERVAL_MS = 30_000
const OPENAI_USAGE_INITIAL_LOOKBACK_MINUTES = 60
const OPENAI_USAGE_OVERLAP_LOOKBACK_MINUTES = 15

const OPENAI_USAGE_CONFIGS: Array<{
  groupBy: ProviderUsageGroupByField[]
  usageType: ProviderUsageType
}> = [
  {
    groupBy: [
      PROVIDER_USAGE_GROUP_BY_FIELDS.projectId,
      PROVIDER_USAGE_GROUP_BY_FIELDS.apiKeyId,
      PROVIDER_USAGE_GROUP_BY_FIELDS.model,
    ],
    usageType: PROVIDER_USAGE_TYPES.completions,
  },
  {
    groupBy: [
      PROVIDER_USAGE_GROUP_BY_FIELDS.projectId,
      PROVIDER_USAGE_GROUP_BY_FIELDS.apiKeyId,
      PROVIDER_USAGE_GROUP_BY_FIELDS.model,
    ],
    usageType: PROVIDER_USAGE_TYPES.embeddings,
  },
  {
    groupBy: [
      PROVIDER_USAGE_GROUP_BY_FIELDS.projectId,
      PROVIDER_USAGE_GROUP_BY_FIELDS.apiKeyId,
      PROVIDER_USAGE_GROUP_BY_FIELDS.model,
    ],
    usageType: PROVIDER_USAGE_TYPES.audioSpeeches,
  },
  {
    groupBy: [
      PROVIDER_USAGE_GROUP_BY_FIELDS.projectId,
      PROVIDER_USAGE_GROUP_BY_FIELDS.apiKeyId,
      PROVIDER_USAGE_GROUP_BY_FIELDS.model,
    ],
    usageType: PROVIDER_USAGE_TYPES.audioTranscriptions,
  },
  {
    groupBy: [
      PROVIDER_USAGE_GROUP_BY_FIELDS.projectId,
      PROVIDER_USAGE_GROUP_BY_FIELDS.apiKeyId,
      PROVIDER_USAGE_GROUP_BY_FIELDS.model,
    ],
    usageType: PROVIDER_USAGE_TYPES.images,
  },
  {
    groupBy: [
      PROVIDER_USAGE_GROUP_BY_FIELDS.projectId,
      PROVIDER_USAGE_GROUP_BY_FIELDS.apiKeyId,
      PROVIDER_USAGE_GROUP_BY_FIELDS.model,
    ],
    usageType: PROVIDER_USAGE_TYPES.moderations,
  },
  {
    groupBy: [PROVIDER_USAGE_GROUP_BY_FIELDS.projectId],
    usageType: PROVIDER_USAGE_TYPES.vectorStores,
  },
  {
    groupBy: [PROVIDER_USAGE_GROUP_BY_FIELDS.projectId],
    usageType: PROVIDER_USAGE_TYPES.codeInterpreterSessions,
  },
]

export async function processScheduleOpenAiUsageSyncJob(
  job: ClaimedJob,
): Promise<void> {
  if (job.jobType !== JOB_TYPES.scheduleOpenAiUsageSync) {
    throw new Error(
      `Unsupported job type for OpenAI usage scheduler: ${job.jobType}`,
    )
  }

  const payload = parseScheduleOpenAiUsageSyncPayload(job.payload)

  try {
    const queuedCount = await scheduleOpenAiUsageSyncJobs()

    await appendJobEvent(
      job.id,
      "openai_usage_scheduler_succeeded",
      `Queued ${queuedCount} OpenAI usage sync jobs`,
      {
        queuedCount,
      },
    )
    await requeueJob(
      job.id,
      payload,
      new Date(Date.now() + OPENAI_USAGE_SCHEDULER_SWEEP_INTERVAL_MS),
    )
  } catch (error) {
    const message = getErrorMessage(error)

    await appendJobEvent(
      job.id,
      "openai_usage_scheduler_failed",
      `OpenAI usage scheduler failed: ${message}`,
    )
    await markJobFailed(
      job.id,
      message,
      new Date(Date.now() + OPENAI_USAGE_SCHEDULER_SWEEP_INTERVAL_MS),
    )
  }
}

export async function processSyncOpenAiUsageTargetJob(
  job: ClaimedJob,
): Promise<void> {
  if (job.jobType !== JOB_TYPES.syncOpenAiUsageTarget) {
    throw new Error(
      `Unsupported job type for OpenAI usage sync target: ${job.jobType}`,
    )
  }

  const payload = parseSyncOpenAiUsageTargetPayload(job.payload)

  if (!payload) {
    throw new Error(
      "OpenAI usage sync job payload is missing providerAccountId or usageType",
    )
  }
  const usageConfig = OPENAI_USAGE_CONFIGS.find(
    (config) => config.usageType === payload.usageType,
  )

  if (!usageConfig) {
    throw new Error(
      `Unsupported OpenAI usage type in sync payload: ${payload.usageType}`,
    )
  }

  try {
    const target = await getOpenAiUsageSyncTargetByProviderAccountId({
      providerAccountId: payload.providerAccountId,
      usageType: payload.usageType,
    })

    if (
      !target ||
      target.status !== "active" ||
      !target.externalProjectId ||
      !target.tenantId
    ) {
      await appendJobEvent(
        job.id,
        "openai_usage_sync_skipped",
        "Skipped OpenAI usage sync because the provider account is no longer eligible",
        {
          providerAccountId: payload.providerAccountId,
          usageType: payload.usageType,
        },
      )
      await markJobSucceeded(job.id, {
        providerAccountId: payload.providerAccountId,
        skipped: true,
        usageType: payload.usageType,
      })
      return
    }

    await appendJobEvent(
      job.id,
      "openai_usage_sync_started",
      "Syncing OpenAI usage buckets",
      {
        providerAccountId: target.providerAccountId,
        usageType: payload.usageType,
      },
    )

    const rowCount = await syncOpenAiUsageTarget({
      externalProjectId: target.externalProjectId,
      groupBy: usageConfig.groupBy,
      lastSuccessfulEndAt: target.lastSuccessfulEndAt,
      pollIntervalSeconds: target.pollIntervalSeconds ?? 60,
      providerAccountId: target.providerAccountId,
      tenantId: target.tenantId,
      usageType: payload.usageType,
    })

    await appendJobEvent(
      job.id,
      "openai_usage_sync_succeeded",
      `Synced ${rowCount} OpenAI usage rows`,
      {
        providerAccountId: target.providerAccountId,
        rowCount,
        usageType: payload.usageType,
      },
    )
    await markJobSucceeded(job.id, {
      providerAccountId: target.providerAccountId,
      rowCount,
      usageType: payload.usageType,
    })
  } catch (error) {
    const message = getErrorMessage(error)

    await appendJobEvent(
      job.id,
      "openai_usage_sync_failed",
      `OpenAI usage sync failed: ${message}`,
      {
        providerAccountId: payload.providerAccountId,
        usageType: payload.usageType,
      },
    )
    await markJobFailed(job.id, message)
    throw error
  }
}

async function scheduleOpenAiUsageSyncJobs() {
  const activeJobs = await listQueuedOrRunningJobsByType(
    JOB_TYPES.syncOpenAiUsageTarget,
  )
  const activeKeys = new Set<string>()

  for (const activeJob of activeJobs) {
    const payload = parseSyncOpenAiUsageTargetPayload(activeJob.payload, {
      allowInvalid: true,
    })

    if (!payload) {
      continue
    }

    activeKeys.add(buildUsageTargetKey(payload))
  }

  let queuedCount = 0

  for (const usageConfig of OPENAI_USAGE_CONFIGS) {
    const dueTargets = await listDueOpenAiUsageSyncTargets({
      pollIntervalMs: OPENAI_USAGE_POLL_INTERVAL_MS,
      usageType: usageConfig.usageType,
    })

    for (const dueTarget of dueTargets) {
      if (!dueTarget.externalProjectId) {
        continue
      }
      const jobPayload: SyncOpenAiUsageTargetPayload = {
        providerAccountId: dueTarget.providerAccountId,
        usageType: usageConfig.usageType,
      }
      const key = buildUsageTargetKey(jobPayload)

      if (activeKeys.has(key)) {
        continue
      }

      await enqueueJob({
        jobType: JOB_TYPES.syncOpenAiUsageTarget,
        payload: jobPayload,
      })
      activeKeys.add(key)
      queuedCount += 1
    }
  }

  return queuedCount
}

async function syncOpenAiUsageTarget(input: {
  externalProjectId: string
  groupBy: ProviderUsageGroupByField[]
  lastSuccessfulEndAt: Date | null
  pollIntervalSeconds: number
  providerAccountId: string
  tenantId: string
  usageType: ProviderUsageType
}) {
  const window = determineUsageWindow(input.lastSuccessfulEndAt)

  await beginProviderUsageSyncAttempt({
    pollIntervalSeconds: input.pollIntervalSeconds,
    providerAccountId: input.providerAccountId,
    tenantId: input.tenantId,
    usageType: input.usageType,
  })

  let rowCount = 0

  try {
    let nextPage: string | null = null

    do {
      const usagePage = await openAiUsageCollector.fetchUsageBuckets({
        bucketWidth: PROVIDER_USAGE_BUCKET_WIDTHS.oneMinute,
        endTime: window.endTime,
        groupBy: input.groupBy,
        page: nextPage,
        projectId: input.externalProjectId,
        startTime: window.startTime,
        usageType: input.usageType,
      })

      rowCount += await upsertProviderUsageBuckets({
        buckets: usagePage.buckets,
        providerAccountId: input.providerAccountId,
        tenantId: input.tenantId,
        usageType: input.usageType,
      })
      nextPage = usagePage.nextPage
    } while (nextPage)

    await markProviderUsageSyncSucceeded({
      lastSuccessfulEndAt: window.endTime,
      providerAccountId: input.providerAccountId,
      rowCount,
      usageType: input.usageType,
    })
  } catch (error) {
    await markProviderUsageSyncFailed({
      error: getErrorMessage(error),
      providerAccountId: input.providerAccountId,
      usageType: input.usageType,
    })
    throw error
  }

  return rowCount
}

function determineUsageWindow(previousSuccessfulEndAt: Date | null) {
  const endTime = floorDateToMinute(new Date())
  const startTime = previousSuccessfulEndAt
    ? new Date(
        previousSuccessfulEndAt.getTime() -
          OPENAI_USAGE_OVERLAP_LOOKBACK_MINUTES * 60_000,
      )
    : new Date(
        endTime.getTime() - OPENAI_USAGE_INITIAL_LOOKBACK_MINUTES * 60_000,
      )

  return {
    endTime,
    startTime,
  }
}

function parseScheduleOpenAiUsageSyncPayload(
  payload: Record<string, unknown>,
): ScheduleOpenAiUsageSyncPayload {
  return payload as ScheduleOpenAiUsageSyncPayload
}

function parseSyncOpenAiUsageTargetPayload(
  payload: Record<string, unknown>,
  options?: {
    allowInvalid?: boolean
  },
): SyncOpenAiUsageTargetPayload | null {
  const providerAccountId = payload.providerAccountId
  const usageType = payload.usageType

  if (
    typeof providerAccountId !== "string" ||
    providerAccountId.length === 0 ||
    typeof usageType !== "string" ||
    !isProviderUsageType(usageType)
  ) {
    if (options?.allowInvalid) {
      return null
    }

    throw new Error(
      "OpenAI usage sync job payload is missing providerAccountId or usageType",
    )
  }

  return {
    providerAccountId,
    usageType,
  }
}

function isProviderUsageType(value: string): value is ProviderUsageType {
  return Object.values(PROVIDER_USAGE_TYPES).includes(
    value as (typeof PROVIDER_USAGE_TYPES)[keyof typeof PROVIDER_USAGE_TYPES],
  )
}

function buildUsageTargetKey(input: SyncOpenAiUsageTargetPayload) {
  return `${input.providerAccountId}:${input.usageType}`
}

function floorDateToMinute(value: Date) {
  const floored = new Date(value)

  floored.setSeconds(0, 0)

  return floored
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }

  return "Unknown OpenAI usage ingestion error"
}
