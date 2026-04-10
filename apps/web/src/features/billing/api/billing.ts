import {
  billingCheckoutSchema,
  billingOverviewSchema,
  billingPreferencesResponseSchema,
  billingUrlResponseSchema,
  type BillingOverview,
  type BillingPreferences,
  type BillingPreferencesResponse,
  type BillingUrlResponse,
} from "@otto/feature-billing"
import { queryOptions } from "@tanstack/react-query"

import { apiClient } from "@/client/app/rpc"

import { fetchApiResponse } from "@/features/workspace/api/workspace"

export function parseBillingOverview(data: unknown): BillingOverview {
  return billingOverviewSchema.parse(data)
}

export function parseBillingPreferencesResponse(
  data: unknown,
): BillingPreferencesResponse {
  return billingPreferencesResponseSchema.parse(data)
}

export function parseBillingUrlResponse(data: unknown): BillingUrlResponse {
  return billingUrlResponseSchema.parse(data)
}

export function billingOverviewQueryOptions(orgSlug: string) {
  return queryOptions({
    queryFn: async () => {
      const response =
        await apiClient.api.workspace[":orgSlug"].billing.overview.$get({
          param: {
            orgSlug,
          },
        })

      return fetchApiResponse(response, parseBillingOverview)
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

  return fetchApiResponse(response, parseBillingPreferencesResponse).then(
    (data) => data.preferences,
  )
}

export async function startBillingCheckout(input: {
  orgSlug: string
  planKey: string
}) {
  const response =
    await apiClient.api.workspace[":orgSlug"].billing.checkout.$post({
      json: billingCheckoutSchema.parse({
        planKey: input.planKey,
      }),
      param: {
        orgSlug: input.orgSlug,
      },
    })
  const data = await fetchApiResponse(response, parseBillingUrlResponse)

  if (!data.url) {
    throw new Error("Failed to start billing checkout.")
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
  const data = await fetchApiResponse(response, parseBillingUrlResponse)

  if (!data.url) {
    throw new Error("Failed to open billing portal.")
  }

  return data.url
}
