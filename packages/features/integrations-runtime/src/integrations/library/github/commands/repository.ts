import { listEnabledGitHubRepositoriesForTenantIntegration } from "../../../../db/github-installations"
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
