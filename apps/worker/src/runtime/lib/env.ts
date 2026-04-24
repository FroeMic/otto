import crypto from "node:crypto"
import fs from "node:fs"

import { z } from "zod"

const PROVISIONING_PROVIDER_ENV_VALUES = [
  "auto",
  "docker",
  "fake",
  "hetzner",
] as const
const PROVISIONING_PROVIDER_VALUES = ["docker", "fake", "hetzner"] as const
export type ProvisioningProviderMode =
  (typeof PROVISIONING_PROVIDER_VALUES)[number]

const envSchema = z.object({
  DATABASE_URL: z.url(),
  HETZNER_ACTION_TIMEOUT_MS: z.coerce.number().int().positive().default(300000),
  HETZNER_API_BASE_URL: z.url().default("https://api.hetzner.cloud/v1"),
  HETZNER_API_TOKEN: z.string().optional(),
  HETZNER_DEFAULT_IMAGE: z.string().default("ubuntu-24.04"),
  HETZNER_DEFAULT_LOCATION: z.string().default("ash"),
  HETZNER_DEFAULT_SERVER_TYPE: z.string().default("cpx21"),
  HETZNER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  HETZNER_SSH_KEY_NAMES: z.string().default(""),
  INTEGRATION_GATEWAY_INTERNAL_URL: z
    .string()
    .url()
    .default("http://127.0.0.1:3001"),
  INTEGRATION_GATEWAY_PORT: z.coerce.number().int().positive().default(3001),
  RUNTIME_DEPLOY_PRIVATE_KEY: z.string().optional(),
  RUNTIME_DEPLOY_PRIVATE_KEY_PATH: z.string().optional(),
  RUNTIME_OPENCLAW_IMAGE: z
    .string()
    .default("ghcr.io/openclaw/openclaw:2026.4.22"),
  RUNTIME_BRAVE_API_KEY: z.string().optional(),
  RUNTIME_GEMINI_API_KEY: z.string().optional(),
  RUNTIME_KIMI_API_KEY: z.string().optional(),
  RUNTIME_MODEL_PRIMARY: z.string().default("openai/gpt-5.4"),
  RUNTIME_MOONSHOT_API_KEY: z.string().optional(),
  RUNTIME_OPENROUTER_API_KEY: z.string().optional(),
  RUNTIME_PERPLEXITY_API_KEY: z.string().optional(),
  RUNTIME_SLACK_APP_TOKEN: z.string().optional(),
  OTTO_OPENAI_PROXY_BASE_URL: z.string().url().optional(),
  OTTO_OPENAI_PROXY_TRANSPORT: z.enum(["sse", "websocket"]).default("sse"),
  RUNTIME_WEB_SEARCH_BRAVE_MODE: z.enum(["web", "llm-context"]).optional(),
  RUNTIME_WEB_SEARCH_CACHE_TTL_MINUTES: z.coerce
    .number()
    .int()
    .nonnegative()
    .optional(),
  RUNTIME_WEB_SEARCH_GEMINI_MODEL: z.string().optional(),
  RUNTIME_WEB_SEARCH_GROK_INLINE_CITATIONS: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  RUNTIME_WEB_SEARCH_GROK_MODEL: z.string().optional(),
  RUNTIME_WEB_SEARCH_KIMI_BASE_URL: z.string().optional(),
  RUNTIME_WEB_SEARCH_KIMI_MODEL: z.string().optional(),
  RUNTIME_WEB_SEARCH_MAX_RESULTS: z.coerce
    .number()
    .int()
    .positive()
    .max(10)
    .optional(),
  RUNTIME_WEB_SEARCH_PERPLEXITY_BASE_URL: z.string().optional(),
  RUNTIME_WEB_SEARCH_PERPLEXITY_MODEL: z.string().optional(),
  RUNTIME_WEB_SEARCH_PROVIDER: z
    .enum(["brave", "gemini", "grok", "kimi", "perplexity"])
    .optional(),
  RUNTIME_WEB_SEARCH_TIMEOUT_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .optional(),
  RUNTIME_XAI_API_KEY: z.string().optional(),
  LINEAR_CLIENT_ID: z.string().optional(),
  LINEAR_CLIENT_SECRET: z.string().optional(),
  LINEAR_OAUTH_ACTOR: z.enum(["app", "user"]).default("app"),
  LINEAR_OAUTH_SCOPES: z
    .string()
    .default(
      "read,write,issues:create,comments:create,timeSchedule:write,app:mentionable,app:assignable,customer:read,customer:write,initiative:read,initiative:write",
    ),
  LINEAR_REDIRECT_URI: z.string().url().optional(),
  SLACK_BOT_SCOPES: z
    .string()
    .default(
      "app_mentions:read,channels:history,channels:join,channels:manage,channels:read,chat:write,files:read,groups:history,groups:read,groups:write,im:history,im:write,mpim:history,users:read,users:read.email",
    ),
  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),
  SLACK_REDIRECT_URI: z.string().url().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
  RUNTIME_SSH_CONNECT_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(5000),
  RUNTIME_SSH_COMMAND_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(30000),
  RUNTIME_SSH_PORT: z.coerce.number().int().positive().default(22),
  RUNTIME_SSH_READY_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(300000),
  RUNTIME_SSH_USERNAME: z.string().default("root"),
  LANDING_PAGE_DOMAIN: z.string().optional(),
  CONTROL_PLANE_ENCRYPTION_SECRET: z.string().optional(),
  CONTROL_PLANE_OPENAI_ADMIN_API_KEY: z.string().optional(),
  CONTROL_PLANE_OAUTH_STATE_SECRET: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_ENABLED: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_TOKEN: z.string().optional(),
  WORKOS_API_KEY: z.string().optional(),
  WORKOS_BASE_URL: z.string().url().optional(),
  WORKOS_CLIENT_ID: z.string().optional(),
  WORKOS_COOKIE_PASSWORD: z.string().optional(),
  WORKOS_REDIRECT_URI: z.string().url().optional(),
  WORKOS_WEBHOOK_SECRET: z.string().optional(),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  WORKER_BATCH_SIZE: z.coerce.number().int().positive().default(5),
  WORKER_STALE_JOB_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(1800000),
  NEXT_PUBLIC_WORKOS_REDIRECT_URI: z.string().url().optional(),
  TENANT_RUNTIME_PROVIDER: z.enum(PROVISIONING_PROVIDER_ENV_VALUES).optional(),
  TENANT_RUNTIME_DOCKER_CONTAINER_PREFIX: z
    .string()
    .default("managed-tenant-host"),
  TENANT_RUNTIME_DOCKER_DOCKER_BIN: z.string().default("docker"),
  TENANT_RUNTIME_DOCKER_HOST_IMAGE: z
    .string()
    .default("ghcr.io/froemic/otto-tenant-host:latest"),
  TENANT_RUNTIME_DOCKER_NETWORK: z.string().default("otto-tenant-lab"),
  TENANT_RUNTIME_DOCKER_ENDPOINT_MODE: z
    .enum(["container_name", "published_port"])
    .default("published_port"),
  TENANT_RUNTIME_DOCKER_POLL_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(1000),
  TENANT_RUNTIME_DOCKER_SSH_HOST: z.string().default("127.0.0.1"),
  TENANT_RUNTIME_DOCKER_SSH_PORT_RANGE_END: z.coerce
    .number()
    .int()
    .positive()
    .default(42999),
  TENANT_RUNTIME_DOCKER_SSH_PORT_RANGE_START: z.coerce
    .number()
    .int()
    .positive()
    .default(42000),
  TENANT_RUNTIME_DOCKER_SSH_USERNAME: z.string().default("root"),
  TENANT_RUNTIME_DOCKER_STARTUP_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(120000),
})

export type AppEnv = z.infer<typeof envSchema>

let cachedEnv: AppEnv | null = null

export function getEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv
  }

  cachedEnv = envSchema.parse(process.env)
  validateRuntimeSshEnv(cachedEnv)
  validateDockerProvisioningEnv(cachedEnv)
  return cachedEnv
}

export const __testing = {
  resetEnvCacheForTests() {
    cachedEnv = null
  },
  resolveProvisioningProviderMode,
} as const

export function getRuntimeSshAuthSource() {
  const env = getEnv()

  return resolveRuntimeSshAuthSource(env)
}

export function getControlPlaneEncryptionSecret() {
  return resolveControlPlaneSecret(
    getEnv().CONTROL_PLANE_ENCRYPTION_SECRET,
    "CONTROL_PLANE_ENCRYPTION_SECRET",
  )
}

export function getControlPlaneOAuthStateSecret() {
  return resolveControlPlaneSecret(
    getEnv().CONTROL_PLANE_OAUTH_STATE_SECRET,
    "CONTROL_PLANE_OAUTH_STATE_SECRET",
  )
}

export function getControlPlaneOpenAiAdminApiKey() {
  const value = getEnv().CONTROL_PLANE_OPENAI_ADMIN_API_KEY

  if (!value) {
    throw new Error("CONTROL_PLANE_OPENAI_ADMIN_API_KEY is required")
  }

  return value
}

export function getStripeSecretKey() {
  const value = getEnv().STRIPE_SECRET_KEY

  if (!value) {
    throw new Error("STRIPE_SECRET_KEY is required")
  }

  return value
}

export function getStripeWebhookSecret() {
  const value = getEnv().STRIPE_WEBHOOK_SECRET

  if (!value) {
    throw new Error("STRIPE_WEBHOOK_SECRET is required")
  }

  return value
}

export function hasStripeBillingConfig() {
  try {
    getStripeSecretKey()
    return true
  } catch {
    return false
  }
}

export function getControlPlaneBaseUrl() {
  const env = getEnv()

  return (
    deriveBaseUrlFromDomain(env.LANDING_PAGE_DOMAIN) ??
    env.WORKOS_BASE_URL ??
    deriveBaseUrlFromUri(
      env.WORKOS_REDIRECT_URI ??
        env.SLACK_REDIRECT_URI ??
        env.NEXT_PUBLIC_WORKOS_REDIRECT_URI,
    )
  )
}

export function getOpenAiProxyBaseUrl() {
  const env = getEnv()

  return env.OTTO_OPENAI_PROXY_BASE_URL ?? getControlPlaneBaseUrl()
}

export function getOpenAiProxyTransport() {
  return getEnv().OTTO_OPENAI_PROXY_TRANSPORT
}

export function getProvisioningProviderMode() {
  const env = getEnv()

  return resolveProvisioningProviderMode({
    hetznerApiToken: env.HETZNER_API_TOKEN,
    tenantRuntimeProvider: env.TENANT_RUNTIME_PROVIDER,
  })
}

export function getSlackOAuthConfig() {
  const env = getEnv()

  if (
    !env.SLACK_CLIENT_ID ||
    !env.SLACK_CLIENT_SECRET ||
    !env.SLACK_REDIRECT_URI
  ) {
    throw new Error("Slack OAuth is not fully configured")
  }

  return {
    botScopes: env.SLACK_BOT_SCOPES.split(",")
      .map((scope) => scope.trim())
      .filter(Boolean),
    clientId: env.SLACK_CLIENT_ID,
    clientSecret: env.SLACK_CLIENT_SECRET,
    redirectUri: env.SLACK_REDIRECT_URI,
  }
}

export function hasSlackOAuthConfig() {
  try {
    getSlackOAuthConfig()
    return true
  } catch {
    return false
  }
}

export function getLinearOAuthConfig() {
  const env = getEnv()

  if (
    !env.LINEAR_CLIENT_ID ||
    !env.LINEAR_CLIENT_SECRET ||
    !env.LINEAR_REDIRECT_URI
  ) {
    throw new Error("Linear OAuth is not fully configured")
  }

  return {
    actor: env.LINEAR_OAUTH_ACTOR,
    clientId: env.LINEAR_CLIENT_ID,
    clientSecret: env.LINEAR_CLIENT_SECRET,
    redirectUri: env.LINEAR_REDIRECT_URI,
    scopes: env.LINEAR_OAUTH_SCOPES.split(",")
      .map((scope) => scope.trim())
      .filter(Boolean),
  }
}

export function hasLinearOAuthConfig() {
  try {
    getLinearOAuthConfig()
    return true
  } catch {
    return false
  }
}

export function normalizePrivateKeyValue(value: string) {
  let normalized = value.trim()

  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1)
  }

  normalized = normalized
    .replaceAll("\\r\\n", "\n")
    .replaceAll("\\n", "\n")
    .replaceAll("\r\n", "\n")

  if (normalized.includes("-----BEGIN ") && normalized.includes("-----END ")) {
    normalized = normalized
      .replace(/(-----BEGIN [^-]+-----)\s*/, "$1\n")
      .replace(/\s*(-----END [^-]+-----)/, "\n$1")
  }

  return normalized
}

function deriveBaseUrlFromUri(uri?: string) {
  if (!uri) {
    return ""
  }

  try {
    return new URL(uri).origin
  } catch {
    return ""
  }
}

function deriveBaseUrlFromDomain(domain?: string) {
  if (!domain) {
    return ""
  }

  return `https://${domain}`
}

function validateRuntimeSshEnv(env: AppEnv) {
  const authSource = resolveRuntimeSshAuthSource(env)

  if (authSource === "env") {
    const privateKey = env.RUNTIME_DEPLOY_PRIVATE_KEY

    if (!privateKey) {
      throw new Error(
        "RUNTIME_DEPLOY_PRIVATE_KEY auth was selected but the variable is empty",
      )
    }

    assertPrivateKeyIsValid(
      normalizePrivateKeyValue(privateKey),
      "RUNTIME_DEPLOY_PRIVATE_KEY",
    )
    return
  }

  if (authSource === "path") {
    const keyPath = env.RUNTIME_DEPLOY_PRIVATE_KEY_PATH

    if (!keyPath) {
      throw new Error(
        "RUNTIME_DEPLOY_PRIVATE_KEY_PATH auth was selected but the variable is empty",
      )
    }

    if (!fs.existsSync(keyPath)) {
      throw new Error(
        `RUNTIME_DEPLOY_PRIVATE_KEY_PATH does not exist: ${keyPath}`,
      )
    }

    const key = fs.readFileSync(keyPath, "utf8")
    assertPrivateKeyIsValid(key, "RUNTIME_DEPLOY_PRIVATE_KEY_PATH")
  }
}

function assertPrivateKeyIsValid(key: string, source: string) {
  const normalizedKey = normalizePrivateKeyValue(key)

  try {
    crypto.createPrivateKey(normalizedKey)
  } catch (error) {
    if (looksLikePrivateKey(normalizedKey)) {
      return
    }

    const message =
      error instanceof Error ? error.message : "Unknown private key error"

    throw new Error(`${source} is not a valid private key: ${message}`)
  }
}

function looksLikePrivateKey(value: string) {
  return (
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(value) &&
    /-----END [A-Z ]*PRIVATE KEY-----/.test(value)
  )
}

function resolveRuntimeSshAuthSource(env: AppEnv) {
  if (env.RUNTIME_DEPLOY_PRIVATE_KEY) {
    return "env"
  }

  if (env.RUNTIME_DEPLOY_PRIVATE_KEY_PATH) {
    return "path"
  }

  if (process.env.SSH_AUTH_SOCK) {
    return "agent"
  }

  return "none"
}

function validateDockerProvisioningEnv(env: AppEnv) {
  if (
    env.TENANT_RUNTIME_DOCKER_SSH_PORT_RANGE_START >
    env.TENANT_RUNTIME_DOCKER_SSH_PORT_RANGE_END
  ) {
    throw new Error(
      "TENANT_RUNTIME_DOCKER_SSH_PORT_RANGE_START must be less than or equal to TENANT_RUNTIME_DOCKER_SSH_PORT_RANGE_END",
    )
  }
}

function resolveControlPlaneSecret(
  value: string | undefined,
  envVarName: string,
) {
  if (value) {
    return deriveFixedLengthSecret(value)
  }

  if (process.env.WORKOS_COOKIE_PASSWORD) {
    return deriveFixedLengthSecret(process.env.WORKOS_COOKIE_PASSWORD)
  }

  throw new Error(
    `${envVarName} is not set and WORKOS_COOKIE_PASSWORD is unavailable for fallback`,
  )
}

function deriveFixedLengthSecret(value: string) {
  return crypto.createHash("sha256").update(value).digest()
}

function resolveProvisioningProviderMode(input: {
  hetznerApiToken?: string
  tenantRuntimeProvider?: string
}): ProvisioningProviderMode {
  const provider = input.tenantRuntimeProvider?.trim()

  if (provider) {
    if (provider === "auto") {
      return input.hetznerApiToken ? "hetzner" : "fake"
    }

    if (isProvisioningProviderMode(provider)) {
      return provider
    }

    throw new Error(
      `TENANT_RUNTIME_PROVIDER must be one of: ${PROVISIONING_PROVIDER_ENV_VALUES.join(", ")}`,
    )
  }

  return input.hetznerApiToken ? "hetzner" : "fake"
}

function isProvisioningProviderMode(
  value: string,
): value is ProvisioningProviderMode {
  return PROVISIONING_PROVIDER_VALUES.includes(
    value as ProvisioningProviderMode,
  )
}
