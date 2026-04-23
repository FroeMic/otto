import {
  getEnabledGitHubRepositoryDetailsForTenantIntegration,
  listEnabledGitHubRepositoriesForTenantIntegration,
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
  key: "owner" | "repo",
) {
  const value = arguments_[key]

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`repository.get requires a non-empty ${key}.`)
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
