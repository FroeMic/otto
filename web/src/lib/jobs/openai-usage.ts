import { getProviderAccountByTenantAndKey } from "@/db/provider-accounts";
import {
  createProviderUsageIngestionRun,
  getLatestProviderUsageIngestionRun,
  listDueOpenAiUsageIngestionTargets,
  markProviderUsageIngestionRunFailed,
  markProviderUsageIngestionRunSucceeded,
  upsertProviderUsageBuckets,
} from "@/db/provider-usage";
import { OpenAiUsageCollector } from "@/lib/providers/openai/usage";
import {
  PROVIDER_USAGE_BUCKET_WIDTHS,
  PROVIDER_USAGE_GROUP_BY_FIELDS,
  PROVIDER_USAGE_TYPES,
  type ProviderUsageGroupByField,
  type ProviderUsageType,
} from "@/lib/providers/types";

import {
  appendJobEvent,
  enqueueJob,
  markJobFailed,
  markJobSucceeded,
} from "./queue";
import { type ClaimedJob, JOB_TYPES } from "./types";

const openAiUsageCollector = new OpenAiUsageCollector();

const OPENAI_USAGE_POLL_INTERVAL_MS = 60_000;
const OPENAI_USAGE_SCHEDULER_SWEEP_INTERVAL_MS = 30_000;
const OPENAI_USAGE_INITIAL_LOOKBACK_MINUTES = 60;
const OPENAI_USAGE_OVERLAP_LOOKBACK_MINUTES = 15;

const OPENAI_USAGE_CONFIGS: Array<{
  groupBy: ProviderUsageGroupByField[];
  usageType: ProviderUsageType;
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
];

const OPENAI_USAGE_INGEST_EVENTS = {
  failed: "ingest_openai_usage_failed",
  queued: "ingest_openai_usage_queued",
  storingBuckets: "storing_openai_usage_buckets",
  succeeded: "ingest_openai_usage_succeeded",
  syncing: "syncing_openai_usage",
} as const;

let nextSchedulerSweepAt = 0;

export async function scheduleOpenAiUsageIngestionJobs() {
  const now = Date.now();

  if (now < nextSchedulerSweepAt) {
    return 0;
  }

  nextSchedulerSweepAt = now + OPENAI_USAGE_SCHEDULER_SWEEP_INTERVAL_MS;

  let queuedCount = 0;

  for (const usageConfig of OPENAI_USAGE_CONFIGS) {
    const dueTargets = await listDueOpenAiUsageIngestionTargets({
      pollIntervalMs: OPENAI_USAGE_POLL_INTERVAL_MS,
      usageType: usageConfig.usageType,
    });

    for (const dueTarget of dueTargets) {
      const jobId = await enqueueJob({
        jobType: JOB_TYPES.ingestOpenAiUsage,
        payload: {
          tenantId: dueTarget.tenantId,
          usageType: usageConfig.usageType,
        },
      });
      queuedCount += 1;

      await appendJobEvent(
        jobId,
        OPENAI_USAGE_INGEST_EVENTS.queued,
        "Queued OpenAI usage ingestion",
        {
          providerAccountId: dueTarget.providerAccountId,
          projectId: dueTarget.externalProjectId,
          tenantId: dueTarget.tenantId,
          usageType: usageConfig.usageType,
        },
      );
    }
  }

  return queuedCount;
}

export async function processIngestOpenAiUsageJob(
  job: ClaimedJob,
): Promise<void> {
  if (job.jobType !== JOB_TYPES.ingestOpenAiUsage) {
    throw new Error(
      `Unsupported job type for OpenAI usage ingestion handler: ${job.jobType}`,
    );
  }

  const payload = parseIngestOpenAiUsagePayload(job.payload);
  const usageConfig = getOpenAiUsageConfig(payload.usageType);
  const providerAccount = await getProviderAccountByTenantAndKey(
    payload.tenantId,
    "openai",
  );

  if (!providerAccount?.externalProjectId) {
    const message =
      "OpenAI usage ingestion requires an active tenant provider account with a project id";
    await markJobFailed(job.id, message);
    throw new Error(message);
  }

  const latestRun = await getLatestProviderUsageIngestionRun({
    providerAccountId: providerAccount.id,
    providerKey: "openai",
    usageType: payload.usageType,
  });
  const window = determineUsageWindow(latestRun?.requestedEndAt ?? null);
  const requestJson = {
    bucketWidth: PROVIDER_USAGE_BUCKET_WIDTHS.oneMinute,
    endTime: window.endTime.toISOString(),
    groupBy: usageConfig.groupBy,
    projectId: providerAccount.externalProjectId,
    startTime: window.startTime.toISOString(),
    usageType: payload.usageType,
  };
  const ingestionRun = await createProviderUsageIngestionRun({
    bucketWidth: PROVIDER_USAGE_BUCKET_WIDTHS.oneMinute,
    groupBy: usageConfig.groupBy,
    jobRunId: job.id,
    providerAccountId: providerAccount.id,
    providerKey: "openai",
    requestJson,
    requestedEndAt: window.endTime,
    requestedStartAt: window.startTime,
    status: "running",
    tenantId: payload.tenantId,
    usageType: payload.usageType,
  });

  let pageCount = 0;
  let rowCount = 0;
  const startedAt = Date.now();

  try {
    await appendJobEvent(
      job.id,
      OPENAI_USAGE_INGEST_EVENTS.syncing,
      "Syncing raw OpenAI usage buckets",
      {
        bucketWidth: PROVIDER_USAGE_BUCKET_WIDTHS.oneMinute,
        endTime: window.endTime.toISOString(),
        projectId: providerAccount.externalProjectId,
        startTime: window.startTime.toISOString(),
        tenantId: payload.tenantId,
        usageType: payload.usageType,
      },
    );

    let nextPage: string | null = null;

    do {
      const usagePage = await openAiUsageCollector.fetchUsageBuckets({
        bucketWidth: PROVIDER_USAGE_BUCKET_WIDTHS.oneMinute,
        endTime: window.endTime,
        groupBy: usageConfig.groupBy,
        page: nextPage,
        projectId: providerAccount.externalProjectId,
        startTime: window.startTime,
        usageType: payload.usageType,
      });

      pageCount += 1;

      if (usagePage.buckets.length > 0) {
        await appendJobEvent(
          job.id,
          OPENAI_USAGE_INGEST_EVENTS.storingBuckets,
          "Storing raw OpenAI usage buckets",
          {
            bucketCount: usagePage.buckets.length,
            pageCount,
            tenantId: payload.tenantId,
          },
        );
      }

      rowCount += await upsertProviderUsageBuckets({
        buckets: usagePage.buckets,
        ingestionRunId: ingestionRun.id,
        providerAccountId: providerAccount.id,
        providerKey: "openai",
        tenantId: payload.tenantId,
        usageType: payload.usageType,
      });
      nextPage = usagePage.nextPage;
    } while (nextPage);

    const requestLatencyMs = Date.now() - startedAt;

    await markProviderUsageIngestionRunSucceeded({
      ingestionRunId: ingestionRun.id,
      pageCount,
      requestLatencyMs,
      rowCount,
    });
    await appendJobEvent(
      job.id,
      OPENAI_USAGE_INGEST_EVENTS.succeeded,
      "Stored raw OpenAI usage buckets",
      {
        pageCount,
        projectId: providerAccount.externalProjectId,
        rowCount,
        tenantId: payload.tenantId,
        usageType: payload.usageType,
      },
    );
    await markJobSucceeded(job.id, {
      pageCount,
      projectId: providerAccount.externalProjectId,
      requestedEndAt: window.endTime.toISOString(),
      requestedStartAt: window.startTime.toISOString(),
      rowCount,
      tenantId: payload.tenantId,
      usageType: payload.usageType,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    const requestLatencyMs = Date.now() - startedAt;

    await markProviderUsageIngestionRunFailed({
      error: message,
      ingestionRunId: ingestionRun.id,
      pageCount,
      requestLatencyMs,
      rowCount,
    });
    await appendJobEvent(
      job.id,
      OPENAI_USAGE_INGEST_EVENTS.failed,
      "OpenAI usage ingestion failed",
      {
        error: message,
        pageCount,
        rowCount,
        tenantId: payload.tenantId,
        usageType: payload.usageType,
      },
    );
    await markJobFailed(job.id, message);
    throw error;
  }
}

function parseIngestOpenAiUsagePayload(payload: Record<string, unknown>) {
  const tenantId = payload.tenantId;
  const usageType = payload.usageType ?? PROVIDER_USAGE_TYPES.completions;

  if (typeof tenantId !== "string" || tenantId.length === 0) {
    throw new Error("OpenAI usage ingestion payload missing tenantId");
  }

  if (!isProviderUsageType(usageType)) {
    throw new Error("OpenAI usage ingestion payload missing usageType");
  }

  return { tenantId, usageType };
}

function getOpenAiUsageConfig(usageType: ProviderUsageType) {
  const usageConfig = OPENAI_USAGE_CONFIGS.find(
    (config) => config.usageType === usageType,
  );

  if (!usageConfig) {
    throw new Error(`Unsupported OpenAI usage type: ${usageType}`);
  }

  return usageConfig;
}

function determineUsageWindow(previousRequestedEndAt: Date | null) {
  const endTime = floorDateToMinute(new Date());
  const defaultLookbackMinutes = previousRequestedEndAt
    ? OPENAI_USAGE_OVERLAP_LOOKBACK_MINUTES
    : OPENAI_USAGE_INITIAL_LOOKBACK_MINUTES;

  return {
    endTime,
    startTime: new Date(endTime.getTime() - defaultLookbackMinutes * 60_000),
  };
}

function floorDateToMinute(value: Date) {
  const floored = new Date(value);

  floored.setSeconds(0, 0);

  return floored;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "Unknown OpenAI usage ingestion error";
}

function isProviderUsageType(value: unknown): value is ProviderUsageType {
  return Object.values(PROVIDER_USAGE_TYPES).includes(
    value as ProviderUsageType,
  );
}
