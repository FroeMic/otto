import { Hono } from "hono"

import { createBillingRouter } from "./billing/routes"
import { createWorkspaceCoreRouter } from "./native/workspace-core"
import { createUserRouter } from "./user/routes"

export const webRpcApp = new Hono()
  .route("/", createWorkspaceCoreRouter())
  .route("/", createBillingRouter())
  .route("/", createUserRouter())

export type WebApiType = typeof webRpcApp
