import {
  clearWorkspaceSessionCookie as clearWorkspaceSessionCookieHeader,
  createWorkspaceSessionCookie,
  getRequestCookieValue,
  getWorkspaceSessionCookieConfig,
  readAuthFlowState as readAuthFlowStateFromPackage,
  sealAuthFlowState as sealAuthFlowStateWithPackage,
} from "@otto/auth"
import type { Hono } from "hono"

import { getApiEnv, hasWorkOsConfig } from "./env"
import { getPostAuthRedirectPathForWorkspaceOnboarding } from "./onboarding/data"

type ScreenHint = "sign-in" | "sign-up"

type AuthRouteConfig = {
  cookieName?: string
  cookiePassword: string
  enabled: boolean
  publicBaseUrl: string
  redirectUri?: string
}

type AuthRouteDependencies = {
  buildAuthorizationUrl: (input: {
    redirectUri: string
    sealedState: string
    screenHint: ScreenHint
  }) => Promise<string> | string
  clearWorkspaceSessionCookie: (input: {
    cookieName?: string
    publicBaseUrl: string
  }) => string
  exchangeCodeForSession: (input: {
    code: string
    cookiePassword: string
  }) => Promise<{
    sealedSession: string
    user: {
      email: string
      id: string
    }
  }>
  getConfig: () => AuthRouteConfig
  getLogoutUrlFromSessionCookie: (input: {
    cookiePassword: string
    returnTo: string
    sessionData: string
  }) => Promise<string> | string
  getPostAuthRedirectPath: (input: {
    defaultReturnTo: string
    intakeSessionId: string | null
    user: {
      email: string
      id: string
    }
  }) => Promise<string> | string
  readAuthFlowState: (input: {
    password: string
    sealedState: string
    ttlSeconds?: number
  }) => Promise<{
    returnTo: string
  }>
  sealAuthFlowState: (input: {
    password: string
    payload: {
      returnTo: string
    }
    ttlSeconds?: number
  }) => Promise<string>
  setWorkspaceSessionCookie: (input: {
    cookieName?: string
    publicBaseUrl: string
    sealedSession: string
  }) => string
}

const AUTH_STATE_TTL_SECONDS = 60 * 10
const DEFAULT_RETURN_TO = "/app"

function getDefaultAuthRouteDependencies(): AuthRouteDependencies {
  const env = getApiEnv()

  return {
    buildAuthorizationUrl: async ({ redirectUri, sealedState, screenHint }) => {
      const { WorkOS } = await import("@workos-inc/node")
      const workos = new WorkOS(env.WORKOS_API_KEY ?? "", {
        clientId: env.WORKOS_CLIENT_ID,
      })

      return workos.userManagement.getAuthorizationUrl({
        clientId: env.WORKOS_CLIENT_ID ?? "",
        provider: "authkit",
        redirectUri,
        screenHint,
        state: sealedState,
      })
    },
    clearWorkspaceSessionCookie: clearWorkspaceSessionCookieHeader,
    exchangeCodeForSession: async ({ code, cookiePassword }) => {
      const { WorkOS } = await import("@workos-inc/node")
      const workos = new WorkOS(env.WORKOS_API_KEY ?? "", {
        clientId: env.WORKOS_CLIENT_ID,
      })
      const response = await workos.userManagement.authenticateWithCode({
        clientId: env.WORKOS_CLIENT_ID ?? "",
        code,
        session: {
          cookiePassword,
          sealSession: true,
        },
      })

      if (!response.sealedSession) {
        throw new Error("WorkOS did not return a sealed session")
      }

      return {
        sealedSession: response.sealedSession,
        user: {
          email: response.user.email,
          id: response.user.id,
        },
      }
    },
    getConfig: () => ({
      cookieName: env.WORKOS_COOKIE_NAME,
      cookiePassword: env.WORKOS_COOKIE_PASSWORD ?? "",
      enabled: hasWorkOsConfig(env),
      publicBaseUrl: env.PUBLIC_APP_BASE_URL,
      redirectUri: env.WORKOS_REDIRECT_URI,
    }),
    getLogoutUrlFromSessionCookie: async ({
      cookiePassword,
      returnTo,
      sessionData,
    }) => {
      const { WorkOS } = await import("@workos-inc/node")
      const workos = new WorkOS(env.WORKOS_API_KEY ?? "", {
        clientId: env.WORKOS_CLIENT_ID,
      })
      const session = workos.userManagement.loadSealedSession({
        cookiePassword,
        sessionData,
      })

      return session.getLogoutUrl({
        returnTo,
      })
    },
    getPostAuthRedirectPath: getPostAuthRedirectPathForWorkspaceOnboarding,
    readAuthFlowState: readAuthFlowStateFromPackage,
    sealAuthFlowState: sealAuthFlowStateWithPackage,
    setWorkspaceSessionCookie: createWorkspaceSessionCookie,
  }
}

function normalizeReturnTo(
  returnTo: string | null | undefined,
  baseUrl: string,
) {
  if (!returnTo) {
    return DEFAULT_RETURN_TO
  }

  try {
    const base = new URL(baseUrl)
    const target = new URL(returnTo, base)

    if (target.origin !== base.origin) {
      return DEFAULT_RETURN_TO
    }

    return (
      `${target.pathname}${target.search}${target.hash}` || DEFAULT_RETURN_TO
    )
  } catch {
    return DEFAULT_RETURN_TO
  }
}

function buildAbsoluteUrl(pathname: string, baseUrl: string) {
  return new URL(pathname, baseUrl).toString()
}

function getIntakeSessionIdFromReturnTo(
  returnTo: string,
  baseUrl: string,
): string | null {
  try {
    const url = new URL(returnTo, baseUrl)
    const intakeSessionId = url.searchParams.get("intake")?.trim()

    return intakeSessionId && intakeSessionId.length > 0
      ? intakeSessionId
      : null
  } catch {
    return null
  }
}

function redirectWithCookie(location: string, setCookieHeader?: string) {
  const response = new Response(null, {
    headers: {
      Location: location,
    },
    status: 302,
  })

  if (setCookieHeader) {
    response.headers.append("Set-Cookie", setCookieHeader)
  }

  return response
}

async function buildAuthorizationRedirect(
  dependencies: AuthRouteDependencies,
  screenHint: ScreenHint,
  returnTo: string | null | undefined,
) {
  const config = dependencies.getConfig()

  if (!config.enabled) {
    return Response.redirect(buildAbsoluteUrl("/", config.publicBaseUrl), 302)
  }

  const normalizedReturnTo = normalizeReturnTo(returnTo, config.publicBaseUrl)
  const sealedState = await dependencies.sealAuthFlowState({
    password: config.cookiePassword,
    payload: {
      returnTo: normalizedReturnTo,
    },
    ttlSeconds: AUTH_STATE_TTL_SECONDS,
  })
  const location = await dependencies.buildAuthorizationUrl({
    redirectUri:
      config.redirectUri ??
      buildAbsoluteUrl("/auth/callback", config.publicBaseUrl),
    screenHint,
    sealedState,
  })

  return Response.redirect(location, 302)
}

export function registerAuthRoutes(
  app: Hono,
  dependencies: AuthRouteDependencies = getDefaultAuthRouteDependencies(),
) {
  app.get("/auth/sign-in", async (context) => {
    return buildAuthorizationRedirect(
      dependencies,
      "sign-in",
      context.req.query("returnTo"),
    )
  })

  app.get("/auth/sign-up", async () => {
    const config = dependencies.getConfig()

    return Response.redirect(
      buildAbsoluteUrl("/waitlist", config.publicBaseUrl),
      302,
    )
  })

  app.get("/auth/callback", async (context) => {
    const config = dependencies.getConfig()

    if (!config.enabled) {
      return Response.json(
        {
          error: "WorkOS is not configured.",
        },
        {
          status: 500,
        },
      )
    }

    const code = context.req.query("code")

    if (!code) {
      return Response.json(
        {
          error: "Missing code",
        },
        {
          status: 400,
        },
      )
    }

    let returnTo = DEFAULT_RETURN_TO
    const state = context.req.query("state")

    if (state) {
      try {
        const payload = await dependencies.readAuthFlowState({
          password: config.cookiePassword,
          sealedState: state,
          ttlSeconds: AUTH_STATE_TTL_SECONDS,
        })
        returnTo = normalizeReturnTo(payload.returnTo, config.publicBaseUrl)
      } catch {
        returnTo = DEFAULT_RETURN_TO
      }
    }

    try {
      const session = await dependencies.exchangeCodeForSession({
        code,
        cookiePassword: config.cookiePassword,
      })
      const redirectPath = normalizeReturnTo(
        await dependencies.getPostAuthRedirectPath({
          defaultReturnTo: returnTo,
          intakeSessionId: getIntakeSessionIdFromReturnTo(
            returnTo,
            config.publicBaseUrl,
          ),
          user: session.user,
        }),
        config.publicBaseUrl,
      )

      return redirectWithCookie(
        buildAbsoluteUrl(redirectPath, config.publicBaseUrl),
        dependencies.setWorkspaceSessionCookie({
          cookieName: config.cookieName,
          publicBaseUrl: config.publicBaseUrl,
          sealedSession: session.sealedSession,
        }),
      )
    } catch {
      return Response.redirect(
        buildAbsoluteUrl("/login", config.publicBaseUrl),
        302,
      )
    }
  })

  app.get("/auth/sign-out", async (context) => {
    const config = dependencies.getConfig()
    const returnTo = buildAbsoluteUrl("/login", config.publicBaseUrl)
    const { cookieName } = getWorkspaceSessionCookieConfig({
      cookieName: config.cookieName,
      cookiePassword: config.cookiePassword || "x".repeat(32),
    })
    const sessionData = getRequestCookieValue(context.req.raw, cookieName)
    let logoutUrl = returnTo

    if (config.enabled && sessionData) {
      try {
        logoutUrl = await dependencies.getLogoutUrlFromSessionCookie({
          cookiePassword: config.cookiePassword,
          returnTo,
          sessionData,
        })
      } catch {
        logoutUrl = returnTo
      }
    }

    return redirectWithCookie(
      logoutUrl,
      dependencies.clearWorkspaceSessionCookie({
        cookieName: config.cookieName,
        publicBaseUrl: config.publicBaseUrl,
      }),
    )
  })
}
