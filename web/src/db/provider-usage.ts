import {
  and,
  asc,
  desc,
  eq,
  gte,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  providerAccounts,
  providerUsageBuckets,
  providerUsageSettlements,
  providerUsageSyncStates,
} from "@/db/schema";
import type {
  ProviderUsageBucketResult,
  ProviderUsageType,
} from "@/lib/providers/types";

const OPENAI_PROVIDER_KEY = "openai";

export async function listDueOpenAiUsageSyncTargets(input: {
  pollIntervalMs: number;
  usageType: ProviderUsageType;
}) {
  const db = getDb();
  const notBefore = new Date(Date.now() - input.pollIntervalMs);

  return db
    .select({
      externalProjectId: providerAccounts.externalProjectId,
      lastSuccessfulEndAt: providerUsageSyncStates.lastSuccessfulEndAt,
      providerAccountId: providerAccounts.id,
      pollIntervalSeconds: providerUsageSyncStates.pollIntervalSeconds,
      tenantId: providerAccounts.tenantId,
    })
    .from(providerAccounts)
    .leftJoin(
      providerUsageSyncStates,
      and(
        eq(providerUsageSyncStates.providerAccountId, providerAccounts.id),
        eq(providerUsageSyncStates.usageType, input.usageType),
      ),
    )
    .where(
      and(
        eq(providerAccounts.providerKey, OPENAI_PROVIDER_KEY),
        eq(providerAccounts.status, "active"),
        isNull(providerAccounts.revokedAt),
        isNotNull(providerAccounts.externalProjectId),
        or(
          isNull(providerUsageSyncStates.id),
          lte(providerUsageSyncStates.lastAttemptedAt, notBefore),
        ),
      ),
    );
}

export async function getProviderUsageSyncState(input: {
  providerAccountId: string;
  usageType: ProviderUsageType;
}) {
  const db = getDb();
  const [syncState] = await db
    .select()
    .from(providerUsageSyncStates)
    .where(
      and(
        eq(providerUsageSyncStates.providerAccountId, input.providerAccountId),
        eq(providerUsageSyncStates.usageType, input.usageType),
      ),
    )
    .limit(1);

  return syncState ?? null;
}

export async function beginProviderUsageSyncAttempt(input: {
  pollIntervalSeconds: number;
  providerAccountId: string;
  tenantId: string;
  usageType: ProviderUsageType;
}) {
  const db = getDb();
  const now = new Date();

  await db
    .insert(providerUsageSyncStates)
    .values({
      lastAttemptedAt: now,
      pollIntervalSeconds: input.pollIntervalSeconds,
      providerAccountId: input.providerAccountId,
      tenantId: input.tenantId,
      usageType: input.usageType,
    })
    .onConflictDoUpdate({
      set: {
        lastAttemptedAt: now,
        pollIntervalSeconds: input.pollIntervalSeconds,
        updatedAt: now,
      },
      target: [
        providerUsageSyncStates.providerAccountId,
        providerUsageSyncStates.usageType,
      ],
    });
}

export async function markProviderUsageSyncSucceeded(input: {
  lastSuccessfulEndAt: Date;
  providerAccountId: string;
  rowCount: number;
  usageType: ProviderUsageType;
}) {
  const db = getDb();
  const now = new Date();

  await db
    .update(providerUsageSyncStates)
    .set({
      consecutiveFailures: 0,
      lastError: null,
      lastErrorAt: null,
      lastRowCount: input.rowCount,
      lastSuccessfulEndAt: input.lastSuccessfulEndAt,
      updatedAt: now,
    })
    .where(
      and(
        eq(providerUsageSyncStates.providerAccountId, input.providerAccountId),
        eq(providerUsageSyncStates.usageType, input.usageType),
      ),
    );
}

export async function markProviderUsageSyncFailed(input: {
  error: string;
  providerAccountId: string;
  usageType: ProviderUsageType;
}) {
  const db = getDb();
  const now = new Date();

  await db
    .update(providerUsageSyncStates)
    .set({
      consecutiveFailures: sql`${providerUsageSyncStates.consecutiveFailures} + 1`,
      lastError: input.error,
      lastErrorAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(providerUsageSyncStates.providerAccountId, input.providerAccountId),
        eq(providerUsageSyncStates.usageType, input.usageType),
      ),
    );
}

export async function upsertProviderUsageBuckets(input: {
  buckets: ProviderUsageBucketResult[];
  providerAccountId: string;
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
        bucketStartAt: bucket.bucketStartAt,
        externalApiKeyId: bucket.externalApiKeyId ?? "",
        inputAudioTokens: bucket.inputAudioTokens,
        inputCachedTokens: bucket.inputCachedTokens,
        inputImageTokens: bucket.inputImageTokens,
        inputTextTokens: bucket.inputTextTokens,
        inputTokens: bucket.inputTokens,
        inputUncachedTokens: bucket.inputUncachedTokens,
        itemCount: bucket.itemCount,
        model: bucket.model ?? "",
        outputAudioTokens: bucket.outputAudioTokens,
        outputImageTokens: bucket.outputImageTokens,
        outputTextTokens: bucket.outputTextTokens,
        outputTokens: bucket.outputTokens,
        providerAccountId: input.providerAccountId,
        sessionCount: bucket.sessionCount,
        tenantId: input.tenantId,
        updatedAt: now,
        usageBytes: bucket.usageBytes,
        usageType: input.usageType,
      })),
    )
    .onConflictDoUpdate({
      set: {
        inputAudioTokens: sql`excluded.input_audio_tokens`,
        inputCachedTokens: sql`excluded.input_cached_tokens`,
        inputImageTokens: sql`excluded.input_image_tokens`,
        inputTextTokens: sql`excluded.input_text_tokens`,
        inputTokens: sql`excluded.input_tokens`,
        inputUncachedTokens: sql`excluded.input_uncached_tokens`,
        itemCount: sql`excluded.item_count`,
        outputAudioTokens: sql`excluded.output_audio_tokens`,
        outputImageTokens: sql`excluded.output_image_tokens`,
        outputTextTokens: sql`excluded.output_text_tokens`,
        outputTokens: sql`excluded.output_tokens`,
        sessionCount: sql`excluded.session_count`,
        updatedAt: now,
        usageBytes: sql`excluded.usage_bytes`,
      },
      target: [
        providerUsageBuckets.providerAccountId,
        providerUsageBuckets.usageType,
        providerUsageBuckets.bucketStartAt,
        providerUsageBuckets.bucketEndAt,
        providerUsageBuckets.externalApiKeyId,
        providerUsageBuckets.model,
      ],
    });

  return input.buckets.length;
}

function numberFromValue(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function dateFromValue(value: unknown) {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

export async function getTenantProviderUsageOverview(input: {
  from: Date;
  tenantId: string;
  to: Date;
}) {
  const db = getDb();
  const rangeMs = input.to.getTime() - input.from.getTime();
  const useHourlyGranularity = rangeMs <= 48 * 60 * 60 * 1000;
  const bucketTruncExpression = useHourlyGranularity
    ? sql<Date>`date_trunc('hour', ${providerUsageBuckets.bucketStartAt})`
    : sql<Date>`date_trunc('day', ${providerUsageBuckets.bucketStartAt})`;
  const totalTokensExpression = sql`coalesce(sum(coalesce(${providerUsageBuckets.inputTokens}, 0) + coalesce(${providerUsageBuckets.outputTokens}, 0)), 0)`;
  const requestCountExpression = sql`coalesce(sum(coalesce(${providerUsageBuckets.itemCount}, 0)), 0)`;
  const creditsBurnedMilliExpression = sql`coalesce(sum(coalesce(${providerUsageSettlements.creditsBurnedMilli}, 0)), 0)`;
  const providerCostMicrosExpression = sql`coalesce(sum(coalesce(${providerUsageSettlements.providerCostMicros}, 0)), 0)`;

  const rangeFilter = and(
    eq(providerUsageBuckets.tenantId, input.tenantId),
    gte(providerUsageBuckets.bucketStartAt, input.from),
    lte(providerUsageBuckets.bucketStartAt, input.to),
  );

  const settlementJoin = eq(
    providerUsageSettlements.providerUsageBucketId,
    providerUsageBuckets.id,
  );

  const [summaryRows, timeSeriesRows, usageTypeRows, modelRows] =
    await Promise.all([
      db
        .select({
          activeApiKeys: sql`count(distinct nullif(${providerUsageBuckets.externalApiKeyId}, ''))`,
          activeModels: sql`count(distinct nullif(${providerUsageBuckets.model}, ''))`,
          totalCreditsBurnedMilli: creditsBurnedMilliExpression,
          totalProviderCostMicros: providerCostMicrosExpression,
          totalInputTokens: sql`coalesce(sum(${providerUsageBuckets.inputTokens}), 0)`,
          totalOutputTokens: sql`coalesce(sum(${providerUsageBuckets.outputTokens}), 0)`,
          totalRequests: requestCountExpression,
        })
        .from(providerUsageBuckets)
        .leftJoin(providerUsageSettlements, settlementJoin)
        .where(rangeFilter),
      db
        .select({
          bucketTime: bucketTruncExpression,
          creditsBurnedMilli: creditsBurnedMilliExpression,
          providerCostMicros: providerCostMicrosExpression,
          inputTokens: sql`coalesce(sum(${providerUsageBuckets.inputTokens}), 0)`,
          outputTokens: sql`coalesce(sum(${providerUsageBuckets.outputTokens}), 0)`,
          inputCachedTokens: sql`coalesce(sum(${providerUsageBuckets.inputCachedTokens}), 0)`,
          inputTextTokens: sql`coalesce(sum(${providerUsageBuckets.inputTextTokens}), 0)`,
          outputTextTokens: sql`coalesce(sum(${providerUsageBuckets.outputTextTokens}), 0)`,
          inputAudioTokens: sql`coalesce(sum(${providerUsageBuckets.inputAudioTokens}), 0)`,
          outputAudioTokens: sql`coalesce(sum(${providerUsageBuckets.outputAudioTokens}), 0)`,
          inputImageTokens: sql`coalesce(sum(${providerUsageBuckets.inputImageTokens}), 0)`,
          requestCount: requestCountExpression,
        })
        .from(providerUsageBuckets)
        .leftJoin(providerUsageSettlements, settlementJoin)
        .where(rangeFilter)
        .groupBy(bucketTruncExpression)
        .orderBy(asc(bucketTruncExpression)),
      db
        .select({
          creditsBurnedMilli: creditsBurnedMilliExpression,
          providerCostMicros: providerCostMicrosExpression,
          requestCount: requestCountExpression,
          totalTokens: totalTokensExpression,
          usageType: providerUsageBuckets.usageType,
        })
        .from(providerUsageBuckets)
        .leftJoin(providerUsageSettlements, settlementJoin)
        .where(rangeFilter)
        .groupBy(providerUsageBuckets.usageType)
        .orderBy(
          desc(totalTokensExpression),
          asc(providerUsageBuckets.usageType),
        ),
      db
        .select({
          creditsBurnedMilli: creditsBurnedMilliExpression,
          providerCostMicros: providerCostMicrosExpression,
          inputTokens: sql`coalesce(sum(${providerUsageBuckets.inputTokens}), 0)`,
          model: providerUsageBuckets.model,
          outputTokens: sql`coalesce(sum(${providerUsageBuckets.outputTokens}), 0)`,
          requestCount: requestCountExpression,
          totalTokens: totalTokensExpression,
          usageType: providerUsageBuckets.usageType,
        })
        .from(providerUsageBuckets)
        .leftJoin(providerUsageSettlements, settlementJoin)
        .where(and(rangeFilter, ne(providerUsageBuckets.model, "")))
        .groupBy(providerUsageBuckets.usageType, providerUsageBuckets.model)
        .orderBy(desc(totalTokensExpression), desc(requestCountExpression))
        .limit(8),
    ]);

  const summary = summaryRows[0] ?? {
    activeApiKeys: 0,
    activeModels: 0,
    totalCreditsBurnedMilli: 0,
    totalProviderCostMicros: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalRequests: 0,
  };

  return {
    summary: {
      activeApiKeys: numberFromValue(summary.activeApiKeys),
      activeModels: numberFromValue(summary.activeModels),
      totalCreditsBurnedMilli: numberFromValue(summary.totalCreditsBurnedMilli),
      totalProviderCostMicros: numberFromValue(summary.totalProviderCostMicros),
      totalInputTokens: numberFromValue(summary.totalInputTokens),
      totalOutputTokens: numberFromValue(summary.totalOutputTokens),
      totalRequests: numberFromValue(summary.totalRequests),
    },
    timeSeries: timeSeriesRows.map((row) => ({
      bucketTime: (dateFromValue(row.bucketTime) ?? new Date(0)).toISOString(),
      creditsBurnedMilli: numberFromValue(row.creditsBurnedMilli),
      providerCostMicros: numberFromValue(row.providerCostMicros),
      inputTokens: numberFromValue(row.inputTokens),
      outputTokens: numberFromValue(row.outputTokens),
      inputCachedTokens: numberFromValue(row.inputCachedTokens),
      inputTextTokens: numberFromValue(row.inputTextTokens),
      outputTextTokens: numberFromValue(row.outputTextTokens),
      inputAudioTokens: numberFromValue(row.inputAudioTokens),
      outputAudioTokens: numberFromValue(row.outputAudioTokens),
      inputImageTokens: numberFromValue(row.inputImageTokens),
      requestCount: numberFromValue(row.requestCount),
    })),
    usageByModel: modelRows.map((row) => ({
      creditsBurnedMilli: numberFromValue(row.creditsBurnedMilli),
      providerCostMicros: numberFromValue(row.providerCostMicros),
      inputTokens: numberFromValue(row.inputTokens),
      model: row.model,
      outputTokens: numberFromValue(row.outputTokens),
      requestCount: numberFromValue(row.requestCount),
      totalTokens: numberFromValue(row.totalTokens),
      usageType: row.usageType,
    })),
    usageByType: usageTypeRows.map((row) => ({
      creditsBurnedMilli: numberFromValue(row.creditsBurnedMilli),
      providerCostMicros: numberFromValue(row.providerCostMicros),
      requestCount: numberFromValue(row.requestCount),
      totalTokens: numberFromValue(row.totalTokens),
      usageType: row.usageType,
    })),
  };
}
