import { hc } from "hono/client"

import type { WebApiType } from "../../../../api/src/web-rpc"

export const apiClient = hc<WebApiType>("/", {
  init: {
    credentials: "include",
  },
})
