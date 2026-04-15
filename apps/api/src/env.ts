import * as z from "zod"

const rawApiEnvSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(3002),
  CONTROL_PLANE_OPENAI_ADMIN_API_KEY: z.string().optional(),
  HETZNER_ONBOARDING_PROVISIONING_MODE: z
    .enum(["legacy_base_image", "hetzner_snapshot"])
    .default("legacy_base_image"),
  LANDING_PAGE_DOMAIN: z.string().optional(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  RUNTIME_DEPLOY_PRIVATE_KEY: z.string().optional(),
  RUNTIME_DEPLOY_PRIVATE_KEY_PATH: z.string().optional(),
  RUNTIME_SSH_COMMAND_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(30000),
  RUNTIME_SSH_CONNECT_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(5000),
  RUNTIME_SSH_PORT: z.coerce.number().int().positive().default(22),
  RUNTIME_SSH_USERNAME: z.string().default("root"),
  RUNTIME_OPENCLAW_IMAGE: z.string().optional(),
  WORKSPACE_CHAT_ATTACHMENT_STORAGE_ROOT: z.string().optional(),
  WORKOS_API_KEY: z.string().optional(),
  WORKOS_BASE_URL: z.string().url().optional(),
  WORKOS_CLIENT_ID: z.string().optional(),
  WORKOS_COOKIE_NAME: z.string().optional(),
  WORKOS_COOKIE_PASSWORD: z.string().optional(),
  WORKOS_REDIRECT_URI: z.string().url().optional(),
})

export type ApiEnv = {
  API_PORT: number
  CONTROL_PLANE_OPENAI_ADMIN_API_KEY?: string
  HETZNER_ONBOARDING_PROVISIONING_MODE:
    | "legacy_base_image"
    | "hetzner_snapshot"
  LANDING_PAGE_DOMAIN?: string
  NODE_ENV: "development" | "test" | "production"
  PUBLIC_APP_BASE_URL: string
  RUNTIME_DEPLOY_PRIVATE_KEY?: string
  RUNTIME_DEPLOY_PRIVATE_KEY_PATH?: string
  RUNTIME_SSH_COMMAND_TIMEOUT_MS: number
  RUNTIME_SSH_CONNECT_TIMEOUT_MS: number
  RUNTIME_SSH_PORT: number
  RUNTIME_SSH_USERNAME: string
  RUNTIME_OPENCLAW_IMAGE?: string
  WORKSPACE_CHAT_ATTACHMENT_STORAGE_ROOT?: string
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

export function resolveApiEnv(input: Record<string, string | undefined>) {
  const raw = rawApiEnvSchema.parse(input)
  const publicAppBaseUrl =
    deriveBaseUrlFromDomain(raw.LANDING_PAGE_DOMAIN) ??
    raw.WORKOS_BASE_URL ??
    deriveBaseUrlFromRedirectUri(raw.WORKOS_REDIRECT_URI) ??
    "http://127.0.0.1:3002"

  return {
    API_PORT: raw.API_PORT,
    CONTROL_PLANE_OPENAI_ADMIN_API_KEY:
      raw.CONTROL_PLANE_OPENAI_ADMIN_API_KEY?.trim() || undefined,
    HETZNER_ONBOARDING_PROVISIONING_MODE:
      raw.HETZNER_ONBOARDING_PROVISIONING_MODE,
    LANDING_PAGE_DOMAIN: raw.LANDING_PAGE_DOMAIN?.trim() || undefined,
    NODE_ENV: raw.NODE_ENV,
    PUBLIC_APP_BASE_URL: publicAppBaseUrl,
    RUNTIME_DEPLOY_PRIVATE_KEY:
      raw.RUNTIME_DEPLOY_PRIVATE_KEY?.trim() || undefined,
    RUNTIME_DEPLOY_PRIVATE_KEY_PATH:
      raw.RUNTIME_DEPLOY_PRIVATE_KEY_PATH?.trim() || undefined,
    RUNTIME_SSH_COMMAND_TIMEOUT_MS: raw.RUNTIME_SSH_COMMAND_TIMEOUT_MS,
    RUNTIME_SSH_CONNECT_TIMEOUT_MS: raw.RUNTIME_SSH_CONNECT_TIMEOUT_MS,
    RUNTIME_SSH_PORT: raw.RUNTIME_SSH_PORT,
    RUNTIME_SSH_USERNAME: raw.RUNTIME_SSH_USERNAME,
    RUNTIME_OPENCLAW_IMAGE: raw.RUNTIME_OPENCLAW_IMAGE?.trim() || undefined,
    WORKSPACE_CHAT_ATTACHMENT_STORAGE_ROOT:
      raw.WORKSPACE_CHAT_ATTACHMENT_STORAGE_ROOT?.trim() || undefined,
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

export function normalizePrivateKeyValue(value: string) {
  const normalized = value.replace(/\r\n/g, "\n").replace(/\\n/g, "\n").trim()

  if (normalized.includes("-----BEGIN") && !normalized.endsWith("\n")) {
    return normalized
      .replace(/(-----BEGIN [^-]+-----)\s*/, "$1\n")
      .replace(/\s*(-----END [^-]+-----)/, "\n$1")
  }

  return normalized
}

export function hasWorkOsConfig(env: ApiEnv) {
  return Boolean(
    env.WORKOS_API_KEY &&
      env.WORKOS_CLIENT_ID &&
      env.WORKOS_COOKIE_PASSWORD &&
      env.WORKOS_COOKIE_PASSWORD.length >= 32,
  )
}

export function getControlPlaneOpenAiAdminApiKey() {
  const value = getApiEnv().CONTROL_PLANE_OPENAI_ADMIN_API_KEY

  if (!value) {
    throw new Error("CONTROL_PLANE_OPENAI_ADMIN_API_KEY is required")
  }

  return value
}
