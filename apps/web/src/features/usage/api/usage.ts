import {
  usageOverviewSchema,
  usageSearchSchema,
} from "@otto/feature-workspace-core"
import { queryOptions } from "@tanstack/react-query"

import { apiClient } from "@/client/app/rpc"

import type { UsageOverview, UsageSearch } from "../types"

export function getDefaultUsageSearch(): Required<UsageSearch> {
  const to = new Date()
  const from = new Date(to)
  from.setDate(to.getDate() - 30)

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  }
}

export function usageOverviewQueryOptions(
  orgSlug: string,
  search: Required<UsageSearch>,
) {
  return queryOptions({
    queryFn: async () => {
      const response = await apiClient.api.workspace[":orgSlug"].usage.$get({
        param: {
          orgSlug,
        },
        query: search,
      })
      const data = (await response.json()) as {
        message?: string
      }

      if (!response.ok) {
        throw new Error(data.message ?? "Request failed")
      }

      return usageOverviewSchema.parse(data) as UsageOverview
    },
    queryKey: ["workspace-usage", orgSlug, search],
    staleTime: 30_000,
  })
}

export {
  usageOverviewSchema,
  usageSearchSchema,
}
