import { zValidator } from "@hono/zod-validator"
import {
  authenticateWorkspaceSessionRequest,
  isWorkspaceSessionAuthError,
  jsonNoStore,
} from "@otto/auth"
import { Hono } from "hono"
import { z } from "zod"

import {
  getConnectedAccounts,
  getUserProfile,
  updateUserProfile,
} from "./data"

const orgSlugParamsSchema = z.object({
  orgSlug: z.string().min(1),
})

const updateUserProfileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim(),
})

const connectedAccountSchema = z.object({
  avatarUrl: z.string().nullable(),
  displayName: z.string().nullable(),
  externalId: z.string(),
  fullName: z.string().nullable(),
  id: z.string(),
  provider: z.string(),
  username: z.string().nullable(),
})

const connectedAccountsResponseSchema = z.object({
  connectedAccounts: z.array(connectedAccountSchema),
})

const userProfileResponseSchema = z.object({
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  name: z.string(),
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
        userProfileResponseSchema.parse({
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
          userProfileResponseSchema.parse({
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
