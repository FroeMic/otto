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

export function jsonNoStore(body: unknown, status = 200) {
  return Response.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
    status,
  })
}
