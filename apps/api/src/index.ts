import { websocket } from "hono/bun"

import { createApiApp } from "./app"

const port = Number.parseInt(process.env.API_PORT ?? "3002", 10)
const app = createApiApp()

console.info(`[api] starting on :${port}`)

export default {
  fetch: app.fetch,
  hostname: "0.0.0.0",
  port,
  websocket,
}
