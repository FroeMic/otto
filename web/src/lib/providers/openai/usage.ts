import { getControlPlaneOpenAiAdminApiKey } from "@/lib/env";
import type {
  FetchUsageBucketsResult,
  ProviderUsageBucketResult,
  ProviderUsageCollector,
  ProviderUsageGroupByField,
  ProviderUsageType,
} from "@/lib/providers/types";

const OPENAI_ADMIN_API_BASE_URL = "https://api.openai.com/v1";

const OPENAI_USAGE_ENDPOINTS: Record<ProviderUsageType, string> = {
  audio_speeches: "/organization/usage/audio_speeches",
  audio_transcriptions: "/organization/usage/audio_transcriptions",
  code_interpreter_sessions: "/organization/usage/code_interpreter_sessions",
  completions: "/organization/usage/completions",
  embeddings: "/organization/usage/embeddings",
  images: "/organization/usage/images",
  moderations: "/organization/usage/moderations",
  vector_stores: "/organization/usage/vector_stores",
};

export class OpenAiUsageCollector implements ProviderUsageCollector {
  async fetchUsageBuckets(input: {
    bucketWidth: "1m";
    endTime: Date;
    groupBy: ProviderUsageGroupByField[];
    limit?: number;
    page?: string | null;
    projectId: string;
    startTime: Date;
    usageType: ProviderUsageType;
  }): Promise<FetchUsageBucketsResult> {
    const searchParams = new URLSearchParams({
      bucket_width: input.bucketWidth,
      end_time: toUnixTimestamp(input.endTime).toString(),
      limit: String(input.limit ?? 60),
      start_time: toUnixTimestamp(input.startTime).toString(),
    });

    if (input.page) {
      searchParams.set("page", input.page);
    }

    searchParams.append("project_ids", input.projectId);

    for (const groupByField of input.groupBy) {
      searchParams.append("group_by", groupByField);
    }

    const response = await fetch(
      `${OPENAI_ADMIN_API_BASE_URL}${OPENAI_USAGE_ENDPOINTS[input.usageType]}?${searchParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${getControlPlaneOpenAiAdminApiKey()}`,
          "Content-Type": "application/json",
        },
        method: "GET",
      },
    );
    const body = (await response.json()) as unknown;

    if (!response.ok) {
      throw new Error(buildOpenAiErrorMessage(body, response.status));
    }

    const pageRecord = getRecord(body, "OpenAI usage page");
    const data = getArray(pageRecord.data, "OpenAI usage buckets");
    const buckets = data.flatMap((bucket) =>
      flattenUsageBucket({
        rawBucket: getRecord(bucket, "OpenAI usage bucket"),
        usageType: input.usageType,
      }),
    );

    return {
      buckets,
      nextPage: getNullableString(pageRecord.next_page),
      rawPage: pageRecord,
    };
  }
}

function flattenUsageBucket(input: {
  rawBucket: Record<string, unknown>;
  usageType: ProviderUsageType;
}): ProviderUsageBucketResult[] {
  const bucketStartAt = fromUnixTimestamp(
    getNumber(input.rawBucket.start_time, "OpenAI usage bucket start_time"),
  );
  const bucketEndAt = fromUnixTimestamp(
    getNumber(input.rawBucket.end_time, "OpenAI usage bucket end_time"),
  );
  const results = getArray(
    input.rawBucket.results ?? input.rawBucket.result,
    "OpenAI usage bucket results",
  );

  return results.map((rawResult) => {
    const resultRecord = getRecord(rawResult, "OpenAI usage result");
    const externalApiKeyId = getNullableString(resultRecord.api_key_id);
    const externalProjectId = getNullableString(resultRecord.project_id);
    const externalUserId = getNullableString(resultRecord.user_id);
    const model = getNullableString(resultRecord.model);

    return {
      bucketEndAt,
      bucketKey: buildUsageBucketKey({
        bucketEndAt,
        bucketStartAt,
        externalApiKeyId,
        externalProjectId,
        externalUserId,
        model,
        usageType: input.usageType,
      }),
      bucketStartAt,
      externalApiKeyId,
      externalProjectId,
      externalUserId,
      metrics: stripUsageDimensionFields(resultRecord),
      model,
      rawBucket: input.rawBucket,
      rawResult: resultRecord,
    };
  });
}

function stripUsageDimensionFields(resultRecord: Record<string, unknown>) {
  const metrics: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(resultRecord)) {
    if (
      key === "api_key_id" ||
      key === "model" ||
      key === "object" ||
      key === "project_id" ||
      key === "user_id"
    ) {
      continue;
    }

    metrics[key] = value;
  }

  return metrics;
}

function buildUsageBucketKey(input: {
  bucketEndAt: Date;
  bucketStartAt: Date;
  externalApiKeyId: string | null;
  externalProjectId: string | null;
  externalUserId: string | null;
  model: string | null;
  usageType: ProviderUsageType;
}) {
  return JSON.stringify({
    apiKeyId: input.externalApiKeyId,
    bucketEndAt: input.bucketEndAt.toISOString(),
    bucketStartAt: input.bucketStartAt.toISOString(),
    model: input.model,
    projectId: input.externalProjectId,
    usageType: input.usageType,
    userId: input.externalUserId,
  });
}

function toUnixTimestamp(value: Date) {
  return Math.floor(value.getTime() / 1000);
}

function fromUnixTimestamp(value: number) {
  return new Date(value * 1000);
}

function getArray(value: unknown, label: string) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} was not an array`);
  }

  return value;
}

function getNumber(value: unknown, label: string) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${label} was not a valid number`);
  }

  return value;
}

function getRecord(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} was not an object`);
  }

  return value as Record<string, unknown>;
}

function getNullableString(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error("Expected OpenAI response string field");
  }

  return value;
}

function buildOpenAiErrorMessage(body: unknown, status: number) {
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error?: unknown }).error;

    if (error && typeof error === "object" && "message" in error) {
      const message = (error as { message?: unknown }).message;

      if (typeof message === "string" && message.length > 0) {
        return `OpenAI admin API request failed (${status}): ${message}`;
      }
    }
  }

  return `OpenAI admin API request failed (${status})`;
}
