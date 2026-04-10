import { Hono } from "hono"

import { createBillingRouter } from "./billing/routes"
import { createWorkspaceRouter } from "./workspace/routes"
import { createUserRouter } from "./user/routes"
import { createWorkspaceMembersRouter } from "./workspace-members/routes"

export const webRpcApp = new Hono()
  .route("/", createWorkspaceRouter())
  .route("/", createBillingRouter())
  .route("/", createUserRouter())
  .route("/", createWorkspaceMembersRouter())

export type WebApiType = typeof webRpcApp
