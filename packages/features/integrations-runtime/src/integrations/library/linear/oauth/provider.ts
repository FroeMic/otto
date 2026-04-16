import { getLinearOAuthConfig } from "../../../../lib/env"
import type {
  OAuthConnectionIdentity,
  OAuthProviderDefinition,
  OAuthProviderErrorKind,
  OAuthTokenExchangeResult,
} from "../../../../lib/oauth/providers/types"

const LINEAR_AUTHORIZE_URL = "https://linear.app/oauth/authorize"
const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql"
const LINEAR_TOKEN_URL = "https://api.linear.app/oauth/token"

type LinearTokenResponse = {
  access_token?: string
  error?: string
  error_description?: string
  expires_in?: number | string
  id_token?: string
  refresh_token?: string
  refresh_token_expires_in?: number | string
  scope?: string
  token_type?: string
}

type LinearViewerResponse = {
  data?: {
    viewer?: {
      id?: string
      name?: string | null
    } | null
  }
  errors?: Array<{
    message?: string
  }>
}

class LinearOAuthError extends Error {
  code?: string
  kind: OAuthProviderErrorKind
  status?: number

  constructor(
    message: string,
    options?: {
      code?: string
      kind?: OAuthProviderErrorKind
      status?: number
    },
  ) {
    super(message)
    this.name = "LinearOAuthError"
    this.code = options?.code
    this.kind = options?.kind ?? "transient"
    this.status = options?.status
  }
}

export const linearOAuthProvider: OAuthProviderDefinition = {
  buildAuthorizationUrl(input) {
    const config = getLinearOAuthConfig()
    const url = new URL(LINEAR_AUTHORIZE_URL)

    url.searchParams.set("client_id", config.clientId)
    url.searchParams.set("redirect_uri", config.redirectUri)
    url.searchParams.set("response_type", "code")
    url.searchParams.set("scope", config.scopes.join(","))
    url.searchParams.set("state", input.state)

    if (config.actor === "app") {
      url.searchParams.set("actor", "app")
    }

    if (input.codeChallenge) {
      url.searchParams.set("code_challenge", input.codeChallenge)
      url.searchParams.set("code_challenge_method", "S256")
    }

    return url.toString()
  },

  classifyError(error) {
    const status =
      error instanceof LinearOAuthError
        ? error.status
        : typeof error === "object" &&
            error &&
            "status" in error &&
            typeof error.status === "number"
          ? error.status
          : undefined
    const code =
      error instanceof LinearOAuthError
        ? error.code
        : typeof error === "object" &&
            error &&
            "code" in error &&
            typeof error.code === "string"
          ? error.code
          : undefined

    if (
      (error instanceof LinearOAuthError && error.kind === "reauthorize") ||
      status === 401 ||
      status === 403 ||
      code === "invalid_grant"
    ) {
      return "reauthorize"
    }

    return "transient"
  },

  async exchangeCode(input) {
    return requestLinearToken({
      code: input.code,
      codeVerifier: input.codeVerifier,
      grantType: "authorization_code",
    })
  },

  getAuthorizeParams() {
    const config = getLinearOAuthConfig()
    const params: Record<string, string> = {}

    if (config.actor === "app") {
      params.actor = "app"
    }

    return params
  },

  getRequestedScopes() {
    return getLinearOAuthConfig().scopes
  },

  key: "linear",
  label: "Linear",

  async refreshAccessToken(input) {
    return requestLinearToken({
      grantType: "refresh_token",
      refreshToken: input.refreshToken,
    })
  },

  usesPkce: true,
}

async function requestLinearToken(input: {
  code?: string
  codeVerifier?: string | null
  grantType: "authorization_code" | "refresh_token"
  refreshToken?: string
}): Promise<OAuthTokenExchangeResult> {
  const config = getLinearOAuthConfig()
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: input.grantType,
    redirect_uri: config.redirectUri,
  })

  if (input.grantType === "authorization_code") {
    if (!input.code) {
      throw new LinearOAuthError("Missing Linear OAuth code.")
    }

    body.set("code", input.code)

    if (input.codeVerifier) {
      body.set("code_verifier", input.codeVerifier)
    }
  } else {
    if (!input.refreshToken) {
      throw new LinearOAuthError("Missing Linear refresh token.")
    }

    body.set("refresh_token", input.refreshToken)
  }

  const response = await fetch(LINEAR_TOKEN_URL, {
    body: body.toString(),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  })

  const payload = (await response.json()) as LinearTokenResponse

  if (!response.ok || !payload.access_token) {
    throw new LinearOAuthError(
      payload.error_description ??
        payload.error ??
        "Linear OAuth token exchange failed.",
      {
        code: payload.error,
        kind:
          response.status === 401 ||
          response.status === 403 ||
          payload.error === "invalid_grant"
            ? "reauthorize"
            : "transient",
        status: response.status,
      },
    )
  }

  const identity = await fetchLinearViewerIdentity(payload.access_token)

  return {
    accessToken: payload.access_token,
    actorType: config.actor,
    expiresAt: parseExpiry(payload.expires_in),
    grantedScopes: normalizeScopeList(payload.scope) ?? config.scopes,
    identity,
    idToken: payload.id_token ?? null,
    raw: payload as Record<string, unknown>,
    refreshToken: payload.refresh_token ?? null,
    refreshTokenExpiresAt: parseExpiry(payload.refresh_token_expires_in),
    tokenType: payload.token_type ?? null,
  }
}

async function fetchLinearViewerIdentity(
  accessToken: string,
): Promise<OAuthConnectionIdentity | null> {
  try {
    const response = await fetch(LINEAR_GRAPHQL_URL, {
      body: JSON.stringify({
        query: "query OAuthViewer { viewer { id name } }",
      }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    })

    if (!response.ok) {
      return null
    }

    const payload = (await response.json()) as LinearViewerResponse
    const viewer = payload.data?.viewer

    if (!viewer?.id) {
      return null
    }

    return {
      externalAccountId: viewer.id,
      externalAccountLabel: viewer.name?.trim() || "Linear connection",
    }
  } catch {
    return null
  }
}

function normalizeScopeList(value: string | undefined) {
  if (!value) {
    return null
  }

  return value
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean)
}

function parseExpiry(value: number | string | undefined) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return new Date(Date.now() + parsed * 1000)
}
