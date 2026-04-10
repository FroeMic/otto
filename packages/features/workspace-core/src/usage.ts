import { jsonNoStore } from "@otto/auth"

import type { WorkspaceShellUser } from "./bootstrap"
import { usageOverviewSchema, type WorkspaceUsageOverview } from "./schemas"

function getEmptyUsageOverview(): WorkspaceUsageOverview {
  return usageOverviewSchema.parse({
    summary: {
      activeApiKeys: 0,
      activeModels: 0,
      totalCreditsBurnedMilli: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalProviderCostMicros: 0,
      totalRequests: 0,
    },
    timeSeries: [],
    usageByModel: [],
    usageByType: [],
  })
}

export async function handleWorkspaceUsageRequest<
  TUser extends WorkspaceShellUser,
>(input: {
  getOrganizationTenantForBilling: (organizationId: string) => Promise<{
    id: string
  } | null>
  getOrganizationWorkspaceBySlug: (payload: {
    orgSlug: string
    userExternalId: string
  }) => Promise<{ id: string }>
  getTenantProviderUsageOverview: (payload: {
    from: Date
    tenantId: string
    to: Date
  }) => Promise<WorkspaceUsageOverview>
  orgSlug: string
  request: Request
  syncUserFromSession: (user: TUser) => Promise<unknown>
  user: TUser
}) {
  try {
    await input.syncUserFromSession(input.user)
    const url = new URL(input.request.url)
    const fromParam = url.searchParams.get("from")
    const toParam = url.searchParams.get("to")

    if (!fromParam || !toParam) {
      return jsonNoStore(
        { code: "bad_request", message: "Missing from/to params" },
        400,
      )
    }

    const from = new Date(fromParam)
    const to = new Date(toParam)

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return jsonNoStore(
        { code: "bad_request", message: "Invalid from/to dates" },
        400,
      )
    }

    if (from > to) {
      return jsonNoStore(
        {
          code: "bad_request",
          message: "The start date must be before the end date.",
        },
        400,
      )
    }

    const organization = await input.getOrganizationWorkspaceBySlug({
      orgSlug: input.orgSlug,
      userExternalId: input.user.id,
    })
    const tenant = await input.getOrganizationTenantForBilling(organization.id)

    if (!tenant) {
      return jsonNoStore(getEmptyUsageOverview())
    }

    const overview = await input.getTenantProviderUsageOverview({
      from,
      tenantId: tenant.id,
      to,
    })

    return jsonNoStore(usageOverviewSchema.parse(overview))
  } catch (error) {
    return jsonNoStore(
      {
        code: "usage_fetch_failed",
        message: error instanceof Error ? error.message : "Usage fetch failed.",
      },
      500,
    )
  }
}
