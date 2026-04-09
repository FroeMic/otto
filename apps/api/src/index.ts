import { serve } from "@hono/node-server"

import { createApiApp } from "./app"

const port = Number.parseInt(process.env.API_PORT ?? "3002", 10)
const app = createApiApp()

console.info(`[api] starting on :${port}`)

serve({
  fetch: app.fetch,
  hostname: "0.0.0.0",
  port,
})
