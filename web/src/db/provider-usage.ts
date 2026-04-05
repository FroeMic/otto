import { and, eq, isNotNull, isNull, lte, or, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  providerAccounts,
  providerUsageBuckets,
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
