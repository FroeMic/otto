import {
  type WorkspaceOnboardingRunSummary,
  type WorkspaceOnboardingSaveRequest,
  workspaceOnboardingRunSummarySchema,
  workspaceOnboardingSaveRequestSchema,
} from "@otto/feature-workspace-onboarding"
import { queryOptions } from "@tanstack/react-query"

import { apiClient } from "@/client/app/rpc"
import { fetchApiResponse } from "@/features/workspace/api/workspace"

export async function fetchWorkspaceOnboardingSummary(orgSlug: string) {
  const response = await apiClient.api.workspace[":orgSlug"].onboarding.$get({
    param: {
      orgSlug,
    },
  })

  return fetchApiResponse(response, (data) =>
    workspaceOnboardingRunSummarySchema.parse(data),
  )
}

export function workspaceOnboardingQueryOptions(orgSlug: string) {
  return queryOptions({
    queryFn: async () => fetchWorkspaceOnboardingSummary(orgSlug),
    queryKey: ["workspace-onboarding", orgSlug],
    staleTime: 5_000,
  })
}

export async function saveWorkspaceOnboarding(
  orgSlug: string,
  body: WorkspaceOnboardingSaveRequest,
): Promise<WorkspaceOnboardingRunSummary> {
  const response = await apiClient.api.workspace[":orgSlug"].onboarding.$post({
    json: workspaceOnboardingSaveRequestSchema.parse(body),
    param: {
      orgSlug,
    },
  })

  return fetchApiResponse(response, (data) =>
    workspaceOnboardingRunSummarySchema.parse(data),
  )
}

export async function consumeWorkspaceOnboardingStarterPrompt(orgSlug: string) {
  const response =
    await apiClient.api.workspace[":orgSlug"].onboarding["starter-prompt"][
      "consume"
    ].$post({
      param: {
        orgSlug,
      },
    })

  await fetchApiResponse(response, (data) => {
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      (data as { ok?: unknown }).ok !== true
    ) {
      throw new Error("Invalid starter prompt consume response")
    }

    return data
  })
}
