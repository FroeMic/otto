import { jsonNoStore } from "@otto/auth"
import {
  getConnectedGitHubInstallationForTenantIntegration,
  getEnabledGitHubRepositoryDetailsForTenantIntegration,
} from "@otto/feature-integrations-runtime/db/github-installations"
import { getDb } from "@otto/feature-integrations-runtime/db/client"
import { tenantIntegrations } from "@otto/feature-integrations-runtime/db/schema"
import {
  createGitHubAppJwt,
  requestGitHubInstallationAccessToken,
} from "@otto/feature-integrations-runtime/integrations/library/github/auth"
import { and, eq } from "drizzle-orm"
import type { Context } from "hono"

import { getGitHubAppConfig } from "../integrations/github-app"
import { authenticateTenantRuntimeRequest } from "./auth"

export class GitHubGitAccessError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "GitHubGitAccessError"
    this.status = status
  }
}

type GitHubGitAccessBody = {
  owner?: unknown
  repo?: unknown
}

type GitHubGitAccessRepository = Awaited<
  ReturnType<typeof getEnabledGitHubRepositoryDetailsForTenantIntegration>
>

type GitHubGitAccessInstallation = Awaited<
  ReturnType<typeof getConnectedGitHubInstallationForTenantIntegration>
>

function normalizeGitHubName(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new GitHubGitAccessError(`${label} is required.`, 400)
  }

  const normalized = value.trim()

  if (!/^[A-Za-z0-9_.-]+$/.test(normalized)) {
    throw new GitHubGitAccessError(`${label} is invalid.`, 400)
  }

  return normalized
}

export async function createGitHubGitAccessForTenant(input: {
  body: GitHubGitAccessBody
  createAccessToken?: (installation: NonNullable<GitHubGitAccessInstallation>) => Promise<{
    expiresAt: string
    token: string
  }>
  getInstallation?: (tenantIntegrationId: string) => Promise<GitHubGitAccessInstallation>
  getRepository?: (input: {
    owner: string
    repo: string
    tenantIntegrationId: string
  }) => Promise<GitHubGitAccessRepository>
  getTenantIntegrationId?: (tenantId: string) => Promise<string | null>
  tenantId: string
}) {
  const owner = normalizeGitHubName(input.body.owner, "owner")
  const repo = normalizeGitHubName(input.body.repo, "repo")
  const tenantIntegrationId = input.getTenantIntegrationId
    ? await input.getTenantIntegrationId(input.tenantId)
    : await getConnectedGitHubTenantIntegrationId(input.tenantId)

  if (!tenantIntegrationId) {
    throw new GitHubGitAccessError("GitHub is not connected in this workspace.", 404)
  }

  const repository = input.getRepository
    ? await input.getRepository({ owner, repo, tenantIntegrationId })
    : await getEnabledGitHubRepositoryDetailsForTenantIntegration({
        owner,
        repo,
        tenantIntegrationId,
      })

  if (!repository) {
    throw new GitHubGitAccessError(
      "GitHub repository is not selected for this workspace.",
      403,
    )
  }

  const installation = input.getInstallation
    ? await input.getInstallation(tenantIntegrationId)
    : await getConnectedGitHubInstallationForTenantIntegration({
        tenantIntegrationId,
      })

  if (!installation) {
    throw new GitHubGitAccessError("GitHub needs attention. Reconnect GitHub.", 409)
  }

  if (installation.suspendedAt) {
    throw new GitHubGitAccessError(
      "GitHub needs attention. The GitHub App installation is suspended.",
      409,
    )
  }

  const access = input.createAccessToken
    ? await input.createAccessToken(installation)
    : await createDefaultAccessToken(installation)

  return {
    cloneUrl: `https://github.com/${owner}/${repo}.git`,
    defaultBranch: repository.defaultBranch,
    expiresAt: access.expiresAt,
    fullName: repository.fullName,
    owner,
    repo,
    token: access.token,
  }
}

export async function handleGitHubGitAccessRuntimeRoute(context: Context) {
  try {
    const { tenantId } = await authenticateTenantRuntimeRequest(context.req.raw)
    const body = (await context.req.raw.json().catch(() => null)) as
      | GitHubGitAccessBody
      | null

    const access = await createGitHubGitAccessForTenant({
      body: body ?? {},
      tenantId,
    })

    return jsonNoStore(access)
  } catch (error) {
    const status =
      error instanceof GitHubGitAccessError ? error.status : 500
    const message =
      error instanceof Error ? error.message : "GitHub git access failed."

    return jsonNoStore(
      {
        code: "github_git_access_failed",
        message,
      },
      status,
    )
  }
}

async function getConnectedGitHubTenantIntegrationId(tenantId: string) {
  const db = getDb()
  const [row] = await db
    .select({
      id: tenantIntegrations.id,
    })
    .from(tenantIntegrations)
    .where(
      and(
        eq(tenantIntegrations.tenantId, tenantId),
        eq(tenantIntegrations.providerKey, "github"),
      ),
    )
    .limit(1)

  return row?.id ?? null
}

async function createDefaultAccessToken(
  installation: NonNullable<GitHubGitAccessInstallation>,
) {
  const config = getGitHubAppConfig()
  const appJwt = createGitHubAppJwt({
    appId: installation.appId,
    privateKeyPem: config.privateKeyPem.replace(/\\n/g, "\n"),
  })
  const access = await requestGitHubInstallationAccessToken({
    apiBaseUrl: config.apiBaseUrl,
    appJwt,
    installationId: installation.installationId,
  })

  return {
    expiresAt: access.expiresAt,
    token: access.token,
  }
}
