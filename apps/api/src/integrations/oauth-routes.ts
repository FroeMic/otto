import {
  authenticateWorkspaceSessionRequest,
  isWorkspaceSessionAuthError,
  jsonNoStore,
} from "@otto/auth"
import { Hono } from "hono"

import { getApiEnv } from "../env"
import {
  beginWorkspaceIntegrationOauth,
  completeWorkspaceIntegrationOauth,
} from "./oauth-data"

export interface BeginWorkspaceIntegrationOauthInput {
  orgSlug: string | null
  providerKey: string
  userExternalId: string
}

export interface CompleteWorkspaceIntegrationOauthInput {
  code: string | null
  encodedState: string | null
  providerError: string | null
  providerKey: string
  userExternalId: string
}

export interface IntegrationsOauthRouteDependencies {
  authenticateWorkspaceUser: (request: Request) => Promise<{
    email: string
    firstName?: string | null
    id: string
    lastName?: string | null
  }>
  beginWorkspaceIntegrationOauth: (
    input: BeginWorkspaceIntegrationOauthInput,
  ) => Promise<{
    authorizeUrl: string
  }>
  completeWorkspaceIntegrationOauth: (
    input: CompleteWorkspaceIntegrationOauthInput,
  ) => Promise<{
    redirectUrl: string
  }>
}

function createDefaultIntegrationsOauthRouteDependencies(): IntegrationsOauthRouteDependencies {
  const publicBaseUrl = getApiEnv().PUBLIC_APP_BASE_URL

  return {
    authenticateWorkspaceUser: (request) =>
      authenticateWorkspaceSessionRequest({ request }),
    beginWorkspaceIntegrationOauth: (input) =>
      beginWorkspaceIntegrationOauth({
        ...input,
        publicBaseUrl,
      }),
    completeWorkspaceIntegrationOauth: (input) =>
      completeWorkspaceIntegrationOauth({
        ...input,
        publicBaseUrl,
      }),
  }
}

function redirect(location: string) {
  return new Response(null, {
    headers: {
      Location: location,
    },
    status: 302,
  })
}

export function createIntegrationsOauthRouter(
  dependencies: IntegrationsOauthRouteDependencies = createDefaultIntegrationsOauthRouteDependencies(),
) {
  const app = new Hono()

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

  return app
    .get("/oauth/start/integration/:provider", async (context) => {
      const authResult = await authenticateUser(context.req.raw)

      if ("response" in authResult) {
        return authResult.response
      }

      const result = await dependencies.beginWorkspaceIntegrationOauth({
        orgSlug: context.req.query("orgSlug") ?? null,
        providerKey: context.req.param("provider"),
        userExternalId: authResult.user.id,
      })

      return redirect(result.authorizeUrl)
    })
    .get("/oauth/callback/integration/:provider", async (context) => {
      const authResult = await authenticateUser(context.req.raw)

      if ("response" in authResult) {
        return authResult.response
      }

      const result = await dependencies.completeWorkspaceIntegrationOauth({
        code: context.req.query("code") ?? null,
        encodedState: context.req.query("state") ?? null,
        providerError: context.req.query("error") ?? null,
        providerKey: context.req.param("provider"),
        userExternalId: authResult.user.id,
      })

      return redirect(result.redirectUrl)
    })
}
