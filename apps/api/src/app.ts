import type { Context } from "hono"
import { Hono } from "hono"

import {
  type LegacyRouteDefinition,
  type LegacyRouteMethod,
  legacyRouteDefinitions,
} from "./legacy-routes"
import { registerRuntimeCoreRoutes } from "./native/runtime-core"
import { registerWorkspaceCoreRoutes } from "./native/workspace-core"
import { registerCompatibilityProxyRoutes } from "./proxy"

type LegacyRouteHandler = (
  request: Request,
  context?: {
    params: Promise<Record<string, string>>
  },
) => Promise<Response> | Response

type NextRequestLike = Request & {
  nextUrl: URL
}

function toLegacyRequest(request: Request, route: LegacyRouteDefinition) {
  if (route.requestMode !== "next-request") {
    return request
  }

  return Object.assign(new Request(request), {
    nextUrl: new URL(request.url),
  }) as NextRequestLike
}

async function invokeLegacyRoute(
  context: Context,
  route: LegacyRouteDefinition,
) {
  const legacyModule = (await import(route.legacyModulePath)) as Record<
    LegacyRouteMethod,
    LegacyRouteHandler
  >
  const handler = legacyModule[route.exportName]

  if (typeof handler !== "function") {
    return context.json(
      {
        error: `Legacy handler ${route.exportName} was not found`,
      },
      500,
      {
        "Cache-Control": "no-store",
      },
    )
  }

  return handler(toLegacyRequest(context.req.raw, route), {
    params: Promise.resolve(context.req.param()),
  })
}

function registerLegacyRoute(app: Hono, route: LegacyRouteDefinition) {
  const handler = async (context: Context) => invokeLegacyRoute(context, route)

  switch (route.exportName) {
    case "GET":
      app.get(route.honoPath, handler)
      break
    case "PATCH":
      app.patch(route.honoPath, handler)
      break
    case "POST":
      app.post(route.honoPath, handler)
      break
  }
}

export function createApiApp(
  routeDefinitions: LegacyRouteDefinition[] = legacyRouteDefinitions,
) {
  const app = new Hono()

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

  registerRuntimeCoreRoutes(app)
  registerWorkspaceCoreRoutes(app)
  registerCompatibilityProxyRoutes(app)

  for (const route of routeDefinitions) {
    registerLegacyRoute(app, route)
  }

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
