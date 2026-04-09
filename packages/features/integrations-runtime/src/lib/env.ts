import "dotenv/config"

import crypto from "node:crypto"

import { z } from "zod"

const envSchema = z.object({
  CONTROL_PLANE_DOMAIN: z.string().optional(),
  CONTROL_PLANE_ENCRYPTION_SECRET: z.string().optional(),
  CONTROL_PLANE_OAUTH_STATE_SECRET: z.string().optional(),
  DATABASE_URL: z.url(),
  LINEAR_CLIENT_ID: z.string().optional(),
  LINEAR_CLIENT_SECRET: z.string().optional(),
  LINEAR_OAUTH_ACTOR: z.enum(["app", "user"]).default("app"),
  LINEAR_OAUTH_SCOPES: z
    .string()
    .default(
      "read,write,issues:create,comments:create,timeSchedule:write,app:mentionable,app:assignable,customer:read,customer:write,initiative:read,initiative:write",
    ),
  LINEAR_REDIRECT_URI: z.string().url().optional(),
  NEXT_PUBLIC_WORKOS_REDIRECT_URI: z.string().url().optional(),
  RUNTIME_BRAVE_API_KEY: z.string().optional(),
  RUNTIME_GEMINI_API_KEY: z.string().optional(),
  RUNTIME_KIMI_API_KEY: z.string().optional(),
  RUNTIME_MOONSHOT_API_KEY: z.string().optional(),
  RUNTIME_OPENROUTER_API_KEY: z.string().optional(),
  RUNTIME_PERPLEXITY_API_KEY: z.string().optional(),
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
  SLACK_BOT_SCOPES: z
    .string()
    .default(
      "app_mentions:read,channels:history,channels:join,channels:manage,channels:read,chat:write,files:read,groups:history,groups:read,groups:write,im:history,im:write,mpim:history,users:read,users:read.email",
    ),
  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),
  SLACK_REDIRECT_URI: z.string().url().optional(),
  WORKOS_BASE_URL: z.string().url().optional(),
  WORKOS_REDIRECT_URI: z.string().url().optional(),
})

export type IntegrationsRuntimeEnv = z.infer<typeof envSchema>

let cachedEnv: IntegrationsRuntimeEnv | null = null

export function getEnv() {
  if (cachedEnv) {
    return cachedEnv
  }

  cachedEnv = envSchema.parse(process.env)
  return cachedEnv
}

export function getControlPlaneBaseUrl() {
  const env = getEnv()

  return (
    deriveBaseUrlFromDomain(env.CONTROL_PLANE_DOMAIN) ??
    env.WORKOS_BASE_URL ??
    deriveBaseUrlFromUri(
      env.WORKOS_REDIRECT_URI ?? env.SLACK_REDIRECT_URI ?? env.NEXT_PUBLIC_WORKOS_REDIRECT_URI,
    )
  )
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

function deriveBaseUrlFromDomain(domain?: string) {
  if (!domain) {
    return null
  }

  return `https://${domain}`
}

function deriveBaseUrlFromUri(uri?: string) {
  if (!uri) {
    return null
  }

  const url = new URL(uri)
  return `${url.protocol}//${url.host}`
}

function resolveControlPlaneSecret(
  value: string | undefined,
  envVarName: string,
) {
  if (!value) {
    throw new Error(`${envVarName} is required`)
  }

  return crypto.createHash("sha256").update(value).digest()
}
