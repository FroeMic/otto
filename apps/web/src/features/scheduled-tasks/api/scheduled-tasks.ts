import {
  workspaceScheduledTaskDetailResponseSchema,
  workspaceScheduledTaskRunsResponseSchema,
  workspaceScheduledTasksListResponseSchema,
  workspaceScheduledTasksRefreshResponseSchema,
} from "@otto/feature-runtime-core/scheduled-tasks/workspace-contracts"
import { queryOptions } from "@tanstack/react-query"

import { apiClient } from "@/client/app/rpc"
import { fetchApiResponse } from "@/features/workspace/api/workspace"

export function workspaceScheduledTasksQueryOptions(orgSlug: string) {
  return queryOptions({
    queryFn: async () => {
      const response = await apiClient.api.workspace[":orgSlug"][
        "scheduled-tasks"
      ].tasks.$get({
        param: {
          orgSlug,
        },
      })

      return fetchApiResponse(response, (data) =>
        workspaceScheduledTasksListResponseSchema.parse(data),
      )
    },
    queryKey: ["workspace-scheduled-tasks", orgSlug, "tasks"],
    staleTime: 30_000,
  })
}

export function workspaceScheduledTaskRunsQueryOptions(orgSlug: string) {
  return queryOptions({
    queryFn: async () => {
      const response = await apiClient.api.workspace[":orgSlug"][
        "scheduled-tasks"
      ]["task-runs"].$get({
        param: {
          orgSlug,
        },
      })

      return fetchApiResponse(response, (data) =>
        workspaceScheduledTaskRunsResponseSchema.parse(data),
      )
    },
    queryKey: ["workspace-scheduled-tasks", orgSlug, "task-runs"],
    staleTime: 30_000,
  })
}

export function workspaceScheduledTaskDetailQueryOptions(input: {
  orgSlug: string
  taskKey: string
}) {
  return queryOptions({
    queryFn: async () => {
      const response = await apiClient.api.workspace[":orgSlug"][
        "scheduled-tasks"
      ].tasks[":taskKey"].$get({
        param: {
          orgSlug: input.orgSlug,
          taskKey: input.taskKey,
        },
      })

      return fetchApiResponse(response, (data) =>
        workspaceScheduledTaskDetailResponseSchema.parse(data),
      )
    },
    queryKey: [
      "workspace-scheduled-tasks",
      input.orgSlug,
      "detail",
      input.taskKey,
    ],
    staleTime: 30_000,
  })
}

export async function refreshWorkspaceScheduledTasks(orgSlug: string) {
  const response = await apiClient.api.workspace[":orgSlug"][
    "scheduled-tasks"
  ].refresh.$post({
    param: {
      orgSlug,
    },
  })

  return fetchApiResponse(response, (data) =>
    workspaceScheduledTasksRefreshResponseSchema.parse(data),
  )
}
