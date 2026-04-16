import { zValidator } from "@hono/zod-validator"
import {
  platformAddCurrentUserAdminResponseSchema,
  platformBakeOnboardingSnapshotResponseSchema,
  platformActionResponseSchema,
  platformBootstrapSchema,
  platformCreateOrganizationResponseSchema,
  platformCreateOrganizationSchema,
  platformDeleteWorkspaceResponseSchema,
  platformGrantCreditsResponseSchema,
  platformGrantCreditsSchema,
  platformJobStatusResponseSchema,
  platformOrganizationDetailResponseSchema,
  platformOrganizationsResponseSchema,
  platformProvisionServerResponseSchema,
  platformProvisionServerSchema,
  platformProvisionOpenAiKeyResponseSchema,
  platformSnapshotsResponseSchema,
  platformUsageQuerySchema,
  platformUsageSchema,
} from "@otto/feature-platform"
import type { WorkspaceShellUser } from "@otto/feature-workspace-core"
import { Hono } from "hono"
import { z } from "zod"

import {
  getDashboardOrganizations as getWorkspaceDashboardOrganizations,
  hasPlatformAdminRole as hasWorkspacePlatformAdminRole,
  syncUserFromSession,
  type WorkspaceSummary,
} from "../workspace/data"
import { authenticatePlatformRequest, type PlatformGuardDependencies } from "./guard"
import {
  addCurrentUserAsPlatformOrganizationAdmin,
  createPlatformOrganization,
  getPlatformJobStatus,
  getPlatformOrganizationDetail,
  getPlatformOrganizations,
  getPlatformSnapshots,
  getPlatformUsage,
  getTenantRuntimeGatewayToken,
  grantPlatformOrganizationCredits,
  triggerPlatformOrganizationApply,
  triggerPlatformOrganizationProvisionServer,
  triggerPlatformOrganizationDeleteWorkspace,
  triggerPlatformOrganizationDeployRuntime,
  triggerPlatformOrganizationProvisionOpenAiKey,
  triggerPlatformOrganizationRefreshImage,
  triggerPlatformOrganizationSyncSkills,
  triggerPlatformSnapshotBake,
} from "./data"

const workspaceParamsSchema = z.object({
  orgSlug: z.string().min(1),
})

const workspaceJobParamsSchema = workspaceParamsSchema.extend({
  jobId: z.string().min(1),
})

export interface PlatformRouteDependencies extends PlatformGuardDependencies {
  getJobStatus: (input: {
    jobId: string
    orgSlug: string
    user: WorkspaceShellUser
  }) => Promise<unknown>
  getPlatformOrganizationDetail: (input: {
    orgSlug: string
    user: WorkspaceShellUser
  }) => Promise<unknown>
  getPlatformOrganizations: (input: {
    user: WorkspaceShellUser
  }) => Promise<unknown>
  createPlatformOrganization: (input: {
    name: string
    slug?: string
    user: WorkspaceShellUser
  }) => Promise<unknown>
  addCurrentUserAsPlatformOrganizationAdmin: (input: {
    orgSlug: string
    user: WorkspaceShellUser
  }) => Promise<unknown>
  getPlatformSnapshots: (input: {
    user: WorkspaceShellUser
  }) => Promise<unknown>
  getPlatformUsage: (input: {
    from: Date
    orgSlug: string
    to: Date
    user: WorkspaceShellUser
  }) => Promise<unknown>
  getTenantRuntimeGatewayToken: (tenantId: string) => Promise<string | null>
  grantPlatformOrganizationCredits: (input: {
    credits: number
    note: string
    orgSlug: string
    user: WorkspaceShellUser
  }) => Promise<unknown>
  hasPlatformAdminRole: (userExternalId: string) => Promise<boolean>
  syncUserFromSession: (user: WorkspaceShellUser) => Promise<unknown>
  triggerPlatformOrganizationApply: (input: {
    orgSlug: string
    user: WorkspaceShellUser
  }) => Promise<unknown>
  triggerPlatformOrganizationSyncSkills: (input: {
    orgSlug: string
    user: WorkspaceShellUser
  }) => Promise<unknown>
  triggerPlatformSnapshotBake: (input: {
    user: WorkspaceShellUser
  }) => Promise<unknown>
  triggerPlatformOrganizationProvisionServer: (input: {
    orgSlug: string
    provisioningStrategy: "legacy_base_image" | "hetzner_snapshot"
    user: WorkspaceShellUser
  }) => Promise<unknown>
  triggerPlatformOrganizationDeleteWorkspace: (input: {
    orgSlug: string
    user: WorkspaceShellUser
  }) => Promise<unknown>
  triggerPlatformOrganizationDeployRuntime: (input: {
    orgSlug: string
    user: WorkspaceShellUser
  }) => Promise<unknown>
  triggerPlatformOrganizationProvisionOpenAiKey: (input: {
    orgSlug: string
    user: WorkspaceShellUser
  }) => Promise<unknown>
  triggerPlatformOrganizationRefreshImage: (input: {
    orgSlug: string
    user: WorkspaceShellUser
  }) => Promise<unknown>
  getDashboardOrganizations: (userExternalId: string) => Promise<WorkspaceSummary[]>
}

function createDefaultPlatformRouteDependencies(): PlatformRouteDependencies {
  return {
    getDashboardOrganizations: getWorkspaceDashboardOrganizations,
    getJobStatus: ({ jobId, orgSlug, user }) =>
      getPlatformJobStatus({
        jobId,
        orgSlug,
        userExternalId: user.id,
      }),
    getPlatformOrganizationDetail: ({ orgSlug, user }) =>
      getPlatformOrganizationDetail({
        orgSlug,
        userExternalId: user.id,
      }),
    getPlatformOrganizations: ({ user }) =>
      getPlatformOrganizations({
        userExternalId: user.id,
      }),
    createPlatformOrganization: ({ name, slug, user }) =>
      createPlatformOrganization({
        name,
        slug,
        userExternalId: user.id,
      }),
    addCurrentUserAsPlatformOrganizationAdmin: ({ orgSlug, user }) =>
      addCurrentUserAsPlatformOrganizationAdmin({
        orgSlug,
        userExternalId: user.id,
      }),
    getPlatformSnapshots: ({ user }) =>
      getPlatformSnapshots({
        userExternalId: user.id,
      }),
    getPlatformUsage: ({ from, orgSlug, to, user }) =>
      getPlatformUsage({
        from,
        orgSlug,
        to,
        userExternalId: user.id,
      }),
    getTenantRuntimeGatewayToken,
    grantPlatformOrganizationCredits: ({ credits, note, orgSlug, user }) =>
      grantPlatformOrganizationCredits({
        credits,
        note,
        orgSlug,
        userExternalId: user.id,
      }),
    hasPlatformAdminRole: hasWorkspacePlatformAdminRole,
    syncUserFromSession,
    triggerPlatformOrganizationApply: ({ orgSlug, user }) =>
      triggerPlatformOrganizationApply({
        orgSlug,
        userExternalId: user.id,
      }),
    triggerPlatformOrganizationSyncSkills: ({ orgSlug, user }) =>
      triggerPlatformOrganizationSyncSkills({
        orgSlug,
        userExternalId: user.id,
      }),
    triggerPlatformSnapshotBake: ({ user }) =>
      triggerPlatformSnapshotBake({
        userExternalId: user.id,
      }),
    triggerPlatformOrganizationProvisionServer: ({
      orgSlug,
      provisioningStrategy,
      user,
    }) =>
      triggerPlatformOrganizationProvisionServer({
        orgSlug,
        provisioningStrategy,
        userExternalId: user.id,
      }),
    triggerPlatformOrganizationDeleteWorkspace: ({ orgSlug, user }) =>
      triggerPlatformOrganizationDeleteWorkspace({
        orgSlug,
        userExternalId: user.id,
      }),
    triggerPlatformOrganizationDeployRuntime: ({ orgSlug, user }) =>
      triggerPlatformOrganizationDeployRuntime({
        orgSlug,
        userExternalId: user.id,
      }),
    triggerPlatformOrganizationProvisionOpenAiKey: ({ orgSlug, user }) =>
      triggerPlatformOrganizationProvisionOpenAiKey({
        orgSlug,
        userExternalId: user.id,
      }),
    triggerPlatformOrganizationRefreshImage: ({ orgSlug, user }) =>
      triggerPlatformOrganizationRefreshImage({
        orgSlug,
        userExternalId: user.id,
      }),
  }
}

function getUserName(user: WorkspaceShellUser) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
}

function handlePlatformRouteError(error: unknown) {
  if (
    error instanceof Error &&
    (error.message === "Organization tenant not found" ||
      error.message === "Platform user not found" ||
      error.message === "Platform organization not found")
  ) {
    return {
      code: "not_found",
      message: error.message,
      status: 404,
    } as const
  }

  if (
    error instanceof Error &&
    error.message === "No desired state exists for this tenant yet."
  ) {
    return {
      code: "conflict",
      message: error.message,
      status: 409,
    } as const
  }

  if (
    error instanceof Error &&
    error.message === "Organization slug is required"
  ) {
    return {
      code: "bad_request",
      message: error.message,
      status: 400,
    } as const
  }

  if (
    error instanceof Error &&
    (error.message === "Organization already has a tenant server" ||
      error.message === "Organization slug is already in use" ||
      error.message === "Organization slug is reserved" ||
      error.message === "Workspace deletion is already queued or running")
  ) {
    return {
      code: "conflict",
      message: error.message,
      status: 409,
    } as const
  }

  return {
    code: "platform_request_failed",
    message: error instanceof Error ? error.message : "Platform request failed",
    status: 500,
  } as const
}

export function createPlatformRouter(
  dependencies: PlatformRouteDependencies = createDefaultPlatformRouteDependencies(),
) {
  const app = new Hono()

  async function authenticateUser(request: Request) {
    return authenticatePlatformRequest(
      {
        authenticatePlatformUser: dependencies.authenticatePlatformUser,
        hasPlatformAdminRole: dependencies.hasPlatformAdminRole,
        syncUserFromSession: dependencies.syncUserFromSession,
      },
      request,
    )
  }

  return app
    .get("/api/platform/bootstrap", async (context) => {
      const authResult = await authenticateUser(context.req.raw)

      if ("response" in authResult) {
        return authResult.response
      }

      const organizations = await dependencies.getDashboardOrganizations(
        authResult.user.id,
      )

      return context.json(
        platformBootstrapSchema.parse({
          organizations: organizations.map((organization) => ({
            name: organization.name,
            slug: organization.slug,
          })),
          user: {
            email: authResult.user.email,
            id: authResult.user.id,
            isPlatformAdmin: true,
            name: getUserName(authResult.user),
          },
        }),
        200,
        {
          "Cache-Control": "no-store",
        },
      )
    })
    .get("/api/platform/organizations", async (context) => {
      const authResult = await authenticateUser(context.req.raw)

      if ("response" in authResult) {
        return authResult.response
      }

      const organizations = await dependencies.getPlatformOrganizations({
        user: authResult.user,
      })

      return context.json(
        platformOrganizationsResponseSchema.parse({
          organizations,
        }),
        200,
        {
          "Cache-Control": "no-store",
        },
      )
    })
    .post(
      "/api/platform/organizations",
      zValidator("json", platformCreateOrganizationSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const payload = context.req.valid("json")

        try {
          const organization = await dependencies.createPlatformOrganization({
            name: payload.name,
            slug: payload.slug,
            user: authResult.user,
          })

          return context.json(
            platformCreateOrganizationResponseSchema.parse({
              organization,
            }),
            200,
            {
              "Cache-Control": "no-store",
            },
          )
        } catch (error) {
          const handled = handlePlatformRouteError(error)

          return context.json(
            {
              code: handled.code,
              message: handled.message,
            },
            handled.status,
            {
              "Cache-Control": "no-store",
            },
          )
        }
      },
    )
    .get("/api/platform/snapshots", async (context) => {
      const authResult = await authenticateUser(context.req.raw)

      if ("response" in authResult) {
        return authResult.response
      }

      const snapshots = await dependencies.getPlatformSnapshots({
        user: authResult.user,
      })

      return context.json(
        platformSnapshotsResponseSchema.parse({
          snapshots,
        }),
        200,
        {
          "Cache-Control": "no-store",
        },
      )
    })
    .post("/api/platform/snapshots/bake", async (context) => {
      const authResult = await authenticateUser(context.req.raw)

      if ("response" in authResult) {
        return authResult.response
      }

      try {
        const result = await dependencies.triggerPlatformSnapshotBake({
          user: authResult.user,
        })

        return context.json(
          platformBakeOnboardingSnapshotResponseSchema.parse(result),
          200,
          {
            "Cache-Control": "no-store",
          },
        )
      } catch (error) {
        const handled = handlePlatformRouteError(error)

        return context.json(
          {
            code: handled.code,
            message: handled.message,
          },
          handled.status,
          {
            "Cache-Control": "no-store",
          },
        )
      }
    })
    .get(
      "/api/platform/organizations/:orgSlug",
      zValidator("param", workspaceParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const { orgSlug } = context.req.valid("param")
        const organization = await dependencies.getPlatformOrganizationDetail({
          orgSlug,
          user: authResult.user,
        })

        if (!organization) {
          return context.json(
            {
              code: "not_found",
              message: "Platform organization not found",
            },
            404,
            {
              "Cache-Control": "no-store",
            },
          )
        }

        const tenantId =
          organization &&
          typeof organization === "object" &&
          "tenant" in organization &&
          organization.tenant &&
          typeof organization.tenant === "object" &&
          "id" in organization.tenant &&
          typeof organization.tenant.id === "string"
            ? organization.tenant.id
            : null
        const gatewayToken = tenantId
          ? await dependencies.getTenantRuntimeGatewayToken(tenantId)
          : null

        return context.json(
          platformOrganizationDetailResponseSchema.parse({
            gatewayToken,
            organization,
          }),
          200,
          {
            "Cache-Control": "no-store",
          },
        )
      },
    )
    .get(
      "/api/platform/organizations/:orgSlug/usage",
      zValidator("param", workspaceParamsSchema),
      zValidator("query", platformUsageQuerySchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const { orgSlug } = context.req.valid("param")
        const query = context.req.valid("query")
        const usage = await dependencies.getPlatformUsage({
          from: new Date(query.from),
          orgSlug,
          to: new Date(query.to),
          user: authResult.user,
        })

        if (!usage) {
          return context.json(
            {
              code: "not_found",
              message: "Platform organization usage not found",
            },
            404,
            {
              "Cache-Control": "no-store",
            },
          )
        }

        return context.json(platformUsageSchema.parse(usage), 200, {
          "Cache-Control": "no-store",
        })
      },
    )
    .post(
      "/api/platform/organizations/:orgSlug/apply",
      zValidator("param", workspaceParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const { orgSlug } = context.req.valid("param")

        try {
          const result = await dependencies.triggerPlatformOrganizationApply({
            orgSlug,
            user: authResult.user,
          })

          return context.json(platformActionResponseSchema.parse(result), 200, {
            "Cache-Control": "no-store",
          })
        } catch (error) {
          const handled = handlePlatformRouteError(error)

          return context.json(
            {
              code: handled.code,
              message: handled.message,
            },
            handled.status,
            {
              "Cache-Control": "no-store",
            },
          )
        }
      },
    )
    .post(
      "/api/platform/organizations/:orgSlug/sync-skills",
      zValidator("param", workspaceParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const { orgSlug } = context.req.valid("param")

        try {
          const result =
            await dependencies.triggerPlatformOrganizationSyncSkills({
              orgSlug,
              user: authResult.user,
            })

          return context.json(platformActionResponseSchema.parse(result), 200, {
            "Cache-Control": "no-store",
          })
        } catch (error) {
          const handled = handlePlatformRouteError(error)

          return context.json(
            {
              code: handled.code,
              message: handled.message,
            },
            handled.status,
            {
              "Cache-Control": "no-store",
            },
          )
        }
      },
    )
    .post(
      "/api/platform/organizations/:orgSlug/admin-membership",
      zValidator("param", workspaceParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const { orgSlug } = context.req.valid("param")

        try {
          const result =
            await dependencies.addCurrentUserAsPlatformOrganizationAdmin({
              orgSlug,
              user: authResult.user,
            })

          return context.json(
            platformAddCurrentUserAdminResponseSchema.parse(result),
            200,
            {
              "Cache-Control": "no-store",
            },
          )
        } catch (error) {
          const handled = handlePlatformRouteError(error)

          return context.json(
            {
              code: handled.code,
              message: handled.message,
            },
            handled.status,
            {
              "Cache-Control": "no-store",
            },
          )
        }
      },
    )
    .post(
      "/api/platform/organizations/:orgSlug/provision-server",
      zValidator("param", workspaceParamsSchema),
      zValidator("json", platformProvisionServerSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const { orgSlug } = context.req.valid("param")
        const payload = context.req.valid("json")

        try {
          const result = await dependencies.triggerPlatformOrganizationProvisionServer(
            {
              orgSlug,
              provisioningStrategy: payload.provisioningStrategy,
              user: authResult.user,
            },
          )

          return context.json(
            platformProvisionServerResponseSchema.parse(result),
            200,
            {
              "Cache-Control": "no-store",
            },
          )
        } catch (error) {
          const handled = handlePlatformRouteError(error)

          return context.json(
            {
              code: handled.code,
              message: handled.message,
            },
            handled.status,
            {
              "Cache-Control": "no-store",
            },
          )
        }
      },
    )
    .post(
      "/api/platform/organizations/:orgSlug/delete-workspace",
      zValidator("param", workspaceParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const { orgSlug } = context.req.valid("param")

        try {
          const result =
            await dependencies.triggerPlatformOrganizationDeleteWorkspace({
              orgSlug,
              user: authResult.user,
            })

          return context.json(
            platformDeleteWorkspaceResponseSchema.parse(result),
            200,
            {
              "Cache-Control": "no-store",
            },
          )
        } catch (error) {
          const handled = handlePlatformRouteError(error)

          return context.json(
            {
              code: handled.code,
              message: handled.message,
            },
            handled.status,
            {
              "Cache-Control": "no-store",
            },
          )
        }
      },
    )
    .post(
      "/api/platform/organizations/:orgSlug/deploy-runtime",
      zValidator("param", workspaceParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const { orgSlug } = context.req.valid("param")

        try {
          const result = await dependencies.triggerPlatformOrganizationDeployRuntime({
            orgSlug,
            user: authResult.user,
          })

          return context.json(platformActionResponseSchema.parse(result), 200, {
            "Cache-Control": "no-store",
          })
        } catch (error) {
          const handled = handlePlatformRouteError(error)

          return context.json(
            {
              code: handled.code,
              message: handled.message,
            },
            handled.status,
            {
              "Cache-Control": "no-store",
            },
          )
        }
      },
    )
    .post(
      "/api/platform/organizations/:orgSlug/provision-openai-key",
      zValidator("param", workspaceParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const { orgSlug } = context.req.valid("param")

        try {
          const result =
            await dependencies.triggerPlatformOrganizationProvisionOpenAiKey({
              orgSlug,
              user: authResult.user,
            })

          return context.json(
            platformProvisionOpenAiKeyResponseSchema.parse(result),
            200,
            {
              "Cache-Control": "no-store",
            },
          )
        } catch (error) {
          const handled = handlePlatformRouteError(error)

          return context.json(
            {
              code: handled.code,
              message: handled.message,
            },
            handled.status,
            {
              "Cache-Control": "no-store",
            },
          )
        }
      },
    )
    .post(
      "/api/platform/organizations/:orgSlug/refresh-image",
      zValidator("param", workspaceParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const { orgSlug } = context.req.valid("param")

        try {
          const result = await dependencies.triggerPlatformOrganizationRefreshImage({
            orgSlug,
            user: authResult.user,
          })

          return context.json(platformActionResponseSchema.parse(result), 200, {
            "Cache-Control": "no-store",
          })
        } catch (error) {
          const handled = handlePlatformRouteError(error)

          return context.json(
            {
              code: handled.code,
              message: handled.message,
            },
            handled.status,
            {
              "Cache-Control": "no-store",
            },
          )
        }
      },
    )
    .post(
      "/api/platform/organizations/:orgSlug/grant-credits",
      zValidator("param", workspaceParamsSchema),
      zValidator("json", platformGrantCreditsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const { orgSlug } = context.req.valid("param")
        const payload = context.req.valid("json")

        try {
          const result = await dependencies.grantPlatformOrganizationCredits({
            credits: payload.credits,
            note: payload.note,
            orgSlug,
            user: authResult.user,
          })

          return context.json(
            platformGrantCreditsResponseSchema.parse(result),
            200,
            {
              "Cache-Control": "no-store",
            },
          )
        } catch (error) {
          const handled = handlePlatformRouteError(error)

          return context.json(
            {
              code: handled.code,
              message: handled.message,
            },
            handled.status,
            {
              "Cache-Control": "no-store",
            },
          )
        }
      },
    )
    .get(
      "/api/platform/organizations/:orgSlug/jobs/:jobId/status",
      zValidator("param", workspaceJobParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const { jobId, orgSlug } = context.req.valid("param")
        const status = await dependencies.getJobStatus({
          jobId,
          orgSlug,
          user: authResult.user,
        })

        if (!status) {
          return context.json(
            {
              code: "not_found",
              message: "Platform job status not found",
            },
            404,
            {
              "Cache-Control": "no-store",
            },
          )
        }

        return context.json(
          platformJobStatusResponseSchema.parse(status),
          200,
          {
            "Cache-Control": "no-store",
          },
        )
      },
    )
}
