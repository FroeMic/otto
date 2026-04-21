import { websocket } from "hono/bun"

import { createApiApp } from "./app"
import { getApiEnv } from "./env"
import { createApiFetchHandler } from "./server"

const env = getApiEnv()
const port = env.API_PORT
const app = createApiApp()
const fetch = createApiFetchHandler({ app, env })

console.info(`[api] starting on :${port}`)

export default {
  fetch,
  hostname: "0.0.0.0",
  port,
  websocket,
}
