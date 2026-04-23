import {
  encodeGitHubPathSegment,
  githubJsonRequest,
  type GitHubCommandAuth,
} from "../client"
import type { IntegrationCommandExecute } from "../../../framework"

import {
  readLimit,
  readOptionalString,
  readRequiredInteger,
  readRequiredString,
  requireGitHubAuth,
  requireSelectedRepository,
} from "./shared"

type GitHubPullRequestResponse = {
  base?: {
    ref?: unknown
  }
  body?: unknown
  draft?: unknown
  head?: {
    ref?: unknown
    sha?: unknown
  }
  html_url?: unknown
  id?: unknown
  node_id?: unknown
  number?: unknown
  state?: unknown
  title?: unknown
  user?: {
    login?: unknown
  }
}

function repoPath(owner: string, repo: string) {
  return `/repos/${encodeGitHubPathSegment(owner)}/${encodeGitHubPathSegment(repo)}`
}

function normalizePullRequest(value: GitHubPullRequestResponse) {
  return {
    authorLogin: typeof value.user?.login === "string" ? value.user.login : null,
    baseRef: typeof value.base?.ref === "string" ? value.base.ref : null,
    body: typeof value.body === "string" ? value.body : null,
    draft: value.draft === true,
    headRef: typeof value.head?.ref === "string" ? value.head.ref : null,
    headSha: typeof value.head?.sha === "string" ? value.head.sha : null,
    htmlUrl: typeof value.html_url === "string" ? value.html_url : null,
    id: typeof value.id === "number" ? value.id : null,
    nodeId: typeof value.node_id === "string" ? value.node_id : null,
    number: typeof value.number === "number" ? value.number : null,
    state: typeof value.state === "string" ? value.state : null,
    title: typeof value.title === "string" ? value.title : "",
  }
}

function readState(arguments_: Record<string, unknown>) {
  const value = readOptionalString(arguments_, "state")

  return value === "open" || value === "closed" || value === "all"
    ? value
    : "open"
}

function readStringArray(arguments_: Record<string, unknown>, key: string) {
  const value = arguments_[key]

  return Array.isArray(value)
    ? value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean)
    : []
}

function readBoolean(arguments_: Record<string, unknown>, key: string) {
  const value = arguments_[key]

  return typeof value === "boolean" ? value : undefined
}

function readPullRequestScope(input: {
  arguments: Record<string, unknown>
  commandKey: string
  context: Parameters<IntegrationCommandExecute>[0]["context"]
}) {
  const owner = readRequiredString(input.arguments, "owner", input.commandKey)
  const repo = readRequiredString(input.arguments, "repo", input.commandKey)

  return {
    auth: requireGitHubAuth(input.context),
    owner,
    repo,
  }
}

async function requirePullRequestRepository(input: {
  commandKey: string
  context: Parameters<IntegrationCommandExecute>[0]["context"]
  owner: string
  repo: string
}) {
  return requireSelectedRepository({
    commandKey: input.commandKey,
    context: input.context,
    owner: input.owner,
    repo: input.repo,
  })
}

async function getPullRequest(input: {
  auth: GitHubCommandAuth
  number: number
  owner: string
  repo: string
}) {
  return (await githubJsonRequest({
    auth: input.auth,
    method: "GET",
    path: `${repoPath(input.owner, input.repo)}/pulls/${input.number}`,
  })) as GitHubPullRequestResponse
}

export const executeGitHubPullRequestList: IntegrationCommandExecute = async ({
  arguments: arguments_,
  context,
}) => {
  const commandKey = "pull_request.list"
  const { auth, owner, repo } = readPullRequestScope({
    arguments: arguments_,
    commandKey,
    context,
  })
  const repository = await requirePullRequestRepository({
    commandKey,
    context,
    owner,
    repo,
  })
  const pullRequests = (await githubJsonRequest({
    auth,
    method: "GET",
    path: `${repoPath(owner, repo)}/pulls?state=${readState(arguments_)}&per_page=${readLimit(arguments_)}`,
  })) as GitHubPullRequestResponse[]

  return {
    pullRequests: Array.isArray(pullRequests)
      ? pullRequests.map(normalizePullRequest)
      : [],
    repository,
    total: Array.isArray(pullRequests) ? pullRequests.length : 0,
  }
}

export const executeGitHubPullRequestGet: IntegrationCommandExecute = async ({
  arguments: arguments_,
  context,
}) => {
  const commandKey = "pull_request.get"
  const { auth, owner, repo } = readPullRequestScope({
    arguments: arguments_,
    commandKey,
    context,
  })
  const number = readRequiredInteger(arguments_, "number", commandKey)
  const repository = await requirePullRequestRepository({
    commandKey,
    context,
    owner,
    repo,
  })
  const pullRequest = await getPullRequest({ auth, number, owner, repo })

  return {
    pullRequest: normalizePullRequest(pullRequest),
    repository,
  }
}

export const executeGitHubPullRequestListFiles: IntegrationCommandExecute =
  async ({ arguments: arguments_, context }) => {
    const commandKey = "pull_request.list_files"
    const { auth, owner, repo } = readPullRequestScope({
      arguments: arguments_,
      commandKey,
      context,
    })
    const number = readRequiredInteger(arguments_, "number", commandKey)
    const repository = await requirePullRequestRepository({
      commandKey,
      context,
      owner,
      repo,
    })
    const files = await githubJsonRequest({
      auth,
      method: "GET",
      path: `${repoPath(owner, repo)}/pulls/${number}/files?per_page=${readLimit(arguments_)}`,
    })

    return {
      files,
      repository,
    }
  }

export const executeGitHubPullRequestListComments: IntegrationCommandExecute =
  async ({ arguments: arguments_, context }) => {
    const commandKey = "pull_request.list_comments"
    const { auth, owner, repo } = readPullRequestScope({
      arguments: arguments_,
      commandKey,
      context,
    })
    const number = readRequiredInteger(arguments_, "number", commandKey)
    const repository = await requirePullRequestRepository({
      commandKey,
      context,
      owner,
      repo,
    })
    const comments = await githubJsonRequest({
      auth,
      method: "GET",
      path: `${repoPath(owner, repo)}/issues/${number}/comments?per_page=${readLimit(arguments_)}`,
    })

    return {
      comments,
      repository,
    }
  }

export const executeGitHubPullRequestListReviews: IntegrationCommandExecute =
  async ({ arguments: arguments_, context }) => {
    const commandKey = "pull_request.list_reviews"
    const { auth, owner, repo } = readPullRequestScope({
      arguments: arguments_,
      commandKey,
      context,
    })
    const number = readRequiredInteger(arguments_, "number", commandKey)
    const repository = await requirePullRequestRepository({
      commandKey,
      context,
      owner,
      repo,
    })
    const reviews = await githubJsonRequest({
      auth,
      method: "GET",
      path: `${repoPath(owner, repo)}/pulls/${number}/reviews?per_page=${readLimit(arguments_)}`,
    })

    return {
      repository,
      reviews,
    }
  }

export const executeGitHubPullRequestListChecks: IntegrationCommandExecute =
  async ({ arguments: arguments_, context }) => {
    const commandKey = "pull_request.list_checks"
    const { auth, owner, repo } = readPullRequestScope({
      arguments: arguments_,
      commandKey,
      context,
    })
    const number = readRequiredInteger(arguments_, "number", commandKey)
    const repository = await requirePullRequestRepository({
      commandKey,
      context,
      owner,
      repo,
    })
    const pullRequest = await getPullRequest({ auth, number, owner, repo })
    const headSha =
      typeof pullRequest.head?.sha === "string" ? pullRequest.head.sha : ""

    if (!headSha) {
      throw new Error("pull_request.list_checks could not resolve the PR head SHA.")
    }

    const checks = await githubJsonRequest({
      auth,
      method: "GET",
      path: `${repoPath(owner, repo)}/commits/${encodeGitHubPathSegment(headSha)}/check-runs?per_page=${readLimit(arguments_)}`,
    })

    return {
      checks,
      headSha,
      repository,
    }
  }

export const executeGitHubPullRequestCreate: IntegrationCommandExecute =
  async ({ arguments: arguments_, context }) => {
    const commandKey = "pull_request.create"
    const { auth, owner, repo } = readPullRequestScope({
      arguments: arguments_,
      commandKey,
      context,
    })
    const title = readRequiredString(arguments_, "title", commandKey)
    const head = readRequiredString(arguments_, "head", commandKey)
    const base = readRequiredString(arguments_, "base", commandKey)
    const repository = await requirePullRequestRepository({
      commandKey,
      context,
      owner,
      repo,
    })
    const pullRequest = (await githubJsonRequest({
      auth,
      body: {
        base,
        body: readOptionalString(arguments_, "body") ?? undefined,
        draft: readBoolean(arguments_, "draft"),
        head,
        title,
      },
      method: "POST",
      path: `${repoPath(owner, repo)}/pulls`,
    })) as GitHubPullRequestResponse

    return {
      pullRequest: normalizePullRequest(pullRequest),
      repository,
    }
  }

export const executeGitHubPullRequestUpdate: IntegrationCommandExecute =
  async ({ arguments: arguments_, context }) => {
    const commandKey = "pull_request.update"
    const { auth, owner, repo } = readPullRequestScope({
      arguments: arguments_,
      commandKey,
      context,
    })
    const number = readRequiredInteger(arguments_, "number", commandKey)
    const repository = await requirePullRequestRepository({
      commandKey,
      context,
      owner,
      repo,
    })
    const pullRequest = (await githubJsonRequest({
      auth,
      body: {
        base: readOptionalString(arguments_, "base") ?? undefined,
        body: readOptionalString(arguments_, "body") ?? undefined,
        maintainer_can_modify: readBoolean(arguments_, "maintainerCanModify"),
        state: readOptionalString(arguments_, "state") ?? undefined,
        title: readOptionalString(arguments_, "title") ?? undefined,
      },
      method: "PATCH",
      path: `${repoPath(owner, repo)}/pulls/${number}`,
    })) as GitHubPullRequestResponse

    return {
      pullRequest: normalizePullRequest(pullRequest),
      repository,
    }
  }

export const executeGitHubPullRequestComment: IntegrationCommandExecute =
  async ({ arguments: arguments_, context }) => {
    const commandKey = "pull_request.comment"
    const { auth, owner, repo } = readPullRequestScope({
      arguments: arguments_,
      commandKey,
      context,
    })
    const number = readRequiredInteger(arguments_, "number", commandKey)
    const body = readRequiredString(arguments_, "body", commandKey)
    const repository = await requirePullRequestRepository({
      commandKey,
      context,
      owner,
      repo,
    })
    const comment = await githubJsonRequest({
      auth,
      body: { body },
      method: "POST",
      path: `${repoPath(owner, repo)}/issues/${number}/comments`,
    })

    return {
      comment,
      repository,
    }
  }

export const executeGitHubPullRequestUpdateComment: IntegrationCommandExecute =
  async ({ arguments: arguments_, context }) => {
    const commandKey = "pull_request.update_comment"
    const { auth, owner, repo } = readPullRequestScope({
      arguments: arguments_,
      commandKey,
      context,
    })
    const commentId = readRequiredInteger(arguments_, "commentId", commandKey)
    const body = readRequiredString(arguments_, "body", commandKey)
    const repository = await requirePullRequestRepository({
      commandKey,
      context,
      owner,
      repo,
    })
    const comment = await githubJsonRequest({
      auth,
      body: { body },
      method: "PATCH",
      path: `${repoPath(owner, repo)}/issues/comments/${commentId}`,
    })

    return {
      comment,
      repository,
    }
  }

export const executeGitHubPullRequestDeleteComment: IntegrationCommandExecute =
  async ({ arguments: arguments_, context }) => {
    const commandKey = "pull_request.delete_comment"
    const { auth, owner, repo } = readPullRequestScope({
      arguments: arguments_,
      commandKey,
      context,
    })
    const commentId = readRequiredInteger(arguments_, "commentId", commandKey)
    const repository = await requirePullRequestRepository({
      commandKey,
      context,
      owner,
      repo,
    })
    await githubJsonRequest({
      auth,
      method: "DELETE",
      path: `${repoPath(owner, repo)}/issues/comments/${commentId}`,
    })

    return {
      commentId,
      deleted: true,
      repository,
    }
  }

export const executeGitHubPullRequestClose: IntegrationCommandExecute = async ({
  arguments: arguments_,
  context,
}) => updatePullRequestState({ arguments_, context, state: "closed" })

export const executeGitHubPullRequestReopen: IntegrationCommandExecute = async ({
  arguments: arguments_,
  context,
}) => updatePullRequestState({ arguments_, context, state: "open" })

async function updatePullRequestState(input: {
  arguments_: Record<string, unknown>
  context: Parameters<IntegrationCommandExecute>[0]["context"]
  state: "closed" | "open"
}) {
  const commandKey =
    input.state === "closed" ? "pull_request.close" : "pull_request.reopen"
  const { auth, owner, repo } = readPullRequestScope({
    arguments: input.arguments_,
    commandKey,
    context: input.context,
  })
  const number = readRequiredInteger(input.arguments_, "number", commandKey)
  const repository = await requirePullRequestRepository({
    commandKey,
    context: input.context,
    owner,
    repo,
  })
  const pullRequest = (await githubJsonRequest({
    auth,
    body: { state: input.state },
    method: "PATCH",
    path: `${repoPath(owner, repo)}/pulls/${number}`,
  })) as GitHubPullRequestResponse

  return {
    pullRequest: normalizePullRequest(pullRequest),
    repository,
  }
}

export const executeGitHubPullRequestMarkReadyForReview: IntegrationCommandExecute =
  async ({ arguments: arguments_, context }) => {
    return mutatePullRequestDraftState({
      arguments_,
      context,
      commandKey: "pull_request.mark_ready_for_review",
      mutationName: "markPullRequestReadyForReview",
      resultKey: "markPullRequestReadyForReview",
    })
  }

export const executeGitHubPullRequestConvertToDraft: IntegrationCommandExecute =
  async ({ arguments: arguments_, context }) => {
    return mutatePullRequestDraftState({
      arguments_,
      context,
      commandKey: "pull_request.convert_to_draft",
      mutationName: "convertPullRequestToDraft",
      resultKey: "convertPullRequestToDraft",
    })
  }

async function mutatePullRequestDraftState(input: {
  arguments_: Record<string, unknown>
  commandKey: string
  context: Parameters<IntegrationCommandExecute>[0]["context"]
  mutationName: "convertPullRequestToDraft" | "markPullRequestReadyForReview"
  resultKey: "convertPullRequestToDraft" | "markPullRequestReadyForReview"
}) {
  const { auth, owner, repo } = readPullRequestScope({
    arguments: input.arguments_,
    commandKey: input.commandKey,
    context: input.context,
  })
  const number = readRequiredInteger(input.arguments_, "number", input.commandKey)
  const repository = await requirePullRequestRepository({
    commandKey: input.commandKey,
    context: input.context,
    owner,
    repo,
  })
  const pullRequest = await getPullRequest({ auth, number, owner, repo })
  const nodeId =
    typeof pullRequest.node_id === "string" ? pullRequest.node_id : ""

  if (!nodeId) {
    throw new Error(`${input.commandKey} could not resolve the PR node id.`)
  }

  const result = await githubJsonRequest({
    auth,
    body: {
      query: `mutation($pullRequestId: ID!) { ${input.mutationName}(input: { pullRequestId: $pullRequestId }) { pullRequest { number isDraft } } }`,
      variables: {
        pullRequestId: nodeId,
      },
    },
    method: "POST",
    path: "/graphql",
  })

  assertGraphQLResult(result)

  return {
    pullRequest: normalizePullRequest(pullRequest),
    repository,
    result,
  }
}

export const executeGitHubPullRequestRequestReview: IntegrationCommandExecute =
  async ({ arguments: arguments_, context }) => {
    const commandKey = "pull_request.request_review"
    const { auth, owner, repo } = readPullRequestScope({
      arguments: arguments_,
      commandKey,
      context,
    })
    const number = readRequiredInteger(arguments_, "number", commandKey)
    const repository = await requirePullRequestRepository({
      commandKey,
      context,
      owner,
      repo,
    })
    const requestedReviewers = await githubJsonRequest({
      auth,
      body: {
        reviewers: readStringArray(arguments_, "reviewers"),
        team_reviewers: readStringArray(arguments_, "teamReviewers"),
      },
      method: "POST",
      path: `${repoPath(owner, repo)}/pulls/${number}/requested_reviewers`,
    })

    return {
      repository,
      requestedReviewers,
    }
  }

export const executeGitHubPullRequestSubmitReview: IntegrationCommandExecute =
  async ({ arguments: arguments_, context }) => {
    const commandKey = "pull_request.submit_review"
    const { auth, owner, repo } = readPullRequestScope({
      arguments: arguments_,
      commandKey,
      context,
    })
    const number = readRequiredInteger(arguments_, "number", commandKey)
    const event = readRequiredString(arguments_, "event", commandKey)
    const repository = await requirePullRequestRepository({
      commandKey,
      context,
      owner,
      repo,
    })
    const review = await githubJsonRequest({
      auth,
      body: {
        body: readOptionalString(arguments_, "body") ?? undefined,
        event,
      },
      method: "POST",
      path: `${repoPath(owner, repo)}/pulls/${number}/reviews`,
    })

    return {
      repository,
      review,
    }
  }

export const executeGitHubPullRequestMerge: IntegrationCommandExecute = async ({
  arguments: arguments_,
  context,
}) => {
  const commandKey = "pull_request.merge"
  const { auth, owner, repo } = readPullRequestScope({
    arguments: arguments_,
    commandKey,
    context,
  })
  const number = readRequiredInteger(arguments_, "number", commandKey)
  const repository = await requirePullRequestRepository({
    commandKey,
    context,
    owner,
    repo,
  })
  const merge = await githubJsonRequest({
    auth,
    body: {
      commit_message: readOptionalString(arguments_, "commitMessage") ?? undefined,
      commit_title: readOptionalString(arguments_, "commitTitle") ?? undefined,
      merge_method: readOptionalString(arguments_, "mergeMethod") ?? undefined,
      sha: readOptionalString(arguments_, "sha") ?? undefined,
    },
    method: "PUT",
    path: `${repoPath(owner, repo)}/pulls/${number}/merge`,
  })

  return {
    merge,
    repository,
  }
}

function assertGraphQLResult(result: unknown) {
  if (
    result &&
    typeof result === "object" &&
    "errors" in result &&
    Array.isArray(result.errors) &&
    result.errors.length > 0
  ) {
    throw new Error(`GitHub GraphQL request failed: ${JSON.stringify(result.errors)}`)
  }
}
