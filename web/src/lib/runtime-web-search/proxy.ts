import { getEnv } from "@/lib/env";
import type { OpenClawWebSearchConfig } from "@/lib/web-search-config";
import { resolveRuntimeWebSearchConfig } from "@/lib/web-search-config";

const BRAVE_WEB_SEARCH_ENDPOINT =
  "https://api.search.brave.com/res/v1/web/search";
const BRAVE_LLM_CONTEXT_ENDPOINT =
  "https://api.search.brave.com/res/v1/llm/context";
const BRAVE_FRESHNESS_MAP = {
  day: "pd",
  month: "pm",
  week: "pw",
  year: "py",
} as const;

type BraveSearchResponse = {
  web?: {
    results?: Array<{
      age?: string;
      description?: string;
      title?: string;
      url?: string;
    }>;
  };
};

type BraveLlmContextResponse = {
  grounding?: {
    generic?: Array<{
      snippets?: string[];
      title?: string;
      url?: string;
    }>;
  };
  sources?: Array<{
    date?: string;
    hostname?: string;
    url?: string;
  }>;
};

export class RuntimeWebSearchProxyError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "RuntimeWebSearchProxyError";
    this.status = status;
  }
}

export async function proxyRuntimeWebSearchRequest(input: {
  request: Request;
  tenantId: string;
}) {
  const resolved = resolveRuntimeWebSearchConfig();

  if (!resolved.enabled || !resolved.openClawConfig) {
    throw new RuntimeWebSearchProxyError(
      resolved.reason ??
        "Managed web search is not configured for this workspace.",
      503,
    );
  }

  const args = await readRequestJson(input.request);
  const provider = resolved.openClawConfig.provider;

  console.log(
    `[runtime-web-search] proxy tenant=${input.tenantId} provider=${provider} query=${typeof args.query === "string" ? args.query : "missing"}`,
  );

  switch (provider) {
    case "brave":
      if (!getEnv().RUNTIME_BRAVE_API_KEY) {
        throw new RuntimeWebSearchProxyError(
          'Managed web search provider "brave" is missing RUNTIME_BRAVE_API_KEY in the workspace app.',
          503,
        );
      }

      return Response.json(
        await executeBraveWebSearchProxy({
          apiKey: getEnv().RUNTIME_BRAVE_API_KEY,
          args,
          searchConfig: resolved.openClawConfig,
        }),
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    default:
      throw new RuntimeWebSearchProxyError(
        `Managed web search provider "${provider}" is not yet supported by Otto's runtime proxy.`,
        501,
      );
  }
}

export async function executeBraveWebSearchProxy(input: {
  apiKey: string;
  args: Record<string, unknown>;
  searchConfig: OpenClawWebSearchConfig;
}) {
  const mode =
    input.searchConfig.brave?.mode === "llm-context" ? "llm-context" : "web";
  const query = readRequiredString(input.args.query, "query");
  const count = clampCount(
    typeof input.args.count === "number"
      ? input.args.count
      : input.searchConfig.maxResults,
  );
  const country = normalizeCountry(readOptionalString(input.args.country));
  const rawSearchLang =
    readOptionalString(input.args.search_lang) ??
    readOptionalString(input.args.language);
  const rawUiLang = readOptionalString(input.args.ui_lang);
  const freshness = normalizeFreshness(
    readOptionalString(input.args.freshness),
  );
  const dateAfter = normalizeIsoDate(readOptionalString(input.args.date_after));
  const dateBefore = normalizeIsoDate(
    readOptionalString(input.args.date_before),
  );

  if (readOptionalString(input.args.freshness) && !freshness) {
    throw new RuntimeWebSearchProxyError(
      "freshness must be one of day, week, month, or year.",
      400,
    );
  }

  if (readOptionalString(input.args.date_after) && !dateAfter) {
    throw new RuntimeWebSearchProxyError(
      "date_after must be in YYYY-MM-DD format.",
      400,
    );
  }

  if (readOptionalString(input.args.date_before) && !dateBefore) {
    throw new RuntimeWebSearchProxyError(
      "date_before must be in YYYY-MM-DD format.",
      400,
    );
  }

  if (dateAfter && dateBefore && dateAfter > dateBefore) {
    throw new RuntimeWebSearchProxyError(
      "date_after must be before or equal to date_before.",
      400,
    );
  }

  if (mode === "llm-context") {
    if (freshness) {
      throw new RuntimeWebSearchProxyError(
        "freshness filtering is not supported by Brave llm-context mode.",
        400,
      );
    }

    if (dateAfter || dateBefore) {
      throw new RuntimeWebSearchProxyError(
        "date_after/date_before filtering is not supported by Brave llm-context mode.",
        400,
      );
    }

    if (rawUiLang) {
      throw new RuntimeWebSearchProxyError(
        "ui_lang is not supported by Brave llm-context mode.",
        400,
      );
    }

    return await runBraveLlmContextSearch({
      apiKey: input.apiKey,
      country,
      query,
      searchLang: rawSearchLang,
    });
  }

  return await runBraveWebSearch({
    apiKey: input.apiKey,
    count,
    country,
    dateAfter,
    dateBefore,
    freshness,
    query,
    searchLang: rawSearchLang,
    uiLang: rawUiLang,
  });
}

async function runBraveWebSearch(input: {
  apiKey: string;
  count: number;
  country?: string;
  dateAfter?: string;
  dateBefore?: string;
  freshness?: string;
  query: string;
  searchLang?: string;
  uiLang?: string;
}) {
  const url = new URL(BRAVE_WEB_SEARCH_ENDPOINT);
  url.searchParams.set("q", input.query);
  url.searchParams.set("count", String(input.count));

  if (input.country) {
    url.searchParams.set("country", input.country);
  }
  if (input.searchLang) {
    url.searchParams.set("search_lang", input.searchLang);
  }
  if (input.uiLang) {
    url.searchParams.set("ui_lang", input.uiLang);
  }
  if (input.freshness) {
    url.searchParams.set("freshness", input.freshness);
  } else if (input.dateAfter && input.dateBefore) {
    url.searchParams.set(
      "freshness",
      `${input.dateAfter}to${input.dateBefore}`,
    );
  } else if (input.dateAfter) {
    url.searchParams.set(
      "freshness",
      `${input.dateAfter}to${new Date().toISOString().slice(0, 10)}`,
    );
  } else if (input.dateBefore) {
    url.searchParams.set("freshness", `1970-01-01to${input.dateBefore}`);
  }

  const startedAt = Date.now();
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": input.apiKey,
    },
    method: "GET",
  });

  if (!response.ok) {
    throw new RuntimeWebSearchProxyError(
      `Brave Search API error (${response.status}): ${await response.text()}`,
      502,
    );
  }

  const payload = (await response.json()) as BraveSearchResponse;
  const results = Array.isArray(payload.web?.results)
    ? payload.web.results
    : [];

  return {
    count: results.length,
    externalContent: {
      provider: "brave",
      source: "web_search",
      untrusted: true,
      wrapped: false,
    },
    provider: "brave",
    query: input.query,
    results: results.map((entry) => ({
      description: entry.description ?? "",
      published: entry.age || undefined,
      siteName: resolveSiteName(entry.url) || undefined,
      title: entry.title ?? "",
      url: entry.url ?? "",
    })),
    tookMs: Date.now() - startedAt,
  };
}

async function runBraveLlmContextSearch(input: {
  apiKey: string;
  country?: string;
  query: string;
  searchLang?: string;
}) {
  const url = new URL(BRAVE_LLM_CONTEXT_ENDPOINT);
  url.searchParams.set("q", input.query);

  if (input.country) {
    url.searchParams.set("country", input.country);
  }
  if (input.searchLang) {
    url.searchParams.set("search_lang", input.searchLang);
  }

  const startedAt = Date.now();
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": input.apiKey,
    },
    method: "GET",
  });

  if (!response.ok) {
    throw new RuntimeWebSearchProxyError(
      `Brave LLM Context API error (${response.status}): ${await response.text()}`,
      502,
    );
  }

  const payload = (await response.json()) as BraveLlmContextResponse;
  const results = Array.isArray(payload.grounding?.generic)
    ? payload.grounding.generic
    : [];

  return {
    count: results.length,
    externalContent: {
      provider: "brave",
      source: "web_search",
      untrusted: true,
      wrapped: false,
    },
    mode: "llm-context" as const,
    provider: "brave",
    query: input.query,
    results: results.map((entry) => ({
      siteName: resolveSiteName(entry.url) || undefined,
      snippets: Array.isArray(entry.snippets)
        ? entry.snippets.filter(
            (snippet): snippet is string =>
              typeof snippet === "string" && snippet.length > 0,
          )
        : [],
      title: entry.title ?? "",
      url: entry.url ?? "",
    })),
    sources: payload.sources,
    tookMs: Date.now() - startedAt,
  };
}

async function readRequestJson(request: Request) {
  try {
    const payload = await request.json();

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("Expected a JSON object.");
    }

    return payload as Record<string, unknown>;
  } catch (error) {
    throw new RuntimeWebSearchProxyError(
      error instanceof Error
        ? `Invalid web search request body: ${error.message}`
        : "Invalid web search request body.",
      400,
    );
  }
}

function readRequiredString(value: unknown, field: string) {
  const trimmed = readOptionalString(value);

  if (!trimmed) {
    throw new RuntimeWebSearchProxyError(`${field} is required.`, 400);
  }

  return trimmed;
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function clampCount(value: unknown) {
  const numeric =
    typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 5;

  return Math.max(1, Math.min(10, numeric));
}

function normalizeCountry(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const upper = value.toUpperCase();
  return upper.length > 1 ? upper : undefined;
}

function normalizeFreshness(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return BRAVE_FRESHNESS_MAP[
    value.toLowerCase() as keyof typeof BRAVE_FRESHNESS_MAP
  ];
}

function normalizeIsoDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : value;
}

function resolveSiteName(url: string | undefined) {
  if (!url) {
    return undefined;
  }

  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}
