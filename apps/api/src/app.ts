import { Hono } from "hono"
import { logger } from "hono/logger"

import { registerAuthRoutes } from "./auth"
import {
  createBillingRouter,
  type BillingRouteDependencies,
} from "./billing/routes"
import { registerRuntimeCoreRoutes } from "./native/runtime-core"
import { createWorkspaceCoreRouter } from "./native/workspace-core"
import {
  createUserRouter,
  type UserRouteDependencies,
} from "./user/routes"

export type CreateApiAppOptions = {
  billingRoutes?: BillingRouteDependencies
  userRoutes?: UserRouteDependencies
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
    .route("/", createWorkspaceCoreRouter())
    .route("/", createBillingRouter(options.billingRoutes))
    .route("/", createUserRouter(options.userRoutes))

  registerAuthRoutes(app)
  registerRuntimeCoreRoutes(app)
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
