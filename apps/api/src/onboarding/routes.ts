import { zValidator } from "@hono/zod-validator"
import {
  authenticateWorkspaceSessionRequest,
  isWorkspaceSessionAuthError,
  jsonNoStore,
} from "@otto/auth"
import type { WorkspaceShellUser } from "@otto/feature-workspace-core"
import { Hono } from "hono"
import { z } from "zod"

import {
  consumeWorkspaceOnboardingStarterPrompt,
  WorkspaceOnboardingConflictError,
  getWorkspaceOnboardingRunSummary,
  saveWorkspaceOnboardingRun,
} from "./data"
import {
  workspaceOnboardingRunSummarySchema,
  workspaceOnboardingSaveRequestSchema,
} from "../../../../packages/features/workspace-onboarding/src/index"
import { syncUserFromSession } from "../workspace/data"

const workspaceOnboardingParamsSchema = z.object({
  orgSlug: z.string().min(1),
})

export type WorkspaceOnboardingRouteDependencies = {
  authenticateWorkspaceUser?: (request: Request) => Promise<WorkspaceShellUser>
  getWorkspaceOnboardingRunSummary: (input: {
    orgSlug: string
    userExternalId: string
  }) => Promise<z.infer<typeof workspaceOnboardingRunSummarySchema>>
  consumeWorkspaceOnboardingStarterPrompt: (input: {
    orgSlug: string
    userExternalId: string
  }) => Promise<void>
  saveWorkspaceOnboardingRun: (input: {
    body: z.infer<typeof workspaceOnboardingSaveRequestSchema>
    orgSlug: string
    userExternalId: string
  }) => Promise<z.infer<typeof workspaceOnboardingRunSummarySchema>>
  syncUserFromSession: (user: WorkspaceShellUser) => Promise<unknown>
}

function createDefaultWorkspaceOnboardingRouteDependencies(): WorkspaceOnboardingRouteDependencies {
  return {
    authenticateWorkspaceUser: (request) =>
      authenticateWorkspaceSessionRequest({ request }),
    consumeWorkspaceOnboardingStarterPrompt,
    getWorkspaceOnboardingRunSummary,
    saveWorkspaceOnboardingRun,
    syncUserFromSession,
  }
}

export function createWorkspaceOnboardingRouter(
  dependencies: WorkspaceOnboardingRouteDependencies = createDefaultWorkspaceOnboardingRouteDependencies(),
) {
  const app = new Hono()

  async function authenticateUser(request: Request) {
    try {
      return {
        user: await (dependencies.authenticateWorkspaceUser
          ? dependencies.authenticateWorkspaceUser(request)
          : authenticateWorkspaceSessionRequest({ request })),
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
      "/api/workspace/:orgSlug/onboarding",
      zValidator("param", workspaceOnboardingParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        await dependencies.syncUserFromSession(authResult.user)

        return context.json(
          workspaceOnboardingRunSummarySchema.parse(
            await dependencies.getWorkspaceOnboardingRunSummary({
              orgSlug: context.req.valid("param").orgSlug,
              userExternalId: authResult.user.id,
            }),
          ),
          200,
          {
            "Cache-Control": "no-store",
          },
        )
      },
    )
    .post(
      "/api/workspace/:orgSlug/onboarding",
      zValidator("param", workspaceOnboardingParamsSchema),
      zValidator("json", workspaceOnboardingSaveRequestSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        await dependencies.syncUserFromSession(authResult.user)

        try {
          return context.json(
            workspaceOnboardingRunSummarySchema.parse(
              await dependencies.saveWorkspaceOnboardingRun({
                body: context.req.valid("json"),
                orgSlug: context.req.valid("param").orgSlug,
                userExternalId: authResult.user.id,
              }),
            ),
            200,
            {
              "Cache-Control": "no-store",
            },
          )
        } catch (error) {
          if (error instanceof WorkspaceOnboardingConflictError) {
            return context.json(
              {
                code: error.code,
                message: error.message,
              },
              409,
              {
                "Cache-Control": "no-store",
              },
            )
          }

          throw error
        }
      },
    )
    .post(
      "/api/workspace/:orgSlug/onboarding/starter-prompt/consume",
      zValidator("param", workspaceOnboardingParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        await dependencies.syncUserFromSession(authResult.user)
        await dependencies.consumeWorkspaceOnboardingStarterPrompt({
          orgSlug: context.req.valid("param").orgSlug,
          userExternalId: authResult.user.id,
        })

        return context.json(
          {
            ok: true,
          },
          200,
          {
            "Cache-Control": "no-store",
          },
        )
      },
    )
}

export function registerWorkspaceOnboardingRoutes(
  app: Hono,
  dependencies: WorkspaceOnboardingRouteDependencies = createDefaultWorkspaceOnboardingRouteDependencies(),
) {
  return app.route("/", createWorkspaceOnboardingRouter(dependencies))
}
