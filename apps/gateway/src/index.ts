import { serve } from "@hono/node-server"

import { createGatewayApp } from "./app"

const port = Number.parseInt(process.env.INTEGRATION_GATEWAY_PORT ?? "3001", 10)
const app = createGatewayApp()

console.info(`[gateway] starting on :${port}`)

serve({
  fetch: app.fetch,
  hostname: "0.0.0.0",
  port,
})
