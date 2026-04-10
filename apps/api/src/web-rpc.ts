import { Hono } from "hono"

import { createWorkspaceCoreRouter } from "./native/workspace-core"
import { createUserRouter } from "./user/routes"

export const webRpcApp = new Hono()
  .route("/", createWorkspaceCoreRouter())
  .route("/", createUserRouter())

export type WebApiType = typeof webRpcApp
