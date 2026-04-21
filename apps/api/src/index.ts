import { websocket } from "hono/bun"

import { createApiApp } from "./app"
import { getApiEnv } from "./env"
import { configureOpenAiProxyBunRequestTimeout } from "./runtime/openai-proxy"

const env = getApiEnv()
const port = env.API_PORT
const app = createApiApp()

type BunRequestTimeoutServer = Parameters<
  typeof configureOpenAiProxyBunRequestTimeout
>[0]["server"]

console.info(`[api] starting on :${port}`)

export default {
  fetch(request: Request, server: BunRequestTimeoutServer) {
    configureOpenAiProxyBunRequestTimeout({
      idleTimeoutSeconds: env.OPENAI_PROXY_STREAM_IDLE_TIMEOUT_SECONDS,
      request,
      server,
    })
    return app.fetch(request)
  },
  hostname: "0.0.0.0",
  port,
  websocket,
}
