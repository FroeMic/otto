import { serve } from "@hono/node-server"

import { createApp } from "./app"
import { getEnv } from "./env"

const env = getEnv()
const app = createApp()

if (import.meta.main) {
  console.info(`[frontend] starting on :${env.FRONTEND_PORT}`)

  serve({
    fetch: app.fetch,
    port: env.FRONTEND_PORT,
  })
}

export { app }
