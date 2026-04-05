import assert from "node:assert/strict";
import test from "node:test";

import {
  CREDIT_SETTLEMENT_STATUSES,
  priceOpenAiUsageBucket,
} from "@/lib/billing/openai-credit-pricing";
import { PROVIDER_USAGE_TYPES } from "@/lib/providers/types";

function buildBucket(
  overrides: Partial<Parameters<typeof priceOpenAiUsageBucket>[0]> = {},
): Parameters<typeof priceOpenAiUsageBucket>[0] {
  return {
    bucketEndAt: new Date("2026-04-05T12:01:00.000Z"),
    bucketId: "bucket_123",
    bucketStartAt: new Date("2026-04-05T12:00:00.000Z"),
    externalApiKeyId: "key_123",
    inputAudioTokens: null,
    inputCachedTokens: 0,
    inputImageTokens: null,
    inputTextTokens: 1_000,
    inputTokens: 1_000,
    inputUncachedTokens: 1_000,
    itemCount: 1,
    model: "gpt-5.4-2026-03-05",
    outputAudioTokens: null,
    outputImageTokens: null,
    outputTextTokens: 100,
    outputTokens: 100,
    providerAccountId: "provider_123",
    sessionCount: null,
    tenantId: "tenant_123",
    usageBytes: null,
    usageType: PROVIDER_USAGE_TYPES.completions,
    ...overrides,
  };
}

test("prices GPT-5.4 completion buckets into micro-dollar billable units", () => {
  const decision = priceOpenAiUsageBucket(
    buildBucket({
      inputCachedTokens: 500,
      inputTextTokens: 500,
      inputTokens: 1_000,
      inputUncachedTokens: 500,
      outputTextTokens: 200,
      outputTokens: 200,
    }),
  );

  assert.equal(decision.settlementStatus, CREDIT_SETTLEMENT_STATUSES.priced);
  assert.equal(decision.providerCostMicros, 4_375);
  assert.equal(decision.billableUnits, 4_375);
  assert.equal(decision.creditsBurnedMilli, 4_375);
});

test("marks unsupported image buckets without creating burn", () => {
  const decision = priceOpenAiUsageBucket(
    buildBucket({
      model: "gpt-image-1",
      usageType: PROVIDER_USAGE_TYPES.images,
    }),
  );

  assert.equal(
    decision.settlementStatus,
    CREDIT_SETTLEMENT_STATUSES.unsupported,
  );
  assert.equal(decision.providerCostMicros, 0);
  assert.equal(decision.creditsBurnedMilli, 0);
});
