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

const billingModulePath = "../../../../web/src/db/billing"
const controlPlaneModulePath = "../../../../web/src/db/control-plane"
const dbClientModulePath = "../../../../web/src/db/client"
const schemaModulePath = "../../../../web/src/db/schema"
const workosModulePath = "../../../../web/src/lib/workos"

type UpdateQuery = {
  where: (clause: unknown) => Promise<unknown>
}

type DbLike = {
  select: (fields: Record<string, unknown>) => {
    from: (table: unknown) => {
      where: (clause: unknown) => {
        limit: (count: number) => Promise<Array<{ id: string }>>
      }
    }
  }
  update: (table: unknown) => {
    set: (values: Record<string, unknown>) => UpdateQuery
  }
}

type DbClientModule = {
  getDb: () => DbLike
}

export type WorkspaceCoreRouteDependencies = {
  authenticateWorkspaceUser: (request: Request) => Promise<WorkspaceShellUser>
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
    getDashboardOrganizations: async (userExternalId) => {
      const controlPlaneModule = (await import(controlPlaneModulePath)) as {
        getDashboardOrganizations: (
          userExternalId: string,
        ) => Promise<WorkspaceSummary[]>
      }

      return controlPlaneModule.getDashboardOrganizations(userExternalId)
    },
    getOrganizationTenantForBilling: async (organizationId) => {
      const billingModule = (await import(billingModulePath)) as {
        getOrganizationTenantForBilling: (
          organizationId: string,
        ) => Promise<{ id: string } | null>
      }

      return billingModule.getOrganizationTenantForBilling(organizationId)
    },
    getOrganizationWorkspaceBySlug: async (payload) => {
      const controlPlaneModule = (await import(controlPlaneModulePath)) as {
        getOrganizationWorkspaceBySlug: (payload: {
          orgSlug: string
          userExternalId: string
        }) => Promise<{ externalId: string; id: string }>
      }

      return controlPlaneModule.getOrganizationWorkspaceBySlug(payload)
    },
    getTenantProviderUsageOverview: async (payload) => {
      const providerUsageModule = (await import(
        "../../../../web/src/db/provider-usage"
      )) as {
        getTenantProviderUsageOverview: (payload: {
          from: Date
          tenantId: string
          to: Date
        }) => Promise<WorkspaceUsageOverview>
      }

      return providerUsageModule.getTenantProviderUsageOverview(payload)
    },
    hasPlatformAdminRole: async (userExternalId) => {
      const controlPlaneModule = (await import(controlPlaneModulePath)) as {
        hasPlatformAdminRole: (userExternalId: string) => Promise<boolean>
      }

      return controlPlaneModule.hasPlatformAdminRole(userExternalId)
    },
    renameOrganization: async (payload) => {
      const [dbClientModule, drizzleOrmModule, schemaModule, workosModule] =
        await Promise.all([
          import(dbClientModulePath),
          import("drizzle-orm"),
          import(schemaModulePath),
          import(workosModulePath),
        ])
      const db = (dbClientModule as DbClientModule).getDb()
      const { eq } = drizzleOrmModule as typeof import("drizzle-orm")
      const schema = schemaModule as {
        organizations: {
          id: unknown
        }
      }
      const workos = (
        workosModule as {
          getWorkOS: () => {
            organizations: {
              updateOrganization: (payload: {
                name: string
                organization: string
              }) => Promise<unknown>
            }
          }
        }
      ).getWorkOS()

      await workos.organizations.updateOrganization({
        name: payload.name,
        organization: payload.externalOrganizationId,
      })

      await db
        .update(schema.organizations)
        .set({
          name: payload.name,
          updatedAt: new Date(),
        })
        .where(eq(schema.organizations.id as never, payload.organizationId))
    },
    syncUserFromSession: async (user) => {
      const controlPlaneModule = (await import(controlPlaneModulePath)) as {
        syncUserFromSession: (user: WorkspaceShellUser) => Promise<unknown>
      }

      return controlPlaneModule.syncUserFromSession(user)
    },
    updateOrganizationSlug: async (payload) => {
      const [dbClientModule, drizzleOrmModule, schemaModule] =
        await Promise.all([
          import(dbClientModulePath),
          import("drizzle-orm"),
          import(schemaModulePath),
        ])
      const db = (dbClientModule as DbClientModule).getDb()
      const { eq } = drizzleOrmModule as typeof import("drizzle-orm")
      const schema = schemaModule as {
        organizations: {
          id: unknown
          slug: unknown
        }
      }

      const [existing] = await db
        .select({ id: schema.organizations.id })
        .from(schema.organizations)
        .where(eq(schema.organizations.slug as never, payload.slug))
        .limit(1)

      if (existing && existing.id !== payload.organizationId) {
        return "slug_taken"
      }

      await db
        .update(schema.organizations)
        .set({
          slug: payload.slug,
          updatedAt: new Date(),
        })
        .where(eq(schema.organizations.id as never, payload.organizationId))

      return "ok"
    },
    updateWorkspaceDateTimePreferences: async (payload) => {
      const controlPlaneModule = (await import(controlPlaneModulePath)) as {
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

      return controlPlaneModule.updateWorkspaceDateTimePreferences(payload)
    },
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

  app.get("/api/frontend/bootstrap/:orgSlug", async (context) => {
    const authResult = await authenticateUser(context.req.raw)

    if ("response" in authResult) {
      return authResult.response
    }

    return handleWorkspaceBootstrapRequest({
      getDashboardOrganizations: dependencies.getDashboardOrganizations,
      hasPlatformAdminRole: dependencies.hasPlatformAdminRole,
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
