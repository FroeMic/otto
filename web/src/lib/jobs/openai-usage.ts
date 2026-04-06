import {
  beginProviderUsageSyncAttempt,
  listDueOpenAiUsageSyncTargets,
  markProviderUsageSyncFailed,
  markProviderUsageSyncSucceeded,
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

let nextSchedulerSweepAt = 0;

export async function runOpenAiUsageIngestionCycle() {
  const now = Date.now();

  if (now < nextSchedulerSweepAt) {
    return 0;
  }

  nextSchedulerSweepAt = now + OPENAI_USAGE_SCHEDULER_SWEEP_INTERVAL_MS;

  let syncedTargetCount = 0;

  for (const usageConfig of OPENAI_USAGE_CONFIGS) {
    const dueTargets = await listDueOpenAiUsageSyncTargets({
      pollIntervalMs: OPENAI_USAGE_POLL_INTERVAL_MS,
      usageType: usageConfig.usageType,
    });

    for (const dueTarget of dueTargets) {
      if (!dueTarget.externalProjectId) {
        continue;
      }

      try {
        await syncOpenAiUsageTarget({
          externalProjectId: dueTarget.externalProjectId,
          groupBy: usageConfig.groupBy,
          lastSuccessfulEndAt: dueTarget.lastSuccessfulEndAt,
          pollIntervalSeconds: dueTarget.pollIntervalSeconds ?? 60,
          providerAccountId: dueTarget.providerAccountId,
          tenantId: dueTarget.tenantId,
          usageType: usageConfig.usageType,
        });
        syncedTargetCount += 1;
      } catch (error) {
        console.error(
          `[worker] OpenAI usage sync failed (${usageConfig.usageType}, providerAccountId=${dueTarget.providerAccountId}): ${getErrorMessage(error)}`,
        );
      }
    }
  }

  return syncedTargetCount;
}

async function syncOpenAiUsageTarget(input: {
  externalProjectId: string;
  groupBy: ProviderUsageGroupByField[];
  lastSuccessfulEndAt: Date | null;
  pollIntervalSeconds: number;
  providerAccountId: string;
  tenantId: string;
  usageType: ProviderUsageType;
}) {
  const window = determineUsageWindow(input.lastSuccessfulEndAt);

  await beginProviderUsageSyncAttempt({
    pollIntervalSeconds: input.pollIntervalSeconds,
    providerAccountId: input.providerAccountId,
    tenantId: input.tenantId,
    usageType: input.usageType,
  });

  let rowCount = 0;

  try {
    let nextPage: string | null = null;

    do {
      const usagePage = await openAiUsageCollector.fetchUsageBuckets({
        bucketWidth: PROVIDER_USAGE_BUCKET_WIDTHS.oneMinute,
        endTime: window.endTime,
        groupBy: input.groupBy,
        page: nextPage,
        projectId: input.externalProjectId,
        startTime: window.startTime,
        usageType: input.usageType,
      });

      rowCount += await upsertProviderUsageBuckets({
        buckets: usagePage.buckets,
        providerAccountId: input.providerAccountId,
        tenantId: input.tenantId,
        usageType: input.usageType,
      });
      nextPage = usagePage.nextPage;
    } while (nextPage);

    await markProviderUsageSyncSucceeded({
      lastSuccessfulEndAt: window.endTime,
      providerAccountId: input.providerAccountId,
      rowCount,
      usageType: input.usageType,
    });
  } catch (error) {
    await markProviderUsageSyncFailed({
      error: getErrorMessage(error),
      providerAccountId: input.providerAccountId,
      usageType: input.usageType,
    });
    throw error;
  }
}

function determineUsageWindow(previousSuccessfulEndAt: Date | null) {
  const endTime = floorDateToMinute(new Date());
  const startTime = previousSuccessfulEndAt
    ? new Date(
        previousSuccessfulEndAt.getTime() -
          OPENAI_USAGE_OVERLAP_LOOKBACK_MINUTES * 60_000,
      )
    : new Date(
        endTime.getTime() - OPENAI_USAGE_INITIAL_LOOKBACK_MINUTES * 60_000,
      );

  return {
    endTime,
    startTime,
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
