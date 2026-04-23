import { getEnabledGitHubRepositoryDetailsForTenantIntegration } from "../../../../db/github-installations"
import type { IntegrationCommandExecute } from "../../../framework"

export function readLimit(arguments_: Record<string, unknown>) {
  const value = arguments_.limit

  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.min(Math.trunc(value), 100))
    : 50
}

export function requireGitHubTenantIntegrationId(
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

export function requireGitHubAuth(
  context: Parameters<IntegrationCommandExecute>[0]["context"],
) {
  if (context.auth?.kind !== "github_app_installation") {
    throw new Error("GitHub is not connected in this workspace.")
  }

  return context.auth
}

export function readRequiredString(
  arguments_: Record<string, unknown>,
  key: string,
  commandKey: string,
) {
  const value = arguments_[key]

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${commandKey} requires a non-empty ${key}.`)
  }

  return value.trim()
}

export function readOptionalString(
  arguments_: Record<string, unknown>,
  key: string,
) {
  const value = arguments_[key]

  return typeof value === "string" && value.trim() ? value.trim() : null
}

export function readRequiredInteger(
  arguments_: Record<string, unknown>,
  key: string,
  commandKey: string,
) {
  const value = arguments_[key]

  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(`${commandKey} requires a positive integer ${key}.`)
  }

  return value
}

export async function requireSelectedRepository(input: {
  commandKey: string
  context: Parameters<IntegrationCommandExecute>[0]["context"]
  owner: string
  repo: string
}) {
  const repository =
    await getEnabledGitHubRepositoryDetailsForTenantIntegration({
      owner: input.owner,
      repo: input.repo,
      tenantIntegrationId: requireGitHubTenantIntegrationId(input.context),
    })

  if (!repository) {
    throw new Error(
      `${input.commandKey} can only run against repositories selected for this workspace.`,
    )
  }

  return repository
}
