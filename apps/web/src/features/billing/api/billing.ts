import { queryOptions, useQueryClient } from "@tanstack/react-query"

import { apiClient } from "@/client/app/rpc"

import type { BillingOverview, BillingPreferences } from "../types"

export function billingOverviewQueryOptions(orgSlug: string) {
  return queryOptions({
    queryFn: async () => {
      const response =
        await apiClient.api.workspace[":orgSlug"].billing.overview.$get({
          param: {
            orgSlug,
          },
        })
      const data = (await response.json()) as {
        message?: string
      } & BillingOverview

      if (!response.ok) {
        throw new Error(data.message ?? "Request failed")
      }

      return data
    },
    queryKey: ["billing-overview", orgSlug],
    staleTime: 30_000,
  })
}

export async function updateBillingPreferences(input: {
  orgSlug: string
  preferences: BillingPreferences
}) {
  const response =
    await apiClient.api.workspace[":orgSlug"].billing.preferences.$post({
      json: input.preferences,
      param: {
        orgSlug: input.orgSlug,
      },
    })
  const data = (await response.json()) as {
    message?: string
    preferences: BillingPreferences
  }

  if (!response.ok) {
    throw new Error(data.message ?? "Failed to save billing settings.")
  }

  return data.preferences
}

export async function startBillingCheckout(input: {
  orgSlug: string
  planKey: string
}) {
  const response =
    await apiClient.api.workspace[":orgSlug"].billing.checkout.$post({
      json: {
        planKey: input.planKey as
          | "basic_monthly"
          | "plus_monthly"
          | "pro_monthly"
          | "max_monthly",
      },
      param: {
        orgSlug: input.orgSlug,
      },
    })
  const data = (await response.json()) as {
    message?: string
    url?: string | null
  }

  if (!response.ok || !data.url) {
    throw new Error(data.message ?? "Failed to start billing checkout.")
  }

  return data.url
}

export async function openBillingPortal(orgSlug: string) {
  const response = await apiClient.api.workspace[":orgSlug"].billing.portal.$post(
    {
      param: {
        orgSlug,
      },
    },
  )
  const data = (await response.json()) as {
    message?: string
    url?: string | null
  }

  if (!response.ok || !data.url) {
    throw new Error(data.message ?? "Failed to open billing portal.")
  }

  return data.url
}
