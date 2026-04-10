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
} from "@otto/feature-workspace-core"
import type { Hono } from "hono"
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
} from "../workspace/data"

export type WorkspaceCoreRouteDependencies = {
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

function createDefaultWorkspaceCoreDependencies(): WorkspaceCoreRouteDependencies {
  return {
    authenticateWorkspaceUser: (request) =>
      authenticateWorkspaceSessionRequest({ request }),
    getCurrentWorkspace: getWorkspaceSummaryBySlugForUser,
    getDashboardOrganizations,
    getOrganizationTenantForBilling,
    getOrganizationWorkspaceBySlug,
    getTenantProviderUsageOverview:
      getTenantProviderUsageOverview as WorkspaceCoreRouteDependencies["getTenantProviderUsageOverview"],
    hasPlatformAdminRole,
    renameOrganization,
    syncUserFromSession:
      syncUserFromSession as WorkspaceCoreRouteDependencies["syncUserFromSession"],
    updateOrganizationSlug,
    updateWorkspaceDateTimePreferences,
  }
}

export function registerWorkspaceCoreRoutes(
  app: Hono,
  dependencies: WorkspaceCoreRouteDependencies = createDefaultWorkspaceCoreDependencies(),
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

  app.get("/api/web/bootstrap/:orgSlug", async (context) => {
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
      orgSlug: context.req.param("orgSlug"),
      syncUserFromSession: dependencies.syncUserFromSession,
      user: authResult.user,
    })
  })

  app.get("/api/workspace/:orgSlug/usage", async (context) => {
    const authResult = await authenticateUser(context.req.raw)

    if ("response" in authResult) {
      return authResult.response
    }

    return handleWorkspaceUsageRequest({
      getOrganizationTenantForBilling:
        dependencies.getOrganizationTenantForBilling,
      getOrganizationWorkspaceBySlug:
        dependencies.getOrganizationWorkspaceBySlug,
      getTenantProviderUsageOverview:
        dependencies.getTenantProviderUsageOverview,
      orgSlug: context.req.param("orgSlug"),
      request: context.req.raw,
      syncUserFromSession: dependencies.syncUserFromSession,
      user: authResult.user,
    })
  })

  app.post("/api/workspace/:orgSlug/settings", async (context) => {
    const authResult = await authenticateUser(context.req.raw)

    if ("response" in authResult) {
      return authResult.response
    }

    return handleWorkspaceSettingsUpdateRequest({
      getOrganizationWorkspaceBySlug:
        dependencies.getOrganizationWorkspaceBySlug,
      orgSlug: context.req.param("orgSlug"),
      renameOrganization: dependencies.renameOrganization,
      request: context.req.raw,
      syncUserFromSession: dependencies.syncUserFromSession,
      updateOrganizationSlug: dependencies.updateOrganizationSlug,
      updateWorkspaceDateTimePreferences:
        dependencies.updateWorkspaceDateTimePreferences,
      user: authResult.user,
    })
  })
}
