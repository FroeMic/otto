import { createHmac, timingSafeEqual } from "node:crypto"

import { getDb } from "@otto/feature-integrations-runtime/db/client"
import type {
  GitHubRepositoryUpsertInput,
  upsertGitHubInstallationForTenantIntegration,
  upsertGitHubRepositoriesForInstallation,
} from "@otto/feature-integrations-runtime/db/github-installations"
import {
  upsertGitHubInstallationForTenantIntegration as defaultUpsertGitHubInstallationForTenantIntegration,
  upsertGitHubRepositoriesForInstallation as defaultUpsertGitHubRepositoriesForInstallation,
} from "@otto/feature-integrations-runtime/db/github-installations"
import { tenantIntegrations } from "@otto/feature-integrations-runtime/db/schema"
import {
  createGitHubAppJwt,
  requestGitHubInstallationAccessToken,
} from "@otto/feature-integrations-runtime/integrations/library/github/auth"
import { and, eq } from "drizzle-orm"

import { type ApiEnv, getApiEnv } from "../env"
import { getAuthorizedTenantContext } from "./data"

export type GitHubAppSetupState = {
  exp: number
  orgSlug: string
  userExternalId: string
}

type UpsertInstallation = typeof upsertGitHubInstallationForTenantIntegration
type UpsertRepositories = typeof upsertGitHubRepositoriesForInstallation

type GitHubInstallationResponse = {
  account?: {
    id?: unknown
    login?: unknown
    type?: unknown
  }
  app_id?: unknown
  app_slug?: unknown
  events?: unknown
  id?: unknown
  permissions?: unknown
  repository_selection?: unknown
  suspended_at?: unknown
}

type GitHubRepositoryResponse = {
  archived?: unknown
  default_branch?: unknown
  disabled?: unknown
  full_name?: unknown
  id?: unknown
  name?: unknown
  owner?: {
    login?: unknown
  }
  private?: unknown
}

export function createGitHubAppSetupState(input: {
  now?: Date
  orgSlug: string
  secret: string
  userExternalId: string
}) {
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000)
  const payload: GitHubAppSetupState = {
    exp: nowSeconds + 15 * 60,
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  )
  const signature = signGitHubAppSetupState({
    encodedPayload,
    secret: input.secret,
  })

  return `${encodedPayload}.${signature}`
}

export function verifyGitHubAppSetupState(input: {
  encodedState: string
  now?: Date
  secret: string
}): GitHubAppSetupState {
  const [encodedPayload, signature] = input.encodedState.split(".")

  if (!encodedPayload || !signature) {
    throw new Error("GitHub setup state is invalid.")
  }

  const expectedSignature = signGitHubAppSetupState({
    encodedPayload,
    secret: input.secret,
  })

  if (!safeEqual(signature, expectedSignature)) {
    throw new Error("GitHub setup state signature is invalid.")
  }

  const payload = JSON.parse(
    Buffer.from(encodedPayload, "base64url").toString("utf8"),
  ) as Partial<GitHubAppSetupState>

  if (
    typeof payload.exp !== "number" ||
    typeof payload.orgSlug !== "string" ||
    typeof payload.userExternalId !== "string"
  ) {
    throw new Error("GitHub setup state payload is invalid.")
  }

  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000)

  if (payload.exp < nowSeconds) {
    throw new Error("GitHub setup state has expired.")
  }

  return {
    exp: payload.exp,
    orgSlug: payload.orgSlug,
    userExternalId: payload.userExternalId,
  }
}

export function buildGitHubAppInstallUrl(input: {
  appSlug: string
  state: string
}) {
  const url = new URL(
    `/apps/${encodeURIComponent(input.appSlug)}/installations/new`,
    "https://github.com",
  )
  url.searchParams.set("state", input.state)

  return url.toString()
}

export function getGitHubAppConfig(env: ApiEnv = getApiEnv()) {
  if (!env.GITHUB_APP_ID) {
    throw new Error("GITHUB_APP_ID is required to connect GitHub.")
  }

  if (!env.GITHUB_APP_SLUG) {
    throw new Error("GITHUB_APP_SLUG is required to connect GitHub.")
  }

  if (!env.GITHUB_APP_PRIVATE_KEY) {
    throw new Error("GITHUB_APP_PRIVATE_KEY is required to connect GitHub.")
  }

  if (!env.GITHUB_APP_STATE_SECRET) {
    throw new Error("GITHUB_APP_STATE_SECRET is required to connect GitHub.")
  }

  return {
    apiBaseUrl: env.GITHUB_API_BASE_URL ?? "https://api.github.com",
    appId: env.GITHUB_APP_ID,
    appSlug: env.GITHUB_APP_SLUG,
    privateKeyPem: env.GITHUB_APP_PRIVATE_KEY,
    stateSecret: env.GITHUB_APP_STATE_SECRET,
  }
}

export async function beginGitHubAppInstall(input: {
  config?: ReturnType<typeof getGitHubAppConfig>
  orgSlug: string
  userExternalId: string
}) {
  const config = input.config ?? getGitHubAppConfig()
  const state = createGitHubAppSetupState({
    orgSlug: input.orgSlug,
    secret: config.stateSecret,
    userExternalId: input.userExternalId,
  })

  return {
    installUrl: buildGitHubAppInstallUrl({
      appSlug: config.appSlug,
      state,
    }),
  }
}

export async function completeGitHubAppSetup(input: {
  config?: ReturnType<typeof getGitHubAppConfig>
  fetch?: typeof fetch
  installationId: string
  setupAction?: string | null
  state: string
  userExternalId: string
}) {
  const config = input.config ?? getGitHubAppConfig()
  const setupAction = input.setupAction?.trim().toLowerCase() || "install"

  if (setupAction !== "install" && setupAction !== "update") {
    throw new Error(`Unsupported GitHub setup action: ${setupAction}.`)
  }

  const state = verifyGitHubAppSetupState({
    encodedState: input.state,
    secret: config.stateSecret,
  })

  if (state.userExternalId !== input.userExternalId) {
    throw new Error("GitHub setup state does not belong to this user.")
  }

  const { tenantId } = await getAuthorizedTenantContext({
    orgSlug: state.orgSlug,
    userExternalId: input.userExternalId,
  })
  const tenantIntegrationId = await upsertConnectingGitHubTenantIntegration({
    tenantId,
  })

  try {
    const result = await completeGitHubAppInstallation({
      apiBaseUrl: config.apiBaseUrl,
      appId: config.appId,
      fetch: input.fetch,
      installationId: input.installationId,
      privateKeyPem: config.privateKeyPem,
      tenantId,
      tenantIntegrationId,
      upsertInstallation: defaultUpsertGitHubInstallationForTenantIntegration,
      upsertRepositories: defaultUpsertGitHubRepositoriesForInstallation,
    })

    await markGitHubTenantIntegrationConnected({
      tenantIntegrationId,
    })

    return {
      ...result,
      orgSlug: state.orgSlug,
    }
  } catch (error) {
    await markGitHubTenantIntegrationFailed({
      error,
      tenantIntegrationId,
    })

    throw error
  }
}

export async function completeGitHubAppInstallation(input: {
  apiBaseUrl?: string
  appId: string
  fetch?: typeof fetch
  installationId: string
  privateKeyPem: string
  tenantId: string
  tenantIntegrationId: string
  upsertInstallation: UpsertInstallation
  upsertRepositories: UpsertRepositories
}) {
  const fetchImplementation = input.fetch ?? globalThis.fetch
  const apiBaseUrl = (input.apiBaseUrl ?? "https://api.github.com").replace(
    /\/+$/,
    "",
  )
  const appJwt = createGitHubAppJwt({
    appId: input.appId,
    privateKeyPem: input.privateKeyPem,
  })
  const installation = await fetchGitHubInstallation({
    apiBaseUrl,
    appJwt,
    fetch: fetchImplementation,
    installationId: input.installationId,
  })
  const token = await requestGitHubInstallationAccessToken({
    apiBaseUrl,
    appJwt,
    fetch: fetchImplementation,
    installationId: input.installationId,
  })
  const repositories = await fetchGitHubInstallationRepositories({
    apiBaseUrl,
    fetch: fetchImplementation,
    installationToken: token.token,
    selectedByInstallation: installation.repositorySelection === "selected",
  })
  const githubInstallationId = await input.upsertInstallation({
    accountId: installation.accountId,
    accountLogin: installation.accountLogin,
    accountType: installation.accountType,
    appId: installation.appId,
    appSlug: installation.appSlug,
    events: installation.events,
    installationId: installation.installationId,
    permissions: installation.permissions,
    repositorySelection: installation.repositorySelection,
    suspendedAt: installation.suspendedAt,
    tenantId: input.tenantId,
    tenantIntegrationId: input.tenantIntegrationId,
  })

  await input.upsertRepositories({
    githubInstallationId,
    repositories,
  })

  return {
    accountLogin: installation.accountLogin,
    installationId: installation.installationId,
    repositoryCount: repositories.length,
  }
}

async function fetchGitHubInstallation(input: {
  apiBaseUrl: string
  appJwt: string
  fetch: typeof fetch
  installationId: string
}) {
  const response = await input.fetch(
    `${input.apiBaseUrl}/app/installations/${encodeURIComponent(input.installationId)}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${input.appJwt}`,
        "User-Agent": "Workspace-GitHub-Integration",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      method: "GET",
    },
  )
  const bodyText = await response.text()

  if (!response.ok) {
    throw new Error(
      `GitHub installation verification failed (${response.status}): ${bodyText}`,
    )
  }

  return parseGitHubInstallation(
    JSON.parse(bodyText) as GitHubInstallationResponse,
  )
}

async function fetchGitHubInstallationRepositories(input: {
  apiBaseUrl: string
  fetch: typeof fetch
  installationToken: string
  selectedByInstallation: boolean
}): Promise<GitHubRepositoryUpsertInput[]> {
  const url = new URL("/installation/repositories", input.apiBaseUrl)
  url.searchParams.set("per_page", "100")
  const response = await input.fetch(url.toString(), {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${input.installationToken}`,
      "User-Agent": "Workspace-GitHub-Integration",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    method: "GET",
  })
  const bodyText = await response.text()

  if (!response.ok) {
    throw new Error(
      `GitHub repository sync failed (${response.status}): ${bodyText}`,
    )
  }

  const parsed = JSON.parse(bodyText) as { repositories?: unknown }
  const repositories = Array.isArray(parsed.repositories)
    ? parsed.repositories
    : []

  return repositories.map((repository) =>
    parseGitHubRepository(
      repository as GitHubRepositoryResponse,
      input.selectedByInstallation,
    ),
  )
}

function parseGitHubInstallation(body: GitHubInstallationResponse) {
  if (
    typeof body.id !== "number" ||
    typeof body.app_id !== "number" ||
    typeof body.repository_selection !== "string" ||
    !body.account ||
    typeof body.account.id !== "number" ||
    typeof body.account.login !== "string" ||
    typeof body.account.type !== "string" ||
    !isStringRecord(body.permissions) ||
    !Array.isArray(body.events)
  ) {
    throw new Error("GitHub installation response was malformed.")
  }

  return {
    accountId: String(body.account.id),
    accountLogin: body.account.login,
    accountType: body.account.type,
    appId: String(body.app_id),
    appSlug: typeof body.app_slug === "string" ? body.app_slug : null,
    events: body.events.filter(
      (event): event is string => typeof event === "string",
    ),
    installationId: String(body.id),
    permissions: body.permissions,
    repositorySelection: body.repository_selection,
    suspendedAt:
      typeof body.suspended_at === "string"
        ? new Date(body.suspended_at)
        : null,
  }
}

function parseGitHubRepository(
  body: GitHubRepositoryResponse,
  selectedByInstallation: boolean,
): GitHubRepositoryUpsertInput {
  if (
    typeof body.id !== "number" ||
    typeof body.name !== "string" ||
    typeof body.full_name !== "string" ||
    !body.owner ||
    typeof body.owner.login !== "string"
  ) {
    throw new Error("GitHub repository response was malformed.")
  }

  return {
    archived: body.archived === true,
    defaultBranch:
      typeof body.default_branch === "string" ? body.default_branch : null,
    disabled: body.disabled === true,
    fullName: body.full_name,
    githubRepositoryId: String(body.id),
    isPrivate: body.private === true,
    name: body.name,
    ownerLogin: body.owner.login,
    selectedByInstallation,
  }
}

function signGitHubAppSetupState(input: {
  encodedPayload: string
  secret: string
}) {
  return createHmac("sha256", input.secret)
    .update(input.encodedPayload)
    .digest("base64url")
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  )
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === "string")
  )
}

async function upsertConnectingGitHubTenantIntegration(input: {
  tenantId: string
}) {
  const db = getDb()
  const now = new Date()
  const [row] = await db
    .insert(tenantIntegrations)
    .values({
      connectedAt: null,
      disconnectedAt: null,
      lastError: null,
      lastErrorAt: null,
      providerKey: "github",
      status: "connecting",
      tenantId: input.tenantId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      set: {
        disconnectedAt: null,
        lastError: null,
        lastErrorAt: null,
        status: "connecting",
        updatedAt: now,
      },
      target: [tenantIntegrations.tenantId, tenantIntegrations.providerKey],
    })
    .returning({
      id: tenantIntegrations.id,
    })

  if (!row) {
    throw new Error("GitHub tenant integration upsert did not return an id.")
  }

  return row.id
}

async function markGitHubTenantIntegrationConnected(input: {
  tenantIntegrationId: string
}) {
  const db = getDb()
  const now = new Date()

  await db
    .update(tenantIntegrations)
    .set({
      connectedAt: now,
      disconnectedAt: null,
      lastError: null,
      lastErrorAt: null,
      status: "connected",
      updatedAt: now,
    })
    .where(
      and(
        eq(tenantIntegrations.id, input.tenantIntegrationId),
        eq(tenantIntegrations.providerKey, "github"),
      ),
    )
}

async function markGitHubTenantIntegrationFailed(input: {
  error: unknown
  tenantIntegrationId: string
}) {
  const db = getDb()
  const now = new Date()

  await db
    .update(tenantIntegrations)
    .set({
      lastError:
        input.error instanceof Error
          ? input.error.message
          : String(input.error),
      lastErrorAt: now,
      status: "needs_attention",
      updatedAt: now,
    })
    .where(
      and(
        eq(tenantIntegrations.id, input.tenantIntegrationId),
        eq(tenantIntegrations.providerKey, "github"),
      ),
    )
}
