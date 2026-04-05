import {
  listUnsettledProviderUsageBuckets,
  recordProviderUsageSettlement,
} from "@/db/credit-ledger";
import {
  CREDIT_SETTLEMENT_STATUSES,
  type OpenAiUsageBucketPricingInput,
  priceOpenAiUsageBucket,
} from "@/lib/billing/openai-credit-pricing";
import type { ProviderUsageType } from "@/lib/providers/types";

const CREDIT_SETTLEMENT_SWEEP_INTERVAL_MS = 30_000;
const CREDIT_SETTLEMENT_BATCH_SIZE = 250;

let nextSettlementSweepAt = 0;

export async function runCreditBurndownSettlementCycle() {
  const now = Date.now();

  if (now < nextSettlementSweepAt) {
    return 0;
  }

  nextSettlementSweepAt = now + CREDIT_SETTLEMENT_SWEEP_INTERVAL_MS;

  const buckets = await listUnsettledProviderUsageBuckets({
    limit: CREDIT_SETTLEMENT_BATCH_SIZE,
  });

  let settledBucketCount = 0;

  for (const bucket of buckets) {
    try {
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

      if (
        decision.settlementStatus === CREDIT_SETTLEMENT_STATUSES.unsupported
      ) {
        console.warn(
          `[worker] usage bucket ${bucket.bucketId} settled as unsupported: ${decision.note}`,
        );
      }
    } catch (error) {
      console.error(
        `[worker] failed to settle provider usage bucket ${bucket.bucketId}`,
        error,
      );
    }
  }

  return settledBucketCount;
}
