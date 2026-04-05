import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  jobRuns,
  providerAccounts,
  providerUsageBuckets,
  providerUsageIngestionRuns,
} from "@/db/schema";
import { JOB_STATUSES, JOB_TYPES } from "@/lib/jobs/types";
import type {
  ProviderKey,
  ProviderUsageBucketResult,
  ProviderUsageType,
} from "@/lib/providers/types";

const OPENAI_PROVIDER_KEY = "openai";

export async function listDueOpenAiUsageIngestionTargets(input: {
  pollIntervalMs: number;
  usageType: ProviderUsageType;
}) {
  const db = getDb();
  const providerRows = await db
    .select({
      externalProjectId: providerAccounts.externalProjectId,
      providerAccountId: providerAccounts.id,
      tenantId: providerAccounts.tenantId,
    })
    .from(providerAccounts)
    .where(
      and(
        eq(providerAccounts.providerKey, OPENAI_PROVIDER_KEY),
        eq(providerAccounts.status, "active"),
        isNull(providerAccounts.revokedAt),
        isNotNull(providerAccounts.externalProjectId),
      ),
    );

  const dueTargets: Array<{
    externalProjectId: string;
    providerAccountId: string;
    tenantId: string;
  }> = [];
  const notBefore = Date.now() - input.pollIntervalMs;

  for (const providerRow of providerRows) {
    if (!providerRow.externalProjectId) {
      continue;
    }

    const [activeJob] = await db
      .select({
        id: jobRuns.id,
      })
      .from(jobRuns)
      .where(
        and(
          eq(jobRuns.jobType, JOB_TYPES.ingestOpenAiUsage),
          eq(jobRuns.tenantId, providerRow.tenantId),
          inArray(jobRuns.status, [JOB_STATUSES.queued, JOB_STATUSES.running]),
        ),
      )
      .limit(1);

    if (activeJob) {
      continue;
    }

    const [latestRun] = await db
      .select({
        finishedAt: providerUsageIngestionRuns.finishedAt,
      })
      .from(providerUsageIngestionRuns)
      .where(
        and(
          eq(
            providerUsageIngestionRuns.providerAccountId,
            providerRow.providerAccountId,
          ),
          eq(providerUsageIngestionRuns.providerKey, OPENAI_PROVIDER_KEY),
          eq(providerUsageIngestionRuns.usageType, input.usageType),
          eq(providerUsageIngestionRuns.status, "succeeded"),
        ),
      )
      .orderBy(desc(providerUsageIngestionRuns.finishedAt))
      .limit(1);

    if (latestRun?.finishedAt && latestRun.finishedAt.getTime() > notBefore) {
      continue;
    }

    dueTargets.push({
      externalProjectId: providerRow.externalProjectId,
      providerAccountId: providerRow.providerAccountId,
      tenantId: providerRow.tenantId,
    });
  }

  return dueTargets;
}

export async function createProviderUsageIngestionRun(input: {
  bucketWidth: string;
  groupBy: string[];
  jobRunId: string;
  providerAccountId: string;
  providerKey: ProviderKey;
  requestJson: Record<string, unknown>;
  requestedEndAt: Date;
  requestedStartAt: Date;
  status: string;
  tenantId: string;
  usageType: ProviderUsageType;
}) {
  const db = getDb();
  const [run] = await db
    .insert(providerUsageIngestionRuns)
    .values({
      bucketWidth: input.bucketWidth,
      groupByJson: input.groupBy,
      jobRunId: input.jobRunId,
      providerAccountId: input.providerAccountId,
      providerKey: input.providerKey,
      requestJson: input.requestJson,
      requestedEndAt: input.requestedEndAt,
      requestedStartAt: input.requestedStartAt,
      status: input.status,
      tenantId: input.tenantId,
      usageType: input.usageType,
    })
    .returning();

  return run;
}

export async function getLatestProviderUsageIngestionRun(input: {
  providerAccountId: string;
  providerKey: ProviderKey;
  usageType: ProviderUsageType;
}) {
  const db = getDb();
  const [run] = await db
    .select()
    .from(providerUsageIngestionRuns)
    .where(
      and(
        eq(
          providerUsageIngestionRuns.providerAccountId,
          input.providerAccountId,
        ),
        eq(providerUsageIngestionRuns.providerKey, input.providerKey),
        eq(providerUsageIngestionRuns.usageType, input.usageType),
      ),
    )
    .orderBy(desc(providerUsageIngestionRuns.createdAt))
    .limit(1);

  return run ?? null;
}

export async function markProviderUsageIngestionRunSucceeded(input: {
  ingestionRunId: string;
  pageCount: number;
  requestLatencyMs: number;
  rowCount: number;
}) {
  const db = getDb();

  await db
    .update(providerUsageIngestionRuns)
    .set({
      finishedAt: new Date(),
      pageCount: input.pageCount,
      requestLatencyMs: input.requestLatencyMs,
      rowCount: input.rowCount,
      status: "succeeded",
      updatedAt: new Date(),
    })
    .where(eq(providerUsageIngestionRuns.id, input.ingestionRunId));
}

export async function markProviderUsageIngestionRunFailed(input: {
  error: string;
  ingestionRunId: string;
  pageCount: number;
  requestLatencyMs: number;
  rowCount: number;
}) {
  const db = getDb();

  await db
    .update(providerUsageIngestionRuns)
    .set({
      finishedAt: new Date(),
      lastError: input.error,
      pageCount: input.pageCount,
      requestLatencyMs: input.requestLatencyMs,
      rowCount: input.rowCount,
      status: "failed",
      updatedAt: new Date(),
    })
    .where(eq(providerUsageIngestionRuns.id, input.ingestionRunId));
}

export async function upsertProviderUsageBuckets(input: {
  buckets: ProviderUsageBucketResult[];
  ingestionRunId: string;
  providerAccountId: string;
  providerKey: ProviderKey;
  tenantId: string;
  usageType: ProviderUsageType;
}) {
  if (input.buckets.length === 0) {
    return 0;
  }

  const db = getDb();
  const now = new Date();

  await db
    .insert(providerUsageBuckets)
    .values(
      input.buckets.map((bucket) => ({
        bucketEndAt: bucket.bucketEndAt,
        bucketKey: bucket.bucketKey,
        bucketStartAt: bucket.bucketStartAt,
        externalApiKeyId: bucket.externalApiKeyId,
        externalProjectId: bucket.externalProjectId,
        externalUserId: bucket.externalUserId,
        ingestionRunId: input.ingestionRunId,
        ingestedAt: now,
        metricsJson: bucket.metrics,
        model: bucket.model,
        providerAccountId: input.providerAccountId,
        providerKey: input.providerKey,
        rawBucketJson: bucket.rawBucket,
        rawResultJson: bucket.rawResult,
        tenantId: input.tenantId,
        updatedAt: now,
        usageType: input.usageType,
      })),
    )
    .onConflictDoUpdate({
      set: {
        bucketEndAt: sql`excluded.bucket_end_at`,
        bucketStartAt: sql`excluded.bucket_start_at`,
        externalApiKeyId: sql`excluded.external_api_key_id`,
        externalProjectId: sql`excluded.external_project_id`,
        externalUserId: sql`excluded.external_user_id`,
        ingestionRunId: sql`excluded.ingestion_run_id`,
        ingestedAt: now,
        metricsJson: sql`excluded.metrics_json`,
        model: sql`excluded.model`,
        rawBucketJson: sql`excluded.raw_bucket_json`,
        rawResultJson: sql`excluded.raw_result_json`,
        updatedAt: now,
      },
      target: [
        providerUsageBuckets.providerAccountId,
        providerUsageBuckets.bucketKey,
      ],
    });

  return input.buckets.length;
}
