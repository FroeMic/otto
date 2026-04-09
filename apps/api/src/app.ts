import type { Context } from "hono"
import { Hono } from "hono"

import {
  type LegacyRouteDefinition,
  type LegacyRouteMethod,
  legacyRouteDefinitions,
} from "./legacy-routes"

type LegacyRouteHandler = (
  request: Request,
  context?: {
    params: Promise<Record<string, string>>
  },
) => Promise<Response> | Response

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

  return handler(context.req.raw, {
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
