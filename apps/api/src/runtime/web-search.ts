import { getEnv } from "@otto/feature-integrations-runtime/lib/env"
import type { OpenClawWebSearchConfig } from "@otto/feature-integrations-runtime/lib/web-search-config"
import { resolveRuntimeWebSearchConfig } from "@otto/feature-integrations-runtime/lib/web-search-config"

const BRAVE_WEB_SEARCH_ENDPOINT =
  "https://api.search.brave.com/res/v1/web/search"
const BRAVE_LLM_CONTEXT_ENDPOINT =
  "https://api.search.brave.com/res/v1/llm/context"
const BRAVE_FRESHNESS_MAP = {
  day: "pd",
  month: "pm",
  week: "pw",
  year: "py",
} as const

type BraveSearchResponse = {
  web?: {
    results?: Array<{
      age?: string
      description?: string
      title?: string
      url?: string
    }>
  }
}

type BraveLlmContextResponse = {
  grounding?: {
    generic?: Array<{
      snippets?: string[]
      title?: string
      url?: string
    }>
  }
  sources?: Array<{
    date?: string
    hostname?: string
    url?: string
  }>
}

export class RuntimeWebSearchProxyError extends Error {
  status: number

  constructor(message: string, status = 500) {
    super(message)
    this.name = "RuntimeWebSearchProxyError"
    this.status = status
  }
}

export async function proxyRuntimeWebSearchRequest(input: {
  request: Request
  tenantId: string
}) {
  const resolved = resolveRuntimeWebSearchConfig()

  if (!resolved.enabled || !resolved.openClawConfig) {
    throw new RuntimeWebSearchProxyError(
      resolved.reason ??
        "Managed web search is not configured for this workspace.",
      503,
    )
  }

  const args = await readRequestJson(input.request)
  const provider = resolved.openClawConfig.provider

  console.log(
    `[runtime-web-search] proxy tenant=${input.tenantId} provider=${provider} query=${typeof args.query === "string" ? args.query : "missing"}`,
  )

  switch (provider) {
    case "brave": {
      const braveApiKey = getEnv().RUNTIME_BRAVE_API_KEY

      if (!braveApiKey) {
        throw new RuntimeWebSearchProxyError(
          'Managed web search provider "brave" is missing RUNTIME_BRAVE_API_KEY in the workspace app.',
          503,
        )
      }

      return Response.json(
        await executeBraveWebSearchProxy({
          apiKey: braveApiKey,
          args,
          searchConfig: resolved.openClawConfig,
        }),
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      )
    }
    default:
      throw new RuntimeWebSearchProxyError(
        `Managed web search provider "${provider}" is not yet supported by Otto's runtime proxy.`,
        501,
      )
  }
}

export async function executeBraveWebSearchProxy(input: {
  apiKey: string
  args: Record<string, unknown>
  searchConfig: OpenClawWebSearchConfig
}) {
  const mode =
    input.searchConfig.brave?.mode === "llm-context" ? "llm-context" : "web"
  const query = readRequiredString(input.args.query, "query")
  const count = clampCount(
    typeof input.args.count === "number"
      ? input.args.count
      : input.searchConfig.maxResults,
  )
  const country = normalizeCountry(readOptionalString(input.args.country))
  const rawSearchLang =
    readOptionalString(input.args.search_lang) ??
    readOptionalString(input.args.language)
  const rawUiLang = readOptionalString(input.args.ui_lang)
  const freshness = normalizeFreshness(readOptionalString(input.args.freshness))
  const dateAfter = normalizeIsoDate(readOptionalString(input.args.date_after))
  const dateBefore = normalizeIsoDate(
    readOptionalString(input.args.date_before),
  )

  if (readOptionalString(input.args.freshness) && !freshness) {
    throw new RuntimeWebSearchProxyError(
      "freshness must be one of day, week, month, or year.",
      400,
    )
  }

  if (readOptionalString(input.args.date_after) && !dateAfter) {
    throw new RuntimeWebSearchProxyError(
      "date_after must be in YYYY-MM-DD format.",
      400,
    )
  }

  if (readOptionalString(input.args.date_before) && !dateBefore) {
    throw new RuntimeWebSearchProxyError(
      "date_before must be in YYYY-MM-DD format.",
      400,
    )
  }

  if (dateAfter && dateBefore && dateAfter > dateBefore) {
    throw new RuntimeWebSearchProxyError(
      "date_after must be before or equal to date_before.",
      400,
    )
  }

  if (mode === "llm-context") {
    if (freshness) {
      throw new RuntimeWebSearchProxyError(
        "freshness filtering is not supported by Brave llm-context mode.",
        400,
      )
    }

    if (dateAfter || dateBefore) {
      throw new RuntimeWebSearchProxyError(
        "date_after/date_before filtering is not supported by Brave llm-context mode.",
        400,
      )
    }

    if (rawUiLang) {
      throw new RuntimeWebSearchProxyError(
        "ui_lang is not supported by Brave llm-context mode.",
        400,
      )
    }

    return runBraveLlmContextSearch({
      apiKey: input.apiKey,
      ...(country ? { country } : {}),
      query,
      ...(rawSearchLang ? { searchLang: rawSearchLang } : {}),
    })
  }

  return runBraveWebSearch({
    apiKey: input.apiKey,
    count,
    ...(country ? { country } : {}),
    ...(dateAfter ? { dateAfter } : {}),
    ...(dateBefore ? { dateBefore } : {}),
    ...(freshness ? { freshness } : {}),
    query,
    ...(rawSearchLang ? { searchLang: rawSearchLang } : {}),
    ...(rawUiLang ? { uiLang: rawUiLang } : {}),
  })
}

async function runBraveWebSearch(input: {
  apiKey: string
  count: number
  country?: string
  dateAfter?: string
  dateBefore?: string
  freshness?: string
  query: string
  searchLang?: string
  uiLang?: string
}) {
  const url = new URL(BRAVE_WEB_SEARCH_ENDPOINT)
  url.searchParams.set("q", input.query)
  url.searchParams.set("count", String(input.count))

  if (input.country) {
    url.searchParams.set("country", input.country)
  }
  if (input.searchLang) {
    url.searchParams.set("search_lang", input.searchLang)
  }
  if (input.uiLang) {
    url.searchParams.set("ui_lang", input.uiLang)
  }
  if (input.freshness) {
    url.searchParams.set("freshness", input.freshness)
  } else if (input.dateAfter && input.dateBefore) {
    url.searchParams.set("freshness", `${input.dateAfter}to${input.dateBefore}`)
  } else if (input.dateAfter) {
    url.searchParams.set(
      "freshness",
      `${input.dateAfter}to${new Date().toISOString().slice(0, 10)}`,
    )
  } else if (input.dateBefore) {
    url.searchParams.set("freshness", `1970-01-01to${input.dateBefore}`)
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": input.apiKey,
    },
    method: "GET",
  })

  if (!response.ok) {
    throw new RuntimeWebSearchProxyError(
      `Brave Search API error (${response.status}): ${await response.text()}`,
      502,
    )
  }

  const payload = (await response.json()) as BraveSearchResponse
  const results = Array.isArray(payload.web?.results) ? payload.web.results : []

  return {
    provider: "brave",
    results: results.map((entry) => ({
      snippet: entry.description ?? "",
      title: entry.title ?? entry.url ?? "Untitled",
      url: entry.url ?? "",
      ...(entry.age ? { age: entry.age } : {}),
    })),
  }
}

async function runBraveLlmContextSearch(input: {
  apiKey: string
  country?: string
  query: string
  searchLang?: string
}) {
  const url = new URL(BRAVE_LLM_CONTEXT_ENDPOINT)
  url.searchParams.set("q", input.query)

  if (input.country) {
    url.searchParams.set("country", input.country)
  }
  if (input.searchLang) {
    url.searchParams.set("search_lang", input.searchLang)
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": input.apiKey,
    },
    method: "GET",
  })

  if (!response.ok) {
    throw new RuntimeWebSearchProxyError(
      `Brave LLM context API error (${response.status}): ${await response.text()}`,
      502,
    )
  }

  const payload = (await response.json()) as BraveLlmContextResponse
  const results = Array.isArray(payload.grounding?.generic)
    ? payload.grounding.generic
    : []

  return {
    provider: "brave",
    results: results.map((entry, index) => ({
      snippets: entry.snippets ?? [],
      title: entry.title ?? `Result ${index + 1}`,
      url: entry.url ?? payload.sources?.[index]?.url ?? "",
    })),
    sources: payload.sources ?? [],
  }
}

async function readRequestJson(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RuntimeWebSearchProxyError("Request body must be an object.", 400)
  }

  return body
}

function readRequiredString(value: unknown, label: string) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim()
  }

  throw new RuntimeWebSearchProxyError(`${label} is required.`, 400)
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function clampCount(value: number | undefined) {
  if (!value || !Number.isFinite(value)) {
    return 10
  }

  return Math.max(1, Math.min(10, Math.trunc(value)))
}

function normalizeCountry(value: string | null) {
  if (!value) {
    return undefined
  }

  const normalized = value.trim().toUpperCase()
  return normalized.length === 2 ? normalized : undefined
}

function normalizeFreshness(value: string | null) {
  if (!value) {
    return undefined
  }

  return BRAVE_FRESHNESS_MAP[value as keyof typeof BRAVE_FRESHNESS_MAP]
}

function normalizeIsoDate(value: string | null) {
  if (!value) {
    return undefined
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined
}
