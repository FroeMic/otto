import {
  PROVIDER_USAGE_TYPES,
  type ProviderUsageType,
} from "@/lib/providers/types";

export const CREDIT_LEDGER_ENTRY_TYPES = {
  providerUsageDebit: "provider_usage_debit",
} as const;

export const CREDIT_SETTLEMENT_STATUSES = {
  noCharge: "no_charge",
  priced: "priced",
  unsupported: "unsupported",
} as const;

export const CREDIT_PRICING_RULESET_VERSION = "openai_credit_v1";

const FULL_CREDIT_MILLI = 1_000;
const BILLABLE_UNITS_PER_USD = 1_000_000;

type CreditSettlementStatus =
  (typeof CREDIT_SETTLEMENT_STATUSES)[keyof typeof CREDIT_SETTLEMENT_STATUSES];

type TokenRate = {
  note: string;
  pricePerMillionAudioInput?: number;
  pricePerMillionAudioOutput?: number;
  pricePerMillionCachedTextInput?: number;
  pricePerMillionImageInput?: number;
  pricePerMillionImageOutput?: number;
  pricePerMillionTextInput?: number;
  pricePerMillionTextOutput?: number;
};

export type OpenAiUsageBucketPricingInput = {
  bucketEndAt: Date;
  bucketId: string;
  bucketStartAt: Date;
  externalApiKeyId: string;
  inputAudioTokens: number | null;
  inputCachedTokens: number | null;
  inputImageTokens: number | null;
  inputTextTokens: number | null;
  inputTokens: number | null;
  inputUncachedTokens: number | null;
  itemCount: number | null;
  model: string;
  outputAudioTokens: number | null;
  outputImageTokens: number | null;
  outputTextTokens: number | null;
  outputTokens: number | null;
  providerAccountId: string;
  sessionCount: number | null;
  tenantId: string;
  usageBytes: number | null;
  usageType: ProviderUsageType;
};

export type OpenAiUsageBucketPricingDecision = {
  billableUnits: number;
  creditsBurnedMilli: number;
  note: string;
  pricingVersion: string;
  providerCostMicros: number;
  settlementStatus: CreditSettlementStatus;
};

type MatchedTokenRate = TokenRate & {
  modelKey: string;
};

const COMPLETIONS_MODEL_RATES: MatchedTokenRate[] = [
  {
    modelKey: "gpt-5.4-mini",
    note: "GPT-5.4 mini text pricing",
    pricePerMillionCachedTextInput: 0.075,
    pricePerMillionTextInput: 0.75,
    pricePerMillionTextOutput: 4.5,
  },
  {
    modelKey: "gpt-5.4-nano",
    note: "GPT-5.4 nano text pricing",
    pricePerMillionCachedTextInput: 0.02,
    pricePerMillionTextInput: 0.2,
    pricePerMillionTextOutput: 1.25,
  },
  {
    modelKey: "gpt-5.4",
    note: "GPT-5.4 text pricing",
    pricePerMillionCachedTextInput: 0.25,
    pricePerMillionTextInput: 2.5,
    pricePerMillionTextOutput: 15,
  },
  {
    modelKey: "o3-mini",
    note: "o3-mini text pricing",
    pricePerMillionCachedTextInput: 0.55,
    pricePerMillionTextInput: 1.1,
    pricePerMillionTextOutput: 4.4,
  },
  {
    modelKey: "gpt-4o-mini-audio-preview",
    note: "GPT-4o mini audio preview pricing",
    pricePerMillionAudioInput: 10,
    pricePerMillionAudioOutput: 20,
    pricePerMillionTextInput: 0.15,
    pricePerMillionTextOutput: 0.6,
  },
];

const EMBEDDING_MODEL_RATES: MatchedTokenRate[] = [
  {
    modelKey: "text-embedding-3-large",
    note: "text-embedding-3-large pricing",
    pricePerMillionTextInput: 0.13,
  },
  {
    modelKey: "text-embedding-3-small",
    note: "text-embedding-3-small pricing",
    pricePerMillionTextInput: 0.02,
  },
];

const AUDIO_TRANSCRIPTION_MODEL_RATES: MatchedTokenRate[] = [
  {
    modelKey: "gpt-4o-transcribe",
    note: "GPT-4o transcribe pricing",
    pricePerMillionAudioInput: 2.5,
    pricePerMillionTextOutput: 10,
  },
  {
    modelKey: "gpt-4o-mini-transcribe",
    note: "GPT-4o mini transcribe pricing",
    pricePerMillionAudioInput: 1.25,
    pricePerMillionTextOutput: 5,
  },
];

const AUDIO_SPEECH_MODEL_RATES: MatchedTokenRate[] = [
  {
    modelKey: "gpt-4o-mini-tts",
    note: "GPT-4o mini TTS pricing",
    pricePerMillionAudioOutput: 12,
    pricePerMillionTextInput: 0.6,
  },
];

function toNullableNumber(value: number | null) {
  return value ?? 0;
}

function calculateTextTokenCostMicros(
  input: OpenAiUsageBucketPricingInput,
  rate: TokenRate,
) {
  const hasSpecificInputDimensions =
    input.inputTextTokens !== null ||
    input.inputAudioTokens !== null ||
    input.inputImageTokens !== null;
  const hasSpecificOutputDimensions =
    input.outputTextTokens !== null ||
    input.outputAudioTokens !== null ||
    input.outputImageTokens !== null;

  const uncachedTextInputTokens = toNullableNumber(
    input.inputUncachedTokens ??
      (input.inputTokens !== null &&
      input.inputCachedTokens !== null &&
      !hasSpecificInputDimensions
        ? Math.max(input.inputTokens - input.inputCachedTokens, 0)
        : (input.inputTextTokens ??
          (!hasSpecificInputDimensions ? input.inputTokens : 0))),
  );
  const cachedTextInputTokens = toNullableNumber(input.inputCachedTokens);
  const textOutputTokens = toNullableNumber(
    input.outputTextTokens ??
      (!hasSpecificOutputDimensions ? input.outputTokens : 0),
  );
  const audioInputTokens = toNullableNumber(input.inputAudioTokens);
  const audioOutputTokens = toNullableNumber(input.outputAudioTokens);
  const imageInputTokens = toNullableNumber(input.inputImageTokens);
  const imageOutputTokens = toNullableNumber(input.outputImageTokens);

  return roundMicros(
    uncachedTextInputTokens * (rate.pricePerMillionTextInput ?? 0) +
      cachedTextInputTokens * (rate.pricePerMillionCachedTextInput ?? 0) +
      textOutputTokens * (rate.pricePerMillionTextOutput ?? 0) +
      audioInputTokens * (rate.pricePerMillionAudioInput ?? 0) +
      audioOutputTokens * (rate.pricePerMillionAudioOutput ?? 0) +
      imageInputTokens * (rate.pricePerMillionImageInput ?? 0) +
      imageOutputTokens * (rate.pricePerMillionImageOutput ?? 0),
  );
}

function findMatchedTokenRate(
  model: string,
  rates: MatchedTokenRate[],
): MatchedTokenRate | null {
  return (
    rates.find(
      (candidate) =>
        model === candidate.modelKey ||
        model.startsWith(`${candidate.modelKey}-`),
    ) ?? null
  );
}

function roundMicros(value: number) {
  return Math.max(0, Math.round(value));
}

function buildPricedDecision(input: {
  note: string;
  providerCostMicros: number;
}) {
  const providerCostMicros = Math.max(0, input.providerCostMicros);
  const billableUnits = providerCostMicros;
  const creditsBurnedMilli = providerCostMicros;

  return {
    billableUnits,
    creditsBurnedMilli,
    note: input.note,
    pricingVersion: CREDIT_PRICING_RULESET_VERSION,
    providerCostMicros,
    settlementStatus:
      providerCostMicros > 0
        ? CREDIT_SETTLEMENT_STATUSES.priced
        : CREDIT_SETTLEMENT_STATUSES.noCharge,
  } satisfies OpenAiUsageBucketPricingDecision;
}

function buildUnsupportedDecision(note: string) {
  return {
    billableUnits: 0,
    creditsBurnedMilli: 0,
    note,
    pricingVersion: CREDIT_PRICING_RULESET_VERSION,
    providerCostMicros: 0,
    settlementStatus: CREDIT_SETTLEMENT_STATUSES.unsupported,
  } satisfies OpenAiUsageBucketPricingDecision;
}

function buildNoChargeDecision(note: string) {
  return {
    billableUnits: 0,
    creditsBurnedMilli: 0,
    note,
    pricingVersion: CREDIT_PRICING_RULESET_VERSION,
    providerCostMicros: 0,
    settlementStatus: CREDIT_SETTLEMENT_STATUSES.noCharge,
  } satisfies OpenAiUsageBucketPricingDecision;
}

function priceTextLikeUsageBucket(
  input: OpenAiUsageBucketPricingInput,
  rates: MatchedTokenRate[],
) {
  if (!input.model) {
    return buildUnsupportedDecision(
      `No model was recorded for ${input.usageType} bucket ${input.bucketId}.`,
    );
  }

  const matchedRate = findMatchedTokenRate(input.model, rates);

  if (!matchedRate) {
    return buildUnsupportedDecision(
      `No ${input.usageType} pricing rule matched model ${input.model}.`,
    );
  }

  return buildPricedDecision({
    note: matchedRate.note,
    providerCostMicros: calculateTextTokenCostMicros(input, matchedRate),
  });
}

function priceVectorStoreBucket(input: OpenAiUsageBucketPricingInput) {
  const usageBytes = toNullableNumber(input.usageBytes);

  if (usageBytes <= 0) {
    return buildNoChargeDecision("No vector storage usage was recorded.");
  }

  const providerCostMicros = roundMicros(
    (usageBytes / 1_000_000_000) * (100_000 / (24 * 60)),
  );

  return buildPricedDecision({
    note: "Vector store storage priced at $0.10 / GB-day across minute buckets.",
    providerCostMicros,
  });
}

export function priceOpenAiUsageBucket(
  input: OpenAiUsageBucketPricingInput,
): OpenAiUsageBucketPricingDecision {
  switch (input.usageType) {
    case PROVIDER_USAGE_TYPES.completions:
      return priceTextLikeUsageBucket(input, COMPLETIONS_MODEL_RATES);
    case PROVIDER_USAGE_TYPES.embeddings:
      return priceTextLikeUsageBucket(input, EMBEDDING_MODEL_RATES);
    case PROVIDER_USAGE_TYPES.audioTranscriptions:
      return priceTextLikeUsageBucket(input, AUDIO_TRANSCRIPTION_MODEL_RATES);
    case PROVIDER_USAGE_TYPES.audioSpeeches:
      return priceTextLikeUsageBucket(input, AUDIO_SPEECH_MODEL_RATES);
    case PROVIDER_USAGE_TYPES.vectorStores:
      return priceVectorStoreBucket(input);
    case PROVIDER_USAGE_TYPES.codeInterpreterSessions:
      return buildUnsupportedDecision(
        "Code interpreter session pricing is deferred until container size is exposed in usage buckets.",
      );
    case PROVIDER_USAGE_TYPES.images:
      return buildUnsupportedDecision(
        "Image pricing is deferred until usage buckets expose enough detail to reproduce per-image costs safely.",
      );
    case PROVIDER_USAGE_TYPES.moderations:
      return buildUnsupportedDecision(
        "Moderation pricing is not configured in the v1 hardcoded ruleset.",
      );
    default:
      return buildUnsupportedDecision(
        `No pricing rule is configured for usage type ${input.usageType}.`,
      );
  }
}

export function formatCreditsFromMilli(creditsMilli: number) {
  return Math.round(creditsMilli / FULL_CREDIT_MILLI);
}

export function formatUsdFromBillableUnits(billableUnits: number) {
  return billableUnits / BILLABLE_UNITS_PER_USD;
}
