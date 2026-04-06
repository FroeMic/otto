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
    const responseText = await response.text();
    const { body, parseMode } = parseOpenAiResponseBody(responseText);

    if (!response.ok) {
      console.error("[worker] OpenAI admin usage request failed", {
        bodyPreview: getOpenAiResponseBodyPreview(body),
        bodyShape: describeOpenAiResponseBody(body),
        contentType: response.headers.get("content-type"),
        parseMode,
        projectId: input.projectId,
        status: response.status,
        usageType: input.usageType,
      });
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
    const model = getNullableString(resultRecord.model);

    return {
      bucketStartAt,
      bucketEndAt,
      externalApiKeyId,
      itemCount: getFirstNumber(resultRecord, [
        "num_model_requests",
        "num_requests",
        "num_images",
        "num_moderations",
      ]),
      inputAudioTokens: getOptionalNumber(resultRecord.input_audio_tokens),
      inputCachedTokens: getOptionalNumber(resultRecord.input_cached_tokens),
      inputImageTokens: getOptionalNumber(resultRecord.input_image_tokens),
      inputTextTokens: getOptionalNumber(resultRecord.input_text_tokens),
      inputTokens: getOptionalNumber(resultRecord.input_tokens),
      inputUncachedTokens: getOptionalNumber(
        resultRecord.input_uncached_tokens,
      ),
      model,
      outputAudioTokens: getOptionalNumber(resultRecord.output_audio_tokens),
      outputImageTokens: getOptionalNumber(resultRecord.output_image_tokens),
      outputTextTokens: getOptionalNumber(resultRecord.output_text_tokens),
      outputTokens: getOptionalNumber(resultRecord.output_tokens),
      sessionCount: getFirstNumber(resultRecord, ["num_sessions"]),
      usageBytes: getFirstNumber(resultRecord, [
        "usage_bytes",
        "storage_bytes",
      ]),
    };
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

function getOptionalNumber(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error("Expected OpenAI response number field");
  }

  return value;
}

function getFirstNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (value === null || value === undefined) {
      continue;
    }

    return getOptionalNumber(value);
  }

  return null;
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

  if (typeof body === "string" && body.trim().length > 0) {
    return `OpenAI admin API request failed (${status}): ${body.trim()}`;
  }

  return `OpenAI admin API request failed (${status})`;
}

function parseOpenAiResponseBody(responseText: string): {
  body: unknown;
  parseMode: "empty" | "json" | "text";
} {
  if (responseText.length === 0) {
    return {
      body: null,
      parseMode: "empty",
    };
  }

  try {
    return {
      body: JSON.parse(responseText) as unknown,
      parseMode: "json",
    };
  } catch {
    return {
      body: responseText,
      parseMode: "text",
    };
  }
}

function describeOpenAiResponseBody(body: unknown) {
  if (body === null) {
    return "null";
  }

  if (Array.isArray(body)) {
    return `array(${body.length})`;
  }

  if (typeof body === "string") {
    return `string(${body.length})`;
  }

  if (typeof body === "object") {
    const keys = Object.keys(body as Record<string, unknown>);
    return `object(${keys.join(",") || "no-keys"})`;
  }

  return typeof body;
}

function getOpenAiResponseBodyPreview(body: unknown) {
  if (body === null) {
    return null;
  }

  if (typeof body === "string") {
    return body.slice(0, 500);
  }

  try {
    return JSON.stringify(body).slice(0, 500);
  } catch {
    return String(body).slice(0, 500);
  }
}
