import { Hono } from "hono"
import { logger } from "hono/logger"

import { createAgentRouter } from "./agent/routes"
import { registerAuthRoutes } from "./auth"
import {
  type BillingRouteDependencies,
  createBillingRouter,
} from "./billing/routes"
import { createFilesRouter } from "./files/routes"
import { createIntegrationsOauthRouter } from "./integrations/oauth-routes"
import { createIntegrationsRouter } from "./integrations/routes"
import {
  createWorkspaceOnboardingRouter,
  type WorkspaceOnboardingRouteDependencies,
} from "./onboarding/routes"
import {
  createPlatformRouter,
  type PlatformRouteDependencies,
} from "./platform/routes"
import {
  createPublicIntakeRouter,
  type PublicIntakeRouteDependencies,
} from "./public-intake/routes"
import { registerRuntimeRoutes } from "./runtime/routes"
import { createScheduledTasksRouter } from "./scheduled-tasks/routes"
import { createSessionsRouter } from "./sessions/routes"
import { createSkillsRouter } from "./skills/routes"
import { createUserRouter, type UserRouteDependencies } from "./user/routes"
import { createWorkspaceRouter } from "./workspace/routes"
import {
  createWorkspaceMembersRouter,
  type WorkspaceMembersRouteDependencies,
} from "./workspace-members/routes"
export type CreateApiAppOptions = {
  billingRoutes?: BillingRouteDependencies
  platformRoutes?: PlatformRouteDependencies
  publicIntakeRoutes?: PublicIntakeRouteDependencies
  userRoutes?: UserRouteDependencies
  workspaceOnboardingRoutes?: WorkspaceOnboardingRouteDependencies
  workspaceMembersRoutes?: WorkspaceMembersRouteDependencies
}

export function createApiApp(options: CreateApiAppOptions = {}) {
  const app = new Hono()
    .use("*", logger())
    .get("/healthz", (context) => {
      return context.json(
        {
          ok: true,
          service: "api",
        },
        200,
        {
          "Cache-Control": "no-store",
        },
      )
    })
    .route("/", createAgentRouter())
    .route("/", createWorkspaceRouter())
    .route("/", createIntegrationsRouter())
    .route("/", createIntegrationsOauthRouter())
    .route("/", createFilesRouter())
    .route("/", createSessionsRouter())
    .route("/", createScheduledTasksRouter())
    .route("/", createSkillsRouter())
    .route("/", createBillingRouter(options.billingRoutes))
    .route("/", createPlatformRouter(options.platformRoutes))
    .route("/", createPublicIntakeRouter(options.publicIntakeRoutes))
    .route(
      "/",
      createWorkspaceOnboardingRouter(options.workspaceOnboardingRoutes),
    )
    .route("/", createUserRouter(options.userRoutes))
    .route("/", createWorkspaceMembersRouter(options.workspaceMembersRoutes))

  registerAuthRoutes(app)
  registerRuntimeRoutes(app)
  app.notFound((context) => {
    return context.json(
      {
        error: "Not found",
      },
      404,
      {
        "Cache-Control": "no-store",
      },
    )
  })

  return app
}

export type AppType = ReturnType<typeof createApiApp>
