import { Hono } from "hono"
import { logger } from "hono/logger"

import { createAgentRouter } from "./agent/routes"
import { registerAuthRoutes } from "./auth"
import {
  createBillingRouter,
  type BillingRouteDependencies,
} from "./billing/routes"
import { registerRuntimeRoutes } from "./runtime/routes"
import { createIntegrationsRouter } from "./integrations/routes"
import {
  createPlatformRouter,
  type PlatformRouteDependencies,
} from "./platform/routes"
import {
  createUserRouter,
  type UserRouteDependencies,
} from "./user/routes"
import {
  createWorkspaceRouter,
} from "./workspace/routes"
import {
  createWorkspaceMembersRouter,
  type WorkspaceMembersRouteDependencies,
} from "./workspace-members/routes"
export type CreateApiAppOptions = {
  billingRoutes?: BillingRouteDependencies
  platformRoutes?: PlatformRouteDependencies
  userRoutes?: UserRouteDependencies
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
    .route("/", createBillingRouter(options.billingRoutes))
    .route("/", createPlatformRouter(options.platformRoutes))
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
