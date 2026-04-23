import {
  getEnabledGitHubRepositoryDetailsForTenantIntegration,
  listEnabledGitHubRepositoriesForTenantIntegration,
  searchEnabledGitHubRepositoriesForTenantIntegration,
} from "../../../../db/github-installations"
import type { IntegrationCommandExecute } from "../../../framework"

function readLimit(arguments_: Record<string, unknown>) {
  const value = arguments_.limit

  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.min(Math.trunc(value), 100))
    : 50
}

function requireGitHubTenantIntegrationId(
  context: Parameters<IntegrationCommandExecute>[0]["context"],
) {
  if (
    context.auth?.kind !== "github_app_installation" ||
    !context.tenantIntegrationId
  ) {
    throw new Error("GitHub is not connected in this workspace.")
  }

  return context.tenantIntegrationId
}

function readRequiredString(
  arguments_: Record<string, unknown>,
  key: "owner" | "query" | "repo",
  commandKey = "repository.get",
) {
  const value = arguments_[key]

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${commandKey} requires a non-empty ${key}.`)
  }

  return value.trim()
}

export const executeGitHubRepositoryList: IntegrationCommandExecute = async ({
  arguments: arguments_,
  context,
}) => {
  const repositories = await listEnabledGitHubRepositoriesForTenantIntegration({
    limit: readLimit(arguments_),
    tenantIntegrationId: requireGitHubTenantIntegrationId(context),
  })

  return {
    repositories,
    total: repositories.length,
  }
}

export const executeGitHubRepositoryGet: IntegrationCommandExecute = async ({
  arguments: arguments_,
  context,
}) => {
  const repository =
    await getEnabledGitHubRepositoryDetailsForTenantIntegration({
      owner: readRequiredString(arguments_, "owner"),
      repo: readRequiredString(arguments_, "repo"),
      tenantIntegrationId: requireGitHubTenantIntegrationId(context),
    })

  if (!repository) {
    throw new Error(
      "GitHub repository is not selected for this workspace or does not exist.",
    )
  }

  return {
    repository,
  }
}

export const executeGitHubRepositorySearch: IntegrationCommandExecute = async ({
  arguments: arguments_,
  context,
}) => {
  const repositories =
    await searchEnabledGitHubRepositoriesForTenantIntegration({
      limit: readLimit(arguments_),
      query: readRequiredString(arguments_, "query", "repository.search"),
      tenantIntegrationId: requireGitHubTenantIntegrationId(context),
    })

  return {
    repositories,
    total: repositories.length,
  }
}
