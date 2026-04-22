import {
  workspaceSessionDetailResponseSchema,
  workspaceSessionsListResponseSchema,
  workspaceSessionsRefreshResponseSchema,
} from "@otto/feature-runtime-core/sessions/workspace-contracts"
import { queryOptions } from "@tanstack/react-query"

import { apiClient } from "@/client/app/rpc"
import { fetchApiResponse } from "@/features/workspace/api/workspace"

export function workspaceSessionsQueryOptions(orgSlug: string) {
  return queryOptions({
    queryFn: async () => {
      const response = await apiClient.api.workspace[":orgSlug"].sessions.$get({
        param: {
          orgSlug,
        },
      })

      return fetchApiResponse(response, (data) =>
        workspaceSessionsListResponseSchema.parse(data),
      )
    },
    queryKey: ["workspace-sessions", orgSlug],
    staleTime: 30_000,
  })
}

export function workspaceSessionDetailQueryOptions(input: {
  orgSlug: string
  sessionKey: string
}) {
  return queryOptions({
    queryFn: async () => {
      const response = await apiClient.api.workspace[":orgSlug"].sessions[
        ":sessionKey"
      ].$get({
        param: {
          orgSlug: input.orgSlug,
          sessionKey: input.sessionKey,
        },
      })

      return fetchApiResponse(response, (data) =>
        workspaceSessionDetailResponseSchema.parse(data),
      )
    },
    queryKey: ["workspace-session-detail", input.orgSlug, input.sessionKey],
    staleTime: 30_000,
  })
}

export async function refreshWorkspaceSessions(orgSlug: string) {
  const response = await apiClient.api.workspace[
    ":orgSlug"
  ].sessions.refresh.$post({
    param: {
      orgSlug,
    },
  })

  return fetchApiResponse(response, (data) =>
    workspaceSessionsRefreshResponseSchema.parse(data),
  )
}
