import type { Hono } from "hono"

function getLegacyWorkspaceOrigin() {
  return process.env.WORKSPACE_APP_ORIGIN ?? "http://127.0.0.1:3000"
}

async function proxyToLegacy(request: Request) {
  const upstreamUrl = new URL(request.url)
  const targetUrl = new URL(
    `${upstreamUrl.pathname}${upstreamUrl.search}`,
    getLegacyWorkspaceOrigin(),
  )

  const response = await fetch(
    new Request(targetUrl, {
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : request.body,
      duplex: request.body ? "half" : undefined,
      headers: request.headers,
      method: request.method,
    }),
  )

  return new Response(response.body, {
    headers: response.headers,
    status: response.status,
  })
}

export function registerCompatibilityProxyRoutes(app: Hono) {
  app.get("/api/frontend/*", (context) => proxyToLegacy(context.req.raw))
  app.get("/api/workspace/*", (context) => proxyToLegacy(context.req.raw))
  app.post("/api/workspace/*", (context) => proxyToLegacy(context.req.raw))
  app.get("/api/user/*", (context) => proxyToLegacy(context.req.raw))
  app.post("/api/user/*", (context) => proxyToLegacy(context.req.raw))
}
