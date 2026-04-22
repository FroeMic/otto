import { zValidator } from "@hono/zod-validator"
import {
  authenticateWorkspaceSessionRequest,
  isWorkspaceSessionAuthError,
  jsonNoStore,
} from "@otto/auth"
import {
  type WorkspaceScheduledTaskDetailResponse,
  type WorkspaceScheduledTaskRunsResponse,
  type WorkspaceScheduledTasksListResponse,
  type WorkspaceScheduledTasksRefreshResponse,
  workspaceScheduledTaskDetailResponseSchema,
  workspaceScheduledTaskRunsResponseSchema,
  workspaceScheduledTasksListResponseSchema,
  workspaceScheduledTasksRefreshResponseSchema,
} from "@otto/feature-runtime-core/scheduled-tasks/workspace-contracts"
import { Hono } from "hono"
import { z } from "zod"

import {
  getWorkspaceScheduledTaskDetail,
  listWorkspaceScheduledTaskRuns,
  listWorkspaceScheduledTasks,
  refreshWorkspaceScheduledTasks,
} from "./data"

const workspaceScheduledTasksParamsSchema = z.object({
  orgSlug: z.string().min(1),
})

const workspaceScheduledTaskDetailParamsSchema =
  workspaceScheduledTasksParamsSchema.extend({
    taskKey: z.string().min(1),
  })

export interface ScheduledTasksRouteUser {
  email: string
  firstName?: string | null
  id: string
  lastName?: string | null
}

export interface ScheduledTasksRouteDependencies {
  authenticateWorkspaceUser: (
    request: Request,
  ) => Promise<ScheduledTasksRouteUser>
  getWorkspaceScheduledTaskDetail: (input: {
    orgSlug: string
    taskKey: string
    userExternalId: string
  }) => Promise<WorkspaceScheduledTaskDetailResponse | null>
  listWorkspaceScheduledTaskRuns: (input: {
    orgSlug: string
    userExternalId: string
  }) => Promise<WorkspaceScheduledTaskRunsResponse>
  listWorkspaceScheduledTasks: (input: {
    orgSlug: string
    userExternalId: string
  }) => Promise<WorkspaceScheduledTasksListResponse>
  refreshWorkspaceScheduledTasks: (input: {
    orgSlug: string
    userExternalId: string
  }) => Promise<WorkspaceScheduledTasksRefreshResponse>
}

function createDefaultScheduledTasksRouteDependencies(): ScheduledTasksRouteDependencies {
  return {
    authenticateWorkspaceUser: (request) =>
      authenticateWorkspaceSessionRequest({ request }),
    getWorkspaceScheduledTaskDetail,
    listWorkspaceScheduledTaskRuns,
    listWorkspaceScheduledTasks,
    refreshWorkspaceScheduledTasks,
  }
}

export function createScheduledTasksRouter(
  dependencies: ScheduledTasksRouteDependencies = createDefaultScheduledTasksRouteDependencies(),
) {
  const app = new Hono()

  async function authenticateUser(request: Request) {
    try {
      return {
        user: await dependencies.authenticateWorkspaceUser(request),
      } as const
    } catch (error) {
      if (isWorkspaceSessionAuthError(error)) {
        return {
          response: jsonNoStore(
            {
              code: error.code,
              message: error.message,
            },
            error.status,
          ),
        } as const
      }

      throw error
    }
  }

  return app
    .get(
      "/api/workspace/:orgSlug/scheduled-tasks/tasks",
      zValidator("param", workspaceScheduledTasksParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const response = await dependencies.listWorkspaceScheduledTasks({
          orgSlug: context.req.valid("param").orgSlug,
          userExternalId: authResult.user.id,
        })

        return jsonNoStore(
          workspaceScheduledTasksListResponseSchema.parse(response),
        )
      },
    )
    .get(
      "/api/workspace/:orgSlug/scheduled-tasks/task-runs",
      zValidator("param", workspaceScheduledTasksParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const response = await dependencies.listWorkspaceScheduledTaskRuns({
          orgSlug: context.req.valid("param").orgSlug,
          userExternalId: authResult.user.id,
        })

        return jsonNoStore(
          workspaceScheduledTaskRunsResponseSchema.parse(response),
        )
      },
    )
    .get(
      "/api/workspace/:orgSlug/scheduled-tasks/tasks/:taskKey",
      zValidator("param", workspaceScheduledTaskDetailParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const response = await dependencies.getWorkspaceScheduledTaskDetail({
          orgSlug: context.req.valid("param").orgSlug,
          taskKey: context.req.valid("param").taskKey,
          userExternalId: authResult.user.id,
        })

        if (!response) {
          return jsonNoStore(
            {
              code: "scheduled_task_not_found",
              message: "Scheduled task not found",
            },
            404,
          )
        }

        return jsonNoStore(
          workspaceScheduledTaskDetailResponseSchema.parse(response),
        )
      },
    )
    .post(
      "/api/workspace/:orgSlug/scheduled-tasks/refresh",
      zValidator("param", workspaceScheduledTasksParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const response = await dependencies.refreshWorkspaceScheduledTasks({
          orgSlug: context.req.valid("param").orgSlug,
          userExternalId: authResult.user.id,
        })

        return jsonNoStore(
          workspaceScheduledTasksRefreshResponseSchema.parse(response),
        )
      },
    )
}
