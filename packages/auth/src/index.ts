import { unsealData } from "iron-session"

export class RuntimeAuthError extends Error {
  code: "missing_runtime_bearer_token" | "invalid_runtime_bearer_token"
  status: 401

  constructor(
    code: "missing_runtime_bearer_token" | "invalid_runtime_bearer_token",
    message: string,
  ) {
    super(message)
    this.code = code
    this.name = "RuntimeAuthError"
    this.status = 401
  }
}

export function getBearerTokenFromRequest(request: Request) {
  const authorization = request.headers.get("authorization")

  if (!authorization?.startsWith("Bearer ")) {
    throw new RuntimeAuthError(
      "missing_runtime_bearer_token",
      "Missing runtime bearer token",
    )
  }

  const token = authorization.slice("Bearer ".length).trim()

  if (!token) {
    throw new RuntimeAuthError(
      "missing_runtime_bearer_token",
      "Missing runtime bearer token",
    )
  }

  return token
}

export async function authenticateTenantRuntimeRequest<TTenant>(input: {
  getTenantByTenantToken: (tenantToken: string) => Promise<TTenant | null>
  log?: (message: string) => void
  request: Request
  resolveTenantId: (tenant: TTenant) => string
}) {
  const tenantToken = getBearerTokenFromRequest(input.request)
  const start = Date.now()

  input.log?.("[runtime-auth] looking up tenant token…")

  const tenant = await input.getTenantByTenantToken(tenantToken)
  const elapsed = Date.now() - start

  if (!tenant) {
    input.log?.(`[runtime-auth] token lookup failed (no match) in ${elapsed}ms`)
    throw new RuntimeAuthError(
      "invalid_runtime_bearer_token",
      "Invalid runtime bearer token",
    )
  }

  input.log?.(
    `[runtime-auth] authenticated tenant=${input.resolveTenantId(tenant)} in ${elapsed}ms`,
  )

  return tenant
}

export function isRuntimeAuthError(error: unknown): error is RuntimeAuthError {
  return error instanceof RuntimeAuthError
}

export class WorkspaceSessionAuthError extends Error {
  code:
    | "workos_cookie_config_invalid"
    | "missing_workspace_session"
    | "invalid_workspace_session"
  status: 401

  constructor(
    code:
      | "workos_cookie_config_invalid"
      | "missing_workspace_session"
      | "invalid_workspace_session",
    message: string,
  ) {
    super(message)
    this.code = code
    this.name = "WorkspaceSessionAuthError"
    this.status = 401
  }
}

export type WorkspaceSessionUser = {
  email: string
  firstName?: string | null
  id: string
  lastName?: string | null
}

type WorkspaceSessionPayload = {
  user: WorkspaceSessionUser
}

function getCookieValue(request: Request, cookieName: string) {
  const rawCookieHeader = request.headers.get("cookie")

  if (!rawCookieHeader) {
    return null
  }

  for (const cookiePart of rawCookieHeader.split(";")) {
    const [rawName, ...rawValueParts] = cookiePart.trim().split("=")

    if (rawName === cookieName) {
      return decodeURIComponent(rawValueParts.join("="))
    }
  }

  return null
}

function getWorkOSCookieConfig(input?: {
  cookieName?: string
  cookiePassword?: string
}) {
  const cookieName =
    input?.cookieName ?? process.env.WORKOS_COOKIE_NAME ?? "wos-session"
  const cookiePassword =
    input?.cookiePassword ?? process.env.WORKOS_COOKIE_PASSWORD ?? ""

  if (!cookiePassword || cookiePassword.length < 32) {
    throw new WorkspaceSessionAuthError(
      "workos_cookie_config_invalid",
      "WorkOS cookie configuration is invalid",
    )
  }

  return {
    cookieName,
    cookiePassword,
  }
}

function isWorkspaceSessionUser(value: unknown): value is WorkspaceSessionUser {
  if (!value || typeof value !== "object") {
    return false
  }

  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.id === "string" &&
    typeof candidate.email === "string" &&
    (candidate.firstName === undefined ||
      candidate.firstName === null ||
      typeof candidate.firstName === "string") &&
    (candidate.lastName === undefined ||
      candidate.lastName === null ||
      typeof candidate.lastName === "string")
  )
}

function isWorkspaceSessionPayload(
  value: unknown,
): value is WorkspaceSessionPayload {
  if (!value || typeof value !== "object") {
    return false
  }

  const candidate = value as Record<string, unknown>

  return isWorkspaceSessionUser(candidate.user)
}

export async function authenticateWorkspaceSessionRequest(input: {
  cookieName?: string
  cookiePassword?: string
  request: Request
}) {
  const config = getWorkOSCookieConfig({
    cookieName: input.cookieName,
    cookiePassword: input.cookiePassword,
  })
  const cookieValue = getCookieValue(input.request, config.cookieName)

  if (!cookieValue) {
    throw new WorkspaceSessionAuthError(
      "missing_workspace_session",
      "Missing workspace session",
    )
  }

  try {
    const session = await unsealData<unknown>(cookieValue, {
      password: config.cookiePassword,
    })

    if (!isWorkspaceSessionPayload(session)) {
      throw new Error("Session payload is invalid")
    }

    return session.user
  } catch {
    throw new WorkspaceSessionAuthError(
      "invalid_workspace_session",
      "Invalid workspace session",
    )
  }
}

export function isWorkspaceSessionAuthError(
  error: unknown,
): error is WorkspaceSessionAuthError {
  return error instanceof WorkspaceSessionAuthError
}

export function jsonNoStore(body: unknown, status = 200) {
  return Response.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
    status,
  })
}
