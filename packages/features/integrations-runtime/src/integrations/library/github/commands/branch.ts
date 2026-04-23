import type { IntegrationCommandExecute } from "../../../framework"
import {
  encodeGitHubPathSegment,
  encodeGitHubRefPath,
  githubJsonRequest,
} from "../client"

import {
  readLimit,
  readRequiredString,
  requireGitHubAuth,
  requireSelectedRepository,
} from "./shared"

type GitHubBranchResponse = {
  commit?: {
    sha?: unknown
  }
  name?: unknown
  protected?: unknown
}

function normalizeBranch(value: GitHubBranchResponse) {
  return {
    commitSha: typeof value.commit?.sha === "string" ? value.commit.sha : null,
    name: typeof value.name === "string" ? value.name : "",
    protected: value.protected === true,
  }
}

export const executeGitHubBranchListRemote = async ({
  arguments: arguments_,
  context,
}: Parameters<IntegrationCommandExecute>[0]) => {
  const commandKey = "branch.list_remote"
  const owner = readRequiredString(arguments_, "owner", commandKey)
  const repo = readRequiredString(arguments_, "repo", commandKey)
  const repository = await requireSelectedRepository({
    commandKey,
    context,
    owner,
    repo,
  })
  const branches = (await githubJsonRequest({
    auth: requireGitHubAuth(context),
    method: "GET",
    path: `/repos/${encodeGitHubPathSegment(owner)}/${encodeGitHubPathSegment(repo)}/branches?per_page=${readLimit(arguments_)}`,
  })) as GitHubBranchResponse[]

  return {
    branches: Array.isArray(branches) ? branches.map(normalizeBranch) : [],
    repository,
    total: Array.isArray(branches) ? branches.length : 0,
  }
}

export const executeGitHubBranchGetRemote = async ({
  arguments: arguments_,
  context,
}: Parameters<IntegrationCommandExecute>[0]) => {
  const commandKey = "branch.get_remote"
  const owner = readRequiredString(arguments_, "owner", commandKey)
  const repo = readRequiredString(arguments_, "repo", commandKey)
  const branch = readRequiredString(arguments_, "branch", commandKey)
  const repository = await requireSelectedRepository({
    commandKey,
    context,
    owner,
    repo,
  })
  const result = (await githubJsonRequest({
    auth: requireGitHubAuth(context),
    method: "GET",
    path: `/repos/${encodeGitHubPathSegment(owner)}/${encodeGitHubPathSegment(repo)}/branches/${encodeGitHubPathSegment(branch)}`,
  })) as GitHubBranchResponse

  return {
    branch: normalizeBranch(result),
    repository,
  }
}

export const executeGitHubBranchDeleteRemote = async ({
  arguments: arguments_,
  context,
}: Parameters<IntegrationCommandExecute>[0]) => {
  const commandKey = "branch.delete_remote"
  const owner = readRequiredString(arguments_, "owner", commandKey)
  const repo = readRequiredString(arguments_, "repo", commandKey)
  const branch = readRequiredString(arguments_, "branch", commandKey)
  const repository = await requireSelectedRepository({
    commandKey,
    context,
    owner,
    repo,
  })

  if (branch === repository.defaultBranch) {
    throw new Error("branch.delete_remote cannot delete the default branch.")
  }

  await githubJsonRequest({
    auth: requireGitHubAuth(context),
    method: "DELETE",
    path: `/repos/${encodeGitHubPathSegment(owner)}/${encodeGitHubPathSegment(repo)}/git/refs/heads/${encodeGitHubRefPath(branch)}`,
  })

  return {
    branch,
    deleted: true,
    repository,
  }
}
