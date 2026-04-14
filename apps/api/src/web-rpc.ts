import { Hono } from "hono"

import { createAgentRouter } from "./agent/routes"
import { createBillingRouter } from "./billing/routes"
import { createFilesRouter } from "./files/routes"
import { createIntegrationsRouter } from "./integrations/routes"
import { createWorkspaceOnboardingRouter } from "./onboarding/routes"
import { createPlatformRouter } from "./platform/routes"
import { createScheduledTasksRouter } from "./scheduled-tasks/routes"
import { createSessionsRouter } from "./sessions/routes"
import { createWorkspaceRouter } from "./workspace/routes"
import { createSkillsRouter } from "./skills/routes"
import { createUserRouter } from "./user/routes"
import { createWorkspaceMembersRouter } from "./workspace-members/routes"

export const webRpcApp = new Hono()
  .route("/", createAgentRouter())
  .route("/", createWorkspaceRouter())
  .route("/", createIntegrationsRouter())
  .route("/", createFilesRouter())
  .route("/", createSessionsRouter())
  .route("/", createScheduledTasksRouter())
  .route("/", createSkillsRouter())
  .route("/", createBillingRouter())
  .route("/", createPlatformRouter())
  .route("/", createWorkspaceOnboardingRouter())
  .route("/", createUserRouter())
  .route("/", createWorkspaceMembersRouter())

export type WebApiType = typeof webRpcApp
