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

export type GitHubRepositoryUpsertInput = {
  archived: boolean
  defaultBranch: string | null
  disabled: boolean
  fullName: string
  githubRepositoryId: string
  isPrivate: boolean
  name: string
  ownerLogin: string
  selectedByInstallation: boolean
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

export async function upsertGitHubRepositoriesForInstallation(input: {
  githubInstallationId: string
  repositories: GitHubRepositoryUpsertInput[]
}) {
  if (input.repositories.length === 0) {
    return
  }

  const db = getDb()
  const now = new Date()

  await db
    .insert(integrationGithubRepositories)
    .values(
      input.repositories.map((repository) => ({
        archived: repository.archived,
        defaultBranch: repository.defaultBranch,
        disabled: repository.disabled,
        enabledForWorkspace: true,
        fullName: repository.fullName,
        githubInstallationId: input.githubInstallationId,
        githubRepositoryId: repository.githubRepositoryId,
        isPrivate: repository.isPrivate,
        lastSyncedAt: now,
        name: repository.name,
        ownerLogin: repository.ownerLogin,
        selectedByInstallation: repository.selectedByInstallation,
        updatedAt: now,
      })),
    )
    .onConflictDoUpdate({
      set: {
        archived: sql.raw(
          `excluded.${integrationGithubRepositories.archived.name}`,
        ),
        defaultBranch: sql.raw(
          `excluded.${integrationGithubRepositories.defaultBranch.name}`,
        ),
        disabled: sql.raw(
          `excluded.${integrationGithubRepositories.disabled.name}`,
        ),
        fullName: sql.raw(
          `excluded.${integrationGithubRepositories.fullName.name}`,
        ),
        isPrivate: sql.raw(
          `excluded.${integrationGithubRepositories.isPrivate.name}`,
        ),
        lastSyncedAt: now,
        name: sql.raw(`excluded.${integrationGithubRepositories.name.name}`),
        ownerLogin: sql.raw(
          `excluded.${integrationGithubRepositories.ownerLogin.name}`,
        ),
        selectedByInstallation: sql.raw(
          `excluded.${integrationGithubRepositories.selectedByInstallation.name}`,
        ),
        updatedAt: now,
      },
      target: [
        integrationGithubRepositories.githubInstallationId,
        integrationGithubRepositories.githubRepositoryId,
      ],
    })
}
