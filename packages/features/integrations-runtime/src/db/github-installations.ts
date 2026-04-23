import { and, eq, sql } from "drizzle-orm"

import { getDb } from "./client"
import {
  integrationGithubInstallations,
  integrationGithubRepositories,
} from "./schema"

export type ConnectedGitHubRepositoryRecord = {
  accountLogin: string
  appId: string
  installationId: string
  repositoryId: string
  repositoryName: string
  repositoryOwner: string
}

export async function upsertGitHubInstallationForTenantIntegration(input: {
  accountId: string
  accountLogin: string
  accountType: string
  appId: string
  appSlug?: string | null
  events: string[]
  installationId: string
  lastSyncedAt?: Date | null
  permissions: Record<string, string>
  repositorySelection: string
  suspendedAt?: Date | null
  tenantId: string
  tenantIntegrationId: string
}) {
  const db = getDb()
  const now = new Date()
  const [row] = await db
    .insert(integrationGithubInstallations)
    .values({
      accountId: input.accountId,
      accountLogin: input.accountLogin,
      accountType: input.accountType,
      appId: input.appId,
      appSlug: input.appSlug ?? null,
      eventsJson: input.events,
      installationId: input.installationId,
      lastSyncedAt: input.lastSyncedAt ?? null,
      permissionsJson: input.permissions,
      repositorySelection: input.repositorySelection,
      suspendedAt: input.suspendedAt ?? null,
      tenantId: input.tenantId,
      tenantIntegrationId: input.tenantIntegrationId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      set: {
        accountId: input.accountId,
        accountLogin: input.accountLogin,
        accountType: input.accountType,
        appId: input.appId,
        appSlug: input.appSlug ?? null,
        eventsJson: input.events,
        installationId: input.installationId,
        lastSyncedAt: input.lastSyncedAt ?? null,
        permissionsJson: input.permissions,
        repositorySelection: input.repositorySelection,
        suspendedAt: input.suspendedAt ?? null,
        tenantId: input.tenantId,
        updatedAt: now,
      },
      target: integrationGithubInstallations.tenantIntegrationId,
    })
    .returning({
      id: integrationGithubInstallations.id,
    })

  if (!row) {
    throw new Error("GitHub installation upsert did not return an id.")
  }

  return row.id
}

export async function getEnabledGitHubRepositoryForTenantIntegration(input: {
  owner: string
  repo: string
  tenantIntegrationId: string
}): Promise<ConnectedGitHubRepositoryRecord | null> {
  const db = getDb()
  const [row] = await db
    .select({
      accountLogin: integrationGithubInstallations.accountLogin,
      appId: integrationGithubInstallations.appId,
      installationId: integrationGithubInstallations.installationId,
      repositoryId: integrationGithubRepositories.id,
      repositoryName: integrationGithubRepositories.name,
      repositoryOwner: integrationGithubRepositories.ownerLogin,
    })
    .from(integrationGithubRepositories)
    .innerJoin(
      integrationGithubInstallations,
      eq(
        integrationGithubInstallations.id,
        integrationGithubRepositories.githubInstallationId,
      ),
    )
    .where(
      and(
        eq(
          integrationGithubInstallations.tenantIntegrationId,
          input.tenantIntegrationId,
        ),
        eq(integrationGithubRepositories.enabledForWorkspace, true),
        sql`lower(${integrationGithubRepositories.ownerLogin}) = ${input.owner.trim().toLowerCase()}`,
        sql`lower(${integrationGithubRepositories.name}) = ${input.repo.trim().toLowerCase()}`,
      ),
    )
    .limit(1)

  return row ?? null
}
