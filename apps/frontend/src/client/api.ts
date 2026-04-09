import { queryOptions } from "@tanstack/react-query"
import * as z from "zod"

const workspaceSummarySchema = z.object({
  id: z.string(),
  isReady: z.boolean(),
  locale: z.string(),
  name: z.string(),
  slug: z.string(),
  timeFormatPreference: z.string(),
  timezone: z.string(),
})

const shellBootstrapSchema = z.object({
  currentOrganization: workspaceSummarySchema,
  organizations: z.array(workspaceSummarySchema),
  user: z.object({
    email: z.string(),
    id: z.string(),
    isPlatformAdmin: z.boolean(),
    name: z.string(),
  }),
})

const usageOverviewSchema = z.object({
  summary: z.object({
    activeApiKeys: z.number(),
    activeModels: z.number(),
    totalCreditsBurnedMilli: z.number(),
    totalInputTokens: z.number(),
    totalOutputTokens: z.number(),
    totalProviderCostMicros: z.number(),
    totalRequests: z.number(),
  }),
  timeSeries: z.array(
    z.object({
      bucketStart: z.string().optional().nullable(),
      inputTokens: z.number().optional().nullable(),
      outputTokens: z.number().optional().nullable(),
      requests: z.number().optional().nullable(),
    }),
  ),
  usageByModel: z.array(
    z.object({
      creditsBurnedMilli: z.number().optional().nullable(),
      inputTokens: z.number().optional().nullable(),
      model: z.string(),
      outputTokens: z.number().optional().nullable(),
      provider: z.string().optional().nullable(),
      requests: z.number().optional().nullable(),
    }),
  ),
  usageByType: z.array(z.record(z.string(), z.unknown())),
})

export const usageSearchSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
})

export type ShellBootstrap = z.infer<typeof shellBootstrapSchema>
export type UsageOverview = z.infer<typeof usageOverviewSchema>
export type UsageSearch = z.infer<typeof usageSearchSchema>

async function fetchJson<TSchema extends z.ZodTypeAny>(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  const response = await fetch(input, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      typeof data?.message === "string"
        ? data.message
        : typeof data?.error === "string"
          ? data.error
          : "Request failed",
    )
  }

  return schema.parse(data)
}

export function getDefaultUsageSearch(): Required<UsageSearch> {
  const to = new Date()
  const from = new Date(to)
  from.setDate(to.getDate() - 30)

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  }
}

export function shellBootstrapQueryOptions(orgSlug: string) {
  return queryOptions({
    queryFn: () =>
      fetchJson(
        `/api/frontend/bootstrap/${orgSlug}`,
        {
          method: "GET",
        },
        shellBootstrapSchema,
      ),
    queryKey: ["shell-bootstrap", orgSlug],
    staleTime: 60_000,
  })
}

export function usageOverviewQueryOptions(
  orgSlug: string,
  search: Required<UsageSearch>,
) {
  const url = new URL(`/api/workspace/${orgSlug}/usage`, window.location.origin)
  url.searchParams.set("from", search.from)
  url.searchParams.set("to", search.to)

  return queryOptions({
    queryFn: () =>
      fetchJson(
        `${url.pathname}${url.search}`,
        {
          method: "GET",
        },
        usageOverviewSchema,
      ),
    queryKey: ["workspace-usage", orgSlug, search],
    staleTime: 30_000,
  })
}

export async function updateWorkspaceSettings(
  orgSlug: string,
  body:
    | { action: "update-name"; name: string }
    | { action: "update-slug"; slug: string },
) {
  return fetchJson(
    `/api/workspace/${orgSlug}/settings`,
    {
      body: JSON.stringify(body),
      method: "POST",
    },
    z.record(z.string(), z.unknown()),
  )
}
