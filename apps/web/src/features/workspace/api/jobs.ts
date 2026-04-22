import {
  type WorkspaceJobStatusResponse,
  workspaceJobStatusResponseSchema,
} from "@otto/feature-integrations-runtime/workspace"

import { apiClient } from "@/client/app/rpc"

import { fetchApiResponse } from "./workspace"

export async function fetchWorkspaceJobStatus(input: {
  jobId: string
  orgSlug: string
}): Promise<WorkspaceJobStatusResponse> {
  const response = await apiClient.api.workspace[":orgSlug"].jobs[
    ":jobId"
  ].status.$get({
    param: {
      jobId: input.jobId,
      orgSlug: input.orgSlug,
    },
  })

  return fetchApiResponse(response, (data) =>
    workspaceJobStatusResponseSchema.parse(data),
  )
}
