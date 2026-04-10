import { Hono } from "hono"

import { createBillingRouter } from "./billing/routes"
import { createPlatformRouter } from "./platform/routes"
import { createWorkspaceRouter } from "./workspace/routes"
import { createUserRouter } from "./user/routes"
import { createWorkspaceMembersRouter } from "./workspace-members/routes"

export const webRpcApp = new Hono()
  .route("/", createWorkspaceRouter())
  .route("/", createBillingRouter())
  .route("/", createPlatformRouter())
  .route("/", createUserRouter())
  .route("/", createWorkspaceMembersRouter())

export type WebApiType = typeof webRpcApp
