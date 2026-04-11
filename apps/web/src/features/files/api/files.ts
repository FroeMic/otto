import { runtimeDirectoryListingResponseSchema } from "@otto/feature-runtime-core/runtime-files/types"
import { queryOptions } from "@tanstack/react-query"

import { apiClient } from "@/client/app/rpc"
import { fetchApiResponse } from "@/features/workspace/api/workspace"

export function workspaceFilesQueryOptions(orgSlug: string) {
  return queryOptions({
    queryFn: async () => {
      const response = await apiClient.api.workspace[":orgSlug"].files.$get({
        param: {
          orgSlug,
        },
      })

      return fetchApiResponse(response, (data) =>
        runtimeDirectoryListingResponseSchema.parse(data),
      )
    },
    queryKey: ["workspace-files", orgSlug],
    staleTime: 30_000,
  })
}

export function buildWorkspaceFileDownloadUrl(input: {
  disposition?: "attachment" | "inline"
  kind?: "directory" | "file"
  orgSlug: string
  path: string
}) {
  const searchParams = new URLSearchParams({
    disposition: input.disposition ?? "attachment",
    kind: input.kind ?? "file",
    path: input.path,
  })

  return `/api/workspace/${encodeURIComponent(input.orgSlug)}/files/download?${searchParams.toString()}`
}
