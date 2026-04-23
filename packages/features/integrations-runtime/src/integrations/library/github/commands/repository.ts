import {
  getEnabledGitHubRepositoryDetailsForTenantIntegration,
  listEnabledGitHubRepositoriesForTenantIntegration,
  searchEnabledGitHubRepositoriesForTenantIntegration,
} from "../../../../db/github-installations"
import type { IntegrationCommandExecute } from "../../../framework"
import {
  readLimit,
  readRequiredString,
  requireGitHubTenantIntegrationId,
} from "./shared"

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
      owner: readRequiredString(arguments_, "owner", "repository.get"),
      repo: readRequiredString(arguments_, "repo", "repository.get"),
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
