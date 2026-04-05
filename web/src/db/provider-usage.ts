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
  hours?: number;
  tenantId: string;
}) {
  const db = getDb();
  const lookbackHours = input.hours ?? 24;
  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
  const bucketHourExpression = sql<Date>`date_trunc('hour', ${providerUsageBuckets.bucketStartAt})`;
  const totalTokensExpression = sql`coalesce(sum(coalesce(${providerUsageBuckets.inputTokens}, 0) + coalesce(${providerUsageBuckets.outputTokens}, 0)), 0)`;
  const requestCountExpression = sql`coalesce(sum(coalesce(${providerUsageBuckets.itemCount}, 0)), 0)`;
  const creditsBurnedMilliExpression = sql`coalesce(sum(coalesce(${providerUsageSettlements.creditsBurnedMilli}, 0)), 0)`;

  const [
    summaryRows,
    hourlyRows,
    usageTypeRows,
    modelRows,
    recentBucketRows,
    syncStateRows,
  ] = await Promise.all([
    db
      .select({
        activeApiKeys: sql`count(distinct nullif(${providerUsageBuckets.externalApiKeyId}, ''))`,
        activeModels: sql`count(distinct nullif(${providerUsageBuckets.model}, ''))`,
        latestBucketEndAt: sql<Date | null>`max(${providerUsageBuckets.bucketEndAt})`,
        totalCreditsBurnedMilli: creditsBurnedMilliExpression,
        totalInputTokens: sql`coalesce(sum(${providerUsageBuckets.inputTokens}), 0)`,
        totalOutputTokens: sql`coalesce(sum(${providerUsageBuckets.outputTokens}), 0)`,
        totalRequests: requestCountExpression,
      })
      .from(providerUsageBuckets)
      .leftJoin(
        providerUsageSettlements,
        eq(
          providerUsageSettlements.providerUsageBucketId,
          providerUsageBuckets.id,
        ),
      )
      .where(
        and(
          eq(providerUsageBuckets.tenantId, input.tenantId),
          gte(providerUsageBuckets.bucketStartAt, since),
        ),
      ),
    db
      .select({
        bucketHour: bucketHourExpression,
        creditsBurnedMilli: creditsBurnedMilliExpression,
        inputTokens: sql`coalesce(sum(${providerUsageBuckets.inputTokens}), 0)`,
        outputTokens: sql`coalesce(sum(${providerUsageBuckets.outputTokens}), 0)`,
        requestCount: requestCountExpression,
      })
      .from(providerUsageBuckets)
      .leftJoin(
        providerUsageSettlements,
        eq(
          providerUsageSettlements.providerUsageBucketId,
          providerUsageBuckets.id,
        ),
      )
      .where(
        and(
          eq(providerUsageBuckets.tenantId, input.tenantId),
          gte(providerUsageBuckets.bucketStartAt, since),
        ),
      )
      .groupBy(bucketHourExpression)
      .orderBy(asc(bucketHourExpression)),
    db
      .select({
        creditsBurnedMilli: creditsBurnedMilliExpression,
        requestCount: requestCountExpression,
        totalTokens: totalTokensExpression,
        usageType: providerUsageBuckets.usageType,
      })
      .from(providerUsageBuckets)
      .leftJoin(
        providerUsageSettlements,
        eq(
          providerUsageSettlements.providerUsageBucketId,
          providerUsageBuckets.id,
        ),
      )
      .where(
        and(
          eq(providerUsageBuckets.tenantId, input.tenantId),
          gte(providerUsageBuckets.bucketStartAt, since),
        ),
      )
      .groupBy(providerUsageBuckets.usageType)
      .orderBy(
        desc(totalTokensExpression),
        asc(providerUsageBuckets.usageType),
      ),
    db
      .select({
        creditsBurnedMilli: creditsBurnedMilliExpression,
        inputTokens: sql`coalesce(sum(${providerUsageBuckets.inputTokens}), 0)`,
        model: providerUsageBuckets.model,
        outputTokens: sql`coalesce(sum(${providerUsageBuckets.outputTokens}), 0)`,
        requestCount: requestCountExpression,
        totalTokens: totalTokensExpression,
        usageType: providerUsageBuckets.usageType,
      })
      .from(providerUsageBuckets)
      .leftJoin(
        providerUsageSettlements,
        eq(
          providerUsageSettlements.providerUsageBucketId,
          providerUsageBuckets.id,
        ),
      )
      .where(
        and(
          eq(providerUsageBuckets.tenantId, input.tenantId),
          gte(providerUsageBuckets.bucketStartAt, since),
          ne(providerUsageBuckets.model, ""),
        ),
      )
      .groupBy(providerUsageBuckets.usageType, providerUsageBuckets.model)
      .orderBy(desc(totalTokensExpression), desc(requestCountExpression))
      .limit(8),
    db
      .select({
        bucketEndAt: providerUsageBuckets.bucketEndAt,
        bucketStartAt: providerUsageBuckets.bucketStartAt,
        creditsBurnedMilli: providerUsageSettlements.creditsBurnedMilli,
        externalApiKeyId: providerUsageBuckets.externalApiKeyId,
        inputTokens: providerUsageBuckets.inputTokens,
        itemCount: providerUsageBuckets.itemCount,
        model: providerUsageBuckets.model,
        outputTokens: providerUsageBuckets.outputTokens,
        settlementStatus: providerUsageSettlements.settlementStatus,
        usageType: providerUsageBuckets.usageType,
      })
      .from(providerUsageBuckets)
      .leftJoin(
        providerUsageSettlements,
        eq(
          providerUsageSettlements.providerUsageBucketId,
          providerUsageBuckets.id,
        ),
      )
      .where(eq(providerUsageBuckets.tenantId, input.tenantId))
      .orderBy(desc(providerUsageBuckets.bucketStartAt))
      .limit(20),
    db
      .select({
        consecutiveFailures: providerUsageSyncStates.consecutiveFailures,
        lastAttemptedAt: providerUsageSyncStates.lastAttemptedAt,
        lastError: providerUsageSyncStates.lastError,
        lastErrorAt: providerUsageSyncStates.lastErrorAt,
        lastRowCount: providerUsageSyncStates.lastRowCount,
        lastSuccessfulEndAt: providerUsageSyncStates.lastSuccessfulEndAt,
        usageType: providerUsageSyncStates.usageType,
      })
      .from(providerUsageSyncStates)
      .where(eq(providerUsageSyncStates.tenantId, input.tenantId))
      .orderBy(asc(providerUsageSyncStates.usageType)),
  ]);

  const summary = summaryRows[0] ?? {
    activeApiKeys: 0,
    activeModels: 0,
    latestBucketEndAt: null,
    totalCreditsBurnedMilli: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalRequests: 0,
  };

  return {
    hourlyBuckets: hourlyRows.map((row) => ({
      bucketHour: dateFromValue(row.bucketHour) ?? new Date(0),
      creditsBurnedMilli: numberFromValue(row.creditsBurnedMilli),
      inputTokens: numberFromValue(row.inputTokens),
      outputTokens: numberFromValue(row.outputTokens),
      requestCount: numberFromValue(row.requestCount),
    })),
    recentBuckets: recentBucketRows.map((row) => ({
      bucketEndAt: dateFromValue(row.bucketEndAt) ?? new Date(0),
      bucketStartAt: dateFromValue(row.bucketStartAt) ?? new Date(0),
      creditsBurnedMilli: numberFromValue(row.creditsBurnedMilli),
      externalApiKeyId: row.externalApiKeyId,
      inputTokens: numberFromValue(row.inputTokens),
      itemCount: numberFromValue(row.itemCount),
      model: row.model,
      outputTokens: numberFromValue(row.outputTokens),
      settlementStatus: row.settlementStatus,
      usageType: row.usageType,
    })),
    summary: {
      activeApiKeys: numberFromValue(summary.activeApiKeys),
      activeModels: numberFromValue(summary.activeModels),
      latestBucketEndAt: dateFromValue(summary.latestBucketEndAt),
      totalCreditsBurnedMilli: numberFromValue(summary.totalCreditsBurnedMilli),
      totalInputTokens: numberFromValue(summary.totalInputTokens),
      totalOutputTokens: numberFromValue(summary.totalOutputTokens),
      totalRequests: numberFromValue(summary.totalRequests),
    },
    syncStates: syncStateRows.map((row) => ({
      consecutiveFailures: row.consecutiveFailures,
      lastAttemptedAt: dateFromValue(row.lastAttemptedAt),
      lastError: row.lastError,
      lastErrorAt: dateFromValue(row.lastErrorAt),
      lastRowCount: row.lastRowCount,
      lastSuccessfulEndAt: dateFromValue(row.lastSuccessfulEndAt),
      usageType: row.usageType,
    })),
    usageByModel: modelRows.map((row) => ({
      creditsBurnedMilli: numberFromValue(row.creditsBurnedMilli),
      inputTokens: numberFromValue(row.inputTokens),
      model: row.model,
      outputTokens: numberFromValue(row.outputTokens),
      requestCount: numberFromValue(row.requestCount),
      totalTokens: numberFromValue(row.totalTokens),
      usageType: row.usageType,
    })),
    usageByType: usageTypeRows.map((row) => ({
      creditsBurnedMilli: numberFromValue(row.creditsBurnedMilli),
      requestCount: numberFromValue(row.requestCount),
      totalTokens: numberFromValue(row.totalTokens),
      usageType: row.usageType,
    })),
  };
}
