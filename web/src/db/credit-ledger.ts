import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  creditLedgerEntries,
  providerUsageBuckets,
  providerUsageSettlements,
} from "@/db/schema";
import type { OpenAiUsageBucketPricingDecision } from "@/lib/billing/openai-credit-pricing";
import { CREDIT_LEDGER_ENTRY_TYPES } from "@/lib/billing/openai-credit-pricing";

const PROVIDER_USAGE_BUCKET_SOURCE_TYPE = "provider_usage_bucket";

export async function listUnsettledProviderUsageBuckets(input?: {
  limit?: number;
}) {
  const db = getDb();
  const limit = input?.limit ?? 200;

  return db
    .select({
      bucketEndAt: providerUsageBuckets.bucketEndAt,
      bucketId: providerUsageBuckets.id,
      bucketStartAt: providerUsageBuckets.bucketStartAt,
      externalApiKeyId: providerUsageBuckets.externalApiKeyId,
      inputAudioTokens: providerUsageBuckets.inputAudioTokens,
      inputCachedTokens: providerUsageBuckets.inputCachedTokens,
      inputImageTokens: providerUsageBuckets.inputImageTokens,
      inputTextTokens: providerUsageBuckets.inputTextTokens,
      inputTokens: providerUsageBuckets.inputTokens,
      inputUncachedTokens: providerUsageBuckets.inputUncachedTokens,
      itemCount: providerUsageBuckets.itemCount,
      model: providerUsageBuckets.model,
      outputAudioTokens: providerUsageBuckets.outputAudioTokens,
      outputImageTokens: providerUsageBuckets.outputImageTokens,
      outputTextTokens: providerUsageBuckets.outputTextTokens,
      outputTokens: providerUsageBuckets.outputTokens,
      providerAccountId: providerUsageBuckets.providerAccountId,
      sessionCount: providerUsageBuckets.sessionCount,
      tenantId: providerUsageBuckets.tenantId,
      usageBytes: providerUsageBuckets.usageBytes,
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
    .where(isNull(providerUsageSettlements.id))
    .orderBy(
      asc(providerUsageBuckets.bucketStartAt),
      asc(providerUsageBuckets.createdAt),
    )
    .limit(limit);
}

async function getCreditLedgerEntryIdBySource(input: { sourceId: string }) {
  const db = getDb();
  const [entry] = await db
    .select({
      id: creditLedgerEntries.id,
    })
    .from(creditLedgerEntries)
    .where(
      and(
        eq(
          creditLedgerEntries.entryType,
          CREDIT_LEDGER_ENTRY_TYPES.providerUsageDebit,
        ),
        eq(creditLedgerEntries.sourceType, PROVIDER_USAGE_BUCKET_SOURCE_TYPE),
        eq(creditLedgerEntries.sourceId, input.sourceId),
      ),
    )
    .orderBy(desc(creditLedgerEntries.createdAt))
    .limit(1);

  return entry?.id ?? null;
}

export async function recordProviderUsageSettlement(input: {
  bucketId: string;
  decision: OpenAiUsageBucketPricingDecision;
  providerAccountId: string;
  tenantId: string;
}) {
  const db = getDb();
  const now = new Date();

  return db.transaction(async (tx) => {
    let ledgerEntryId: string | null = null;

    if (input.decision.creditsBurnedMilli > 0) {
      const [insertedLedgerEntry] = await tx
        .insert(creditLedgerEntries)
        .values({
          billableUnits: input.decision.billableUnits,
          creditsDeltaMilli: -input.decision.creditsBurnedMilli,
          description: input.decision.note,
          entryType: CREDIT_LEDGER_ENTRY_TYPES.providerUsageDebit,
          sourceId: input.bucketId,
          sourceType: PROVIDER_USAGE_BUCKET_SOURCE_TYPE,
          tenantId: input.tenantId,
        })
        .onConflictDoNothing({
          target: [
            creditLedgerEntries.sourceType,
            creditLedgerEntries.sourceId,
            creditLedgerEntries.entryType,
          ],
        })
        .returning({
          id: creditLedgerEntries.id,
        });

      ledgerEntryId =
        insertedLedgerEntry?.id ??
        (await getCreditLedgerEntryIdBySource({ sourceId: input.bucketId }));
    }

    const [insertedSettlement] = await tx
      .insert(providerUsageSettlements)
      .values({
        billableUnits: input.decision.billableUnits,
        creditsBurnedMilli: input.decision.creditsBurnedMilli,
        ledgerEntryId,
        note: input.decision.note,
        pricingVersion: input.decision.pricingVersion,
        providerAccountId: input.providerAccountId,
        providerCostMicros: input.decision.providerCostMicros,
        providerUsageBucketId: input.bucketId,
        settledAt: now,
        settlementStatus: input.decision.settlementStatus,
        tenantId: input.tenantId,
        updatedAt: now,
      })
      .onConflictDoNothing({
        target: [providerUsageSettlements.providerUsageBucketId],
      })
      .returning({
        id: providerUsageSettlements.id,
      });

    return insertedSettlement?.id ?? null;
  });
}
