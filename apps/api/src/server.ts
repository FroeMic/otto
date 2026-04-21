import { configureOpenAiProxyBunRequestTimeout } from "./runtime/openai-proxy"

type BunRequestTimeoutServer = Parameters<
  typeof configureOpenAiProxyBunRequestTimeout
>[0]["server"]

type ApiFetchApp = {
  fetch: (
    request: Request,
    env?: { server: BunRequestTimeoutServer },
  ) => Response | Promise<Response>
}

type ApiFetchHandlerOptions = {
  app: ApiFetchApp
  env: {
    OPENAI_PROXY_STREAM_IDLE_TIMEOUT_SECONDS?: number
  }
}

export function createApiFetchHandler(options: ApiFetchHandlerOptions) {
  return (request: Request, server: BunRequestTimeoutServer) => {
    configureOpenAiProxyBunRequestTimeout({
      idleTimeoutSeconds: options.env.OPENAI_PROXY_STREAM_IDLE_TIMEOUT_SECONDS,
      request,
      server,
    })

    return options.app.fetch(request, { server })
  }
}
