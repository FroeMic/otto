import {
  shellBootstrapSchema,
  usageOverviewSchema,
  usageSearchSchema,
  type WorkspaceSettingsSuccess,
  workspaceSettingsSuccessSchema,
} from "@otto/feature-workspace-core"
import { queryOptions } from "@tanstack/react-query"
import type * as z from "zod"

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
        `/api/web/bootstrap/${orgSlug}`,
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
    | { action: "update-slug"; slug: string }
    | { action: "update-locale"; locale: string }
    | { action: "update-time-format"; timeFormatPreference: string }
    | { action: "update-timezone"; timezone: string },
): Promise<WorkspaceSettingsSuccess> {
  return fetchJson(
    `/api/workspace/${orgSlug}/settings`,
    {
      body: JSON.stringify(body),
      method: "POST",
    },
    workspaceSettingsSuccessSchema,
  )
}

export {
  shellBootstrapSchema,
  usageOverviewSchema,
  usageSearchSchema,
  workspaceSettingsSuccessSchema,
}
