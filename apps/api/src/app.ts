import { Hono } from "hono"
import { logger } from "hono/logger"

import { registerAuthRoutes } from "./auth"
import { registerRuntimeCoreRoutes } from "./native/runtime-core"
import { registerWorkspaceChatRoutes } from "./native/workspace-chat"
import { registerWorkspaceCoreRoutes } from "./native/workspace-core"
export function createApiApp() {
  const app = new Hono()

  app.use("*", logger())

  app.get("/healthz", (context) => {
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

  registerAuthRoutes(app)
  registerRuntimeCoreRoutes(app)
  registerWorkspaceCoreRoutes(app)
  registerWorkspaceChatRoutes(app)

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
