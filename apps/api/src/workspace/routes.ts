import { zValidator } from "@hono/zod-validator"
import {
  authenticateWorkspaceSessionRequest,
  isWorkspaceSessionAuthError,
  jsonNoStore,
} from "@otto/auth"
import {
  handleWorkspaceBootstrapRequest,
  handleWorkspaceSettingsUpdateRequest,
  handleWorkspaceUsageRequest,
  type WorkspaceShellUser,
  type WorkspaceSummary,
  type WorkspaceUsageOverview,
  workspaceSettingsUpdateSchema,
} from "@otto/feature-workspace-core"
import { Hono } from "hono"
import { z } from "zod"
import { createWorkspaceChatRouter } from "./chat-routes"
import {
  getDashboardOrganizations,
  getOrganizationTenantForBilling,
  getOrganizationWorkspaceBySlug,
  getTenantProviderUsageOverview,
  getWorkspaceSummaryBySlugForUser,
  hasPlatformAdminRole,
  renameOrganization,
  syncUserFromSession,
  updateOrganizationSlug,
  updateWorkspaceDateTimePreferences,
} from "./data"

const workspaceParamsSchema = z.object({
  orgSlug: z.string().min(1),
})

const workspaceUsageQuerySchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
})

export type WorkspaceRouteDependencies = {
  authenticateWorkspaceUser: (request: Request) => Promise<WorkspaceShellUser>
  getCurrentWorkspace: (payload: {
    orgSlug: string
    userExternalId: string
  }) => Promise<WorkspaceSummary | null>
  getDashboardOrganizations: (
    userExternalId: string,
  ) => Promise<WorkspaceSummary[]>
  getOrganizationTenantForBilling: (
    organizationId: string,
  ) => Promise<{ id: string } | null>
  getOrganizationWorkspaceBySlug: (payload: {
    orgSlug: string
    userExternalId: string
  }) => Promise<{ externalId: string; id: string }>
  getTenantProviderUsageOverview: (payload: {
    from: Date
    tenantId: string
    to: Date
  }) => Promise<WorkspaceUsageOverview>
  hasPlatformAdminRole: (userExternalId: string) => Promise<boolean>
  renameOrganization: (payload: {
    externalOrganizationId: string
    name: string
    organizationId: string
  }) => Promise<void>
  syncUserFromSession: (user: WorkspaceShellUser) => Promise<unknown>
  updateOrganizationSlug: (payload: {
    organizationId: string
    slug: string
  }) => Promise<"ok" | "slug_taken">
  updateWorkspaceDateTimePreferences: (payload: {
    organizationId: string
    locale?: string
    timeFormatPreference?: string
    timezone?: string
  }) => Promise<{
    applyQueued: boolean
    locale: string
    timeFormatPreference: string
    timezone: string
  }>
}

function createDefaultWorkspaceRouteDependencies(): WorkspaceRouteDependencies {
  return {
    authenticateWorkspaceUser: (request) =>
      authenticateWorkspaceSessionRequest({ request }),
    getCurrentWorkspace: getWorkspaceSummaryBySlugForUser,
    getDashboardOrganizations,
    getOrganizationTenantForBilling,
    getOrganizationWorkspaceBySlug,
    getTenantProviderUsageOverview:
      getTenantProviderUsageOverview as WorkspaceRouteDependencies["getTenantProviderUsageOverview"],
    hasPlatformAdminRole,
    renameOrganization,
    syncUserFromSession:
      syncUserFromSession as WorkspaceRouteDependencies["syncUserFromSession"],
    updateOrganizationSlug,
    updateWorkspaceDateTimePreferences,
  }
}

export function registerWorkspaceRoutes(
  app: Hono,
  dependencies: WorkspaceRouteDependencies = createDefaultWorkspaceRouteDependencies(),
) {
  return app.route("/", createWorkspaceRouter(dependencies))
}

export function createWorkspaceRouter(
  dependencies: WorkspaceRouteDependencies = createDefaultWorkspaceRouteDependencies(),
) {
  async function authenticateUser(request: Request) {
    try {
      return {
        user: await dependencies.authenticateWorkspaceUser(request),
      } as const
    } catch (error) {
      if (isWorkspaceSessionAuthError(error)) {
        return {
          response: jsonNoStore(
            {
              code: error.code,
              message: error.message,
            },
            error.status,
          ),
        } as const
      }

      throw error
    }
  }

  const app = new Hono()

  return app
    .route("/", createWorkspaceChatRouter())
    .get(
    "/api/web/bootstrap/:orgSlug",
    zValidator("param", workspaceParamsSchema),
    async (context) => {
      const authResult = await authenticateUser(context.req.raw)

      if ("response" in authResult) {
        return authResult.response
      }

      return handleWorkspaceBootstrapRequest({
        getCurrentWorkspace: dependencies.getCurrentWorkspace,
        getDashboardOrganizations: dependencies.getDashboardOrganizations,
        hasPlatformAdminRole: dependencies.hasPlatformAdminRole,
        onBootstrapFailure: (payload) => {
          console.error("[workspace-bootstrap] failed", payload)
        },
        orgSlug: context.req.valid("param").orgSlug,
        syncUserFromSession: dependencies.syncUserFromSession,
        user: authResult.user,
      })
    },
  )
    .get(
    "/api/workspace/:orgSlug/usage",
    zValidator("param", workspaceParamsSchema),
    zValidator("query", workspaceUsageQuerySchema),
    async (context) => {
      const authResult = await authenticateUser(context.req.raw)

      if ("response" in authResult) {
        return authResult.response
      }

      const search = context.req.valid("query")

      return handleWorkspaceUsageRequest({
        from: new Date(search.from),
        getOrganizationTenantForBilling:
          dependencies.getOrganizationTenantForBilling,
        getOrganizationWorkspaceBySlug:
          dependencies.getOrganizationWorkspaceBySlug,
        getTenantProviderUsageOverview:
          dependencies.getTenantProviderUsageOverview,
        orgSlug: context.req.valid("param").orgSlug,
        syncUserFromSession: dependencies.syncUserFromSession,
        to: new Date(search.to),
        user: authResult.user,
      })
    },
  )
    .post(
    "/api/workspace/:orgSlug/settings",
    zValidator("param", workspaceParamsSchema),
    zValidator("json", workspaceSettingsUpdateSchema),
    async (context) => {
      const authResult = await authenticateUser(context.req.raw)

      if ("response" in authResult) {
        return authResult.response
      }

      return handleWorkspaceSettingsUpdateRequest({
        body: context.req.valid("json"),
        getOrganizationWorkspaceBySlug:
          dependencies.getOrganizationWorkspaceBySlug,
        orgSlug: context.req.valid("param").orgSlug,
        renameOrganization: dependencies.renameOrganization,
        syncUserFromSession: dependencies.syncUserFromSession,
        updateOrganizationSlug: dependencies.updateOrganizationSlug,
        updateWorkspaceDateTimePreferences:
          dependencies.updateWorkspaceDateTimePreferences,
        user: authResult.user,
      })
    },
  )
}
