import { runtimeDirectoryListingResponseSchema } from "@otto/feature-runtime-core/runtime-files/types"
import { queryOptions } from "@tanstack/react-query"

import { apiClient } from "@/client/app/rpc"
import { fetchApiResponse } from "@/features/workspace/api/workspace"

export function workspaceSkillFilesQueryOptions(input: {
  orgSlug: string
  skillKey: string
}) {
  return queryOptions({
    queryFn: async () => {
      const response =
        await apiClient.api.workspace[":orgSlug"].skills[":skillKey"].files.$get(
          {
            param: {
              orgSlug: input.orgSlug,
              skillKey: input.skillKey,
            },
          },
        )

      return fetchApiResponse(response, (data) =>
        runtimeDirectoryListingResponseSchema.parse(data),
      )
    },
    queryKey: ["workspace-skill-files", input.orgSlug, input.skillKey],
    staleTime: 30_000,
  })
}

export function buildWorkspaceSkillFileDownloadUrl(input: {
  disposition?: "attachment" | "inline"
  kind?: "directory" | "file"
  orgSlug: string
  path: string
  skillKey: string
}) {
  const searchParams = new URLSearchParams({
    disposition: input.disposition ?? "attachment",
    kind: input.kind ?? "file",
    path: input.path,
  })

  return `/api/workspace/${encodeURIComponent(input.orgSlug)}/skills/${encodeURIComponent(input.skillKey)}/files/download?${searchParams.toString()}`
}
