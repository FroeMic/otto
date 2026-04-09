import {
  listUnsettledProviderUsageBuckets,
  listUnsettledProviderUsageBucketsByIds,
  recordProviderUsageSettlement,
} from "../../db/credit-ledger";
import {
  CREDIT_SETTLEMENT_STATUSES,
  type OpenAiUsageBucketPricingInput,
  priceOpenAiUsageBucket,
} from "../billing/openai-credit-pricing";
import type { ProviderUsageType } from "../providers/types";

import {
  appendJobEvent,
  enqueueJob,
  listQueuedOrRunningJobsByType,
  markJobFailed,
  markJobSucceeded,
  requeueJob,
} from "./queue";
import {
  type ClaimedJob,
  JOB_TYPES,
  type ScheduleCreditSettlementPayload,
  type SettleCreditUsageChunkPayload,
} from "./types";

const CREDIT_SETTLEMENT_SWEEP_INTERVAL_MS = 30_000;
const CREDIT_SETTLEMENT_BATCH_SIZE = 250;
const CREDIT_SETTLEMENT_CHUNK_SIZE = 50;

export async function processScheduleCreditSettlementJob(
  job: ClaimedJob,
): Promise<void> {
  if (job.jobType !== JOB_TYPES.scheduleCreditSettlement) {
    throw new Error(
      `Unsupported job type for credit settlement scheduler: ${job.jobType}`,
    );
  }

  const payload = parseScheduleCreditSettlementPayload(job.payload);

  try {
    const queuedChunkCount = await scheduleCreditSettlementJobs();

    await appendJobEvent(
      job.id,
      "credit_settlement_scheduler_succeeded",
      `Queued ${queuedChunkCount} credit settlement jobs`,
      {
        queuedChunkCount,
      },
    );
    await requeueJob(
      job.id,
      payload,
      new Date(Date.now() + CREDIT_SETTLEMENT_SWEEP_INTERVAL_MS),
    );
  } catch (error) {
    const message = getErrorMessage(error);

    await appendJobEvent(
      job.id,
      "credit_settlement_scheduler_failed",
      `Credit settlement scheduler failed: ${message}`,
    );
    await markJobFailed(
      job.id,
      message,
      new Date(Date.now() + CREDIT_SETTLEMENT_SWEEP_INTERVAL_MS),
    );
  }
}

export async function processSettleCreditUsageChunkJob(
  job: ClaimedJob,
): Promise<void> {
  if (job.jobType !== JOB_TYPES.settleCreditUsageChunk) {
    throw new Error(
      `Unsupported job type for credit settlement chunk: ${job.jobType}`,
    );
  }

  const payload = parseSettleCreditUsageChunkPayload(job.payload);

  if (!payload) {
    throw new Error("Credit settlement chunk payload is missing bucketIds");
  }

  try {
    const settledBucketCount = await settleCreditUsageChunk(payload.bucketIds);

    await appendJobEvent(
      job.id,
      "credit_settlement_chunk_succeeded",
      `Settled ${settledBucketCount} provider usage buckets`,
      {
        bucketCount: payload.bucketIds.length,
        settledBucketCount,
      },
    );
    await markJobSucceeded(job.id, {
      bucketCount: payload.bucketIds.length,
      settledBucketCount,
    });
  } catch (error) {
    const message = getErrorMessage(error);

    await appendJobEvent(
      job.id,
      "credit_settlement_chunk_failed",
      `Credit settlement chunk failed: ${message}`,
    );
    await markJobFailed(job.id, message);
    throw error;
  }
}

async function scheduleCreditSettlementJobs() {
  const unsettledBuckets = await listUnsettledProviderUsageBuckets({
    limit: CREDIT_SETTLEMENT_BATCH_SIZE,
  });
  const activeJobs = await listQueuedOrRunningJobsByType(
    JOB_TYPES.settleCreditUsageChunk,
  );
  const activeBucketIds = new Set<string>();

  for (const activeJob of activeJobs) {
    const payload = parseSettleCreditUsageChunkPayload(activeJob.payload, {
      allowInvalid: true,
    });

    if (!payload) {
      continue;
    }

    for (const bucketId of payload.bucketIds) {
      activeBucketIds.add(bucketId);
    }
  }

  const eligibleBucketIds = unsettledBuckets
    .map((bucket) => bucket.bucketId)
    .filter((bucketId) => !activeBucketIds.has(bucketId));

  let queuedChunkCount = 0;

  for (
    let startIndex = 0;
    startIndex < eligibleBucketIds.length;
    startIndex += CREDIT_SETTLEMENT_CHUNK_SIZE
  ) {
    const bucketIds = eligibleBucketIds.slice(
      startIndex,
      startIndex + CREDIT_SETTLEMENT_CHUNK_SIZE,
    );

    if (bucketIds.length === 0) {
      continue;
    }

    await enqueueJob({
      jobType: JOB_TYPES.settleCreditUsageChunk,
      payload: {
        bucketIds,
      },
    });
    queuedChunkCount += 1;
  }

  return queuedChunkCount;
}

async function settleCreditUsageChunk(bucketIds: string[]) {
  const buckets = await listUnsettledProviderUsageBucketsByIds({
    bucketIds,
  });
  let settledBucketCount = 0;

  for (const bucket of buckets) {
    const decision = priceOpenAiUsageBucket({
      ...bucket,
      usageType: bucket.usageType as ProviderUsageType,
    } satisfies OpenAiUsageBucketPricingInput);

    await recordProviderUsageSettlement({
      bucketId: bucket.bucketId,
      decision,
      providerAccountId: bucket.providerAccountId,
      tenantId: bucket.tenantId,
    });

    settledBucketCount += 1;

    if (decision.settlementStatus === CREDIT_SETTLEMENT_STATUSES.unsupported) {
      console.warn(
        `[worker] usage bucket ${bucket.bucketId} settled as unsupported: ${decision.note}`,
      );
    }
  }

  return settledBucketCount;
}

function parseScheduleCreditSettlementPayload(
  payload: Record<string, unknown>,
): ScheduleCreditSettlementPayload {
  return payload as ScheduleCreditSettlementPayload;
}

function parseSettleCreditUsageChunkPayload(
  payload: Record<string, unknown>,
  options?: {
    allowInvalid?: boolean;
  },
): SettleCreditUsageChunkPayload | null {
  const bucketIds = payload.bucketIds;

  if (
    !Array.isArray(bucketIds) ||
    bucketIds.some((bucketId) => typeof bucketId !== "string")
  ) {
    if (options?.allowInvalid) {
      return null;
    }

    throw new Error("Credit settlement chunk payload is missing bucketIds");
  }

  return {
    bucketIds,
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "Unknown credit settlement error";
}
