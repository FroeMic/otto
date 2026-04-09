import * as z from "zod"

const rawApiEnvSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(3002),
  CONTROL_PLANE_DOMAIN: z.string().optional(),
  LANDING_PAGE_DOMAIN: z.string().optional(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  WORKOS_API_KEY: z.string().optional(),
  WORKOS_BASE_URL: z.string().url().optional(),
  WORKOS_CLIENT_ID: z.string().optional(),
  WORKOS_COOKIE_NAME: z.string().optional(),
  WORKOS_COOKIE_PASSWORD: z.string().optional(),
  WORKOS_REDIRECT_URI: z.string().url().optional(),
})

export type ApiEnv = {
  API_PORT: number
  CONTROL_PLANE_DOMAIN: string
  LANDING_PAGE_DOMAIN?: string
  NODE_ENV: "development" | "test" | "production"
  PUBLIC_APP_BASE_URL: string
  WORKOS_API_KEY?: string
  WORKOS_CLIENT_ID?: string
  WORKOS_COOKIE_NAME?: string
  WORKOS_COOKIE_PASSWORD?: string
  WORKOS_REDIRECT_URI: string
}

function deriveProtocolFromHost(host: string) {
  if (
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("0.0.0.0")
  ) {
    return "http"
  }

  return "https"
}

function deriveBaseUrlFromDomain(domain: string | undefined) {
  if (!domain) {
    return null
  }

  const trimmedDomain = domain.trim()

  if (!trimmedDomain) {
    return null
  }

  return `${deriveProtocolFromHost(trimmedDomain)}://${trimmedDomain}`
}

function deriveBaseUrlFromRedirectUri(redirectUri: string | undefined) {
  if (!redirectUri) {
    return null
  }

  try {
    return new URL(redirectUri).origin
  } catch {
    return null
  }
}

function deriveControlPlaneDomain(input: {
  CONTROL_PLANE_DOMAIN?: string
  LANDING_PAGE_DOMAIN?: string
  publicAppBaseUrl: string
}) {
  if (input.LANDING_PAGE_DOMAIN?.trim()) {
    return input.LANDING_PAGE_DOMAIN.trim()
  }

  if (input.CONTROL_PLANE_DOMAIN?.trim()) {
    return input.CONTROL_PLANE_DOMAIN.trim()
  }

  return new URL(input.publicAppBaseUrl).host
}

export function resolveApiEnv(input: Record<string, string | undefined>) {
  const raw = rawApiEnvSchema.parse(input)
  const publicAppBaseUrl =
    deriveBaseUrlFromDomain(raw.LANDING_PAGE_DOMAIN) ??
    deriveBaseUrlFromDomain(raw.CONTROL_PLANE_DOMAIN) ??
    raw.WORKOS_BASE_URL ??
    deriveBaseUrlFromRedirectUri(raw.WORKOS_REDIRECT_URI) ??
    "http://127.0.0.1:3002"
  const controlPlaneDomain = deriveControlPlaneDomain({
    CONTROL_PLANE_DOMAIN: raw.CONTROL_PLANE_DOMAIN,
    LANDING_PAGE_DOMAIN: raw.LANDING_PAGE_DOMAIN,
    publicAppBaseUrl,
  })

  return {
    API_PORT: raw.API_PORT,
    CONTROL_PLANE_DOMAIN: controlPlaneDomain,
    LANDING_PAGE_DOMAIN: raw.LANDING_PAGE_DOMAIN?.trim() || undefined,
    NODE_ENV: raw.NODE_ENV,
    PUBLIC_APP_BASE_URL: publicAppBaseUrl,
    WORKOS_API_KEY: raw.WORKOS_API_KEY?.trim() || undefined,
    WORKOS_CLIENT_ID: raw.WORKOS_CLIENT_ID?.trim() || undefined,
    WORKOS_COOKIE_NAME: raw.WORKOS_COOKIE_NAME?.trim() || undefined,
    WORKOS_COOKIE_PASSWORD: raw.WORKOS_COOKIE_PASSWORD?.trim() || undefined,
    WORKOS_REDIRECT_URI:
      raw.WORKOS_REDIRECT_URI ?? `${publicAppBaseUrl}/auth/callback`,
  } satisfies ApiEnv
}

export function getApiEnv() {
  return resolveApiEnv(process.env)
}

export function hasWorkOsConfig(env: ApiEnv) {
  return Boolean(
    env.WORKOS_API_KEY &&
      env.WORKOS_CLIENT_ID &&
      env.WORKOS_COOKIE_PASSWORD &&
      env.WORKOS_COOKIE_PASSWORD.length >= 32,
  )
}
