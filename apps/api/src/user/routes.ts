import { zValidator } from "@hono/zod-validator"
import {
  authenticateWorkspaceSessionRequest,
  isWorkspaceSessionAuthError,
  jsonNoStore,
} from "@otto/auth"
import {
  connectedAccountsResponseSchema,
  updateUserProfileSchema,
  userProfileSchema,
  userWorkspacesResponseSchema,
} from "@otto/feature-user-profile"
import { Hono } from "hono"
import { z } from "zod"

import { getConnectedAccounts, getUserProfile, updateUserProfile } from "./data"
import { getDashboardOrganizations } from "../workspace/data"

const orgSlugParamsSchema = z.object({
  orgSlug: z.string().min(1),
})

export type UserRouteDependencies = {
  authenticateWorkspaceUser?: (request: Request) => Promise<{
    email: string
    firstName?: string | null
    id: string
    lastName?: string | null
  }>
  getConnectedAccounts: (payload: {
    orgSlug: string
    userExternalId: string
  }) => Promise<
    Array<{
      avatarUrl: string | null
      displayName: string | null
      externalId: string
      fullName: string | null
      id: string
      provider: string
      username: string | null
    }>
  >
  getUserProfile: (userExternalId: string) => Promise<{
    email: string
    firstName: string
    lastName: string
  }>
  getDashboardOrganizations?: (userExternalId: string) => Promise<
    Array<{
      id: string
      isReady: boolean
      name: string
      slug: string
    }>
  >
  updateUserProfile: (payload: {
    firstName: string
    lastName: string
    userExternalId: string
  }) => Promise<{
    email: string
    firstName: string
    lastName: string
  }>
}

function createDefaultUserRouteDependencies(): UserRouteDependencies {
  return {
    authenticateWorkspaceUser: (request) =>
      authenticateWorkspaceSessionRequest({ request }),
    getConnectedAccounts,
    getDashboardOrganizations,
    getUserProfile,
    updateUserProfile,
  }
}

export function registerUserRoutes(
  app: Hono,
  dependencies: UserRouteDependencies = createDefaultUserRouteDependencies(),
) {
  return app.route("/", createUserRouter(dependencies))
}

export function createUserRouter(
  dependencies: UserRouteDependencies = createDefaultUserRouteDependencies(),
) {
  async function authenticateUser(request: Request) {
    try {
      return {
        user: await (dependencies.authenticateWorkspaceUser
          ? dependencies.authenticateWorkspaceUser(request)
          : authenticateWorkspaceSessionRequest({ request })),
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
    .get("/api/user/profile", async (context) => {
      const authResult = await authenticateUser(context.req.raw)

      if ("response" in authResult) {
        return authResult.response
      }

      const profile = await dependencies.getUserProfile(authResult.user.id)

      return context.json(
        userProfileSchema.parse({
          ...profile,
          name:
            [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
            profile.email,
        }),
        200,
        {
          "Cache-Control": "no-store",
        },
      )
    })
    .get("/api/user/workspaces", async (context) => {
      const authResult = await authenticateUser(context.req.raw)

      if ("response" in authResult) {
        return authResult.response
      }

      const [profile, workspaces] = await Promise.all([
        dependencies.getUserProfile(authResult.user.id),
        (dependencies.getDashboardOrganizations ?? getDashboardOrganizations)(
          authResult.user.id,
        ),
      ])

      return context.json(
        userWorkspacesResponseSchema.parse({
          user: {
            email: profile.email,
            id: authResult.user.id,
            name:
              [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
              profile.email,
          },
          workspaces: workspaces.map((workspace) => ({
            id: workspace.id,
            isReady: workspace.isReady,
            name: workspace.name,
            slug: workspace.slug,
          })),
        }),
        200,
        {
          "Cache-Control": "no-store",
        },
      )
    })
    .post(
      "/api/user/profile",
      zValidator("json", updateUserProfileSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const body = context.req.valid("json")
        const profile = await dependencies.updateUserProfile({
          ...body,
          userExternalId: authResult.user.id,
        })

        return context.json(
          userProfileSchema.parse({
            ...profile,
            name:
              [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
              profile.email,
          }),
          200,
          {
            "Cache-Control": "no-store",
          },
        )
      },
    )
    .get(
      "/api/workspace/:orgSlug/connected-accounts",
      zValidator("param", orgSlugParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const { orgSlug } = context.req.valid("param")
        const connectedAccounts = await dependencies.getConnectedAccounts({
          orgSlug,
          userExternalId: authResult.user.id,
        })

        return context.json(
          connectedAccountsResponseSchema.parse({
            connectedAccounts,
          }),
          200,
          {
            "Cache-Control": "no-store",
          },
        )
      },
    )
}
