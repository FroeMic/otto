import { zValidator } from "@hono/zod-validator"
import {
  authenticateWorkspaceSessionRequest,
  isWorkspaceSessionAuthError,
  jsonNoStore,
} from "@otto/auth"
import {
  workspaceSessionDetailResponseSchema,
  workspaceSessionsListResponseSchema,
  workspaceSessionsRefreshResponseSchema,
  type WorkspaceSessionDetailResponse,
  type WorkspaceSessionsListResponse,
  type WorkspaceSessionsRefreshResponse,
} from "@otto/feature-runtime-core/sessions/workspace-contracts"
import { Hono } from "hono"
import { z } from "zod"

import {
  getWorkspaceSessionDetail,
  listWorkspaceSessions,
  refreshWorkspaceSessions,
} from "./data"
import { hasPlatformAdminRole } from "../workspace/data"

const workspaceSessionsParamsSchema = z.object({
  orgSlug: z.string().min(1),
})

const workspaceSessionDetailParamsSchema = workspaceSessionsParamsSchema.extend({
  sessionKey: z.string().min(1),
})

export interface SessionsRouteUser {
  email: string
  firstName?: string | null
  id: string
  lastName?: string | null
}

export interface SessionsRouteDependencies {
  authenticateWorkspaceUser: (request: Request) => Promise<SessionsRouteUser>
  getWorkspaceSessionDetail: (input: {
    isPlatformAdmin: boolean
    orgSlug: string
    sessionKey: string
    userExternalId: string
  }) => Promise<WorkspaceSessionDetailResponse | null>
  hasPlatformAdminRole: (userExternalId: string) => Promise<boolean>
  listWorkspaceSessions: (input: {
    orgSlug: string
    userExternalId: string
  }) => Promise<WorkspaceSessionsListResponse>
  refreshWorkspaceSessions: (input: {
    orgSlug: string
    userExternalId: string
  }) => Promise<WorkspaceSessionsRefreshResponse>
}

function createDefaultSessionsRouteDependencies(): SessionsRouteDependencies {
  return {
    authenticateWorkspaceUser: (request) =>
      authenticateWorkspaceSessionRequest({ request }),
    getWorkspaceSessionDetail,
    hasPlatformAdminRole,
    listWorkspaceSessions,
    refreshWorkspaceSessions,
  }
}

export function createSessionsRouter(
  dependencies: SessionsRouteDependencies = createDefaultSessionsRouteDependencies(),
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
      "/api/workspace/:orgSlug/sessions",
      zValidator("param", workspaceSessionsParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const response = await dependencies.listWorkspaceSessions({
          orgSlug: context.req.valid("param").orgSlug,
          userExternalId: authResult.user.id,
        })

        return jsonNoStore(workspaceSessionsListResponseSchema.parse(response))
      },
    )
    .get(
      "/api/workspace/:orgSlug/sessions/:sessionKey",
      zValidator("param", workspaceSessionDetailParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const isPlatformAdmin = await dependencies.hasPlatformAdminRole(
          authResult.user.id,
        )
        const response = await dependencies.getWorkspaceSessionDetail({
          isPlatformAdmin,
          orgSlug: context.req.valid("param").orgSlug,
          sessionKey: context.req.valid("param").sessionKey,
          userExternalId: authResult.user.id,
        })

        if (!response) {
          return jsonNoStore(
            {
              code: "session_not_found",
              message: "Session not found",
            },
            404,
          )
        }

        return jsonNoStore(workspaceSessionDetailResponseSchema.parse(response))
      },
    )
    .post(
      "/api/workspace/:orgSlug/sessions/refresh",
      zValidator("param", workspaceSessionsParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const response = await dependencies.refreshWorkspaceSessions({
          orgSlug: context.req.valid("param").orgSlug,
          userExternalId: authResult.user.id,
        })

        return jsonNoStore(
          workspaceSessionsRefreshResponseSchema.parse(response),
        )
      },
    )
}
