import type {
  IntegrationDefinition,
  IntegrationRuntimeCommandDefinition,
} from "../../framework"

import {
  executeGitHubRepositoryGet,
  executeGitHubRepositoryList,
  executeGitHubRepositorySearch,
} from "./commands/repository"
import {
  executeGitHubBranchDeleteRemote,
  executeGitHubBranchGetRemote,
  executeGitHubBranchListRemote,
} from "./commands/branch"
import {
  executeGitHubPullRequestClose,
  executeGitHubPullRequestComment,
  executeGitHubPullRequestConvertToDraft,
  executeGitHubPullRequestCreate,
  executeGitHubPullRequestDeleteComment,
  executeGitHubPullRequestGet,
  executeGitHubPullRequestList,
  executeGitHubPullRequestListChecks,
  executeGitHubPullRequestListComments,
  executeGitHubPullRequestListFiles,
  executeGitHubPullRequestListReviews,
  executeGitHubPullRequestMarkReadyForReview,
  executeGitHubPullRequestMerge,
  executeGitHubPullRequestReopen,
  executeGitHubPullRequestRequestReview,
  executeGitHubPullRequestSubmitReview,
  executeGitHubPullRequestUpdate,
  executeGitHubPullRequestUpdateComment,
} from "./commands/pull-request"

const LIMIT_ARGUMENT_SCHEMA = {
  type: "integer",
  minimum: 1,
  maximum: 100,
  description: "Maximum number of results to return.",
} as const

const OWNER_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "GitHub repository owner or organization login.",
} as const

const REPO_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "GitHub repository name.",
} as const

const QUERY_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Repository search query.",
} as const

const BRANCH_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Remote branch name.",
} as const

const PR_NUMBER_ARGUMENT_SCHEMA = {
  type: "integer",
  minimum: 1,
  description: "Pull request number.",
} as const

const PR_TITLE_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Pull request title.",
} as const

const PR_BODY_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Pull request body or comment text.",
} as const

const PR_REF_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Git branch ref.",
} as const

const PR_COMMENT_ID_ARGUMENT_SCHEMA = {
  type: "integer",
  minimum: 1,
  description: "GitHub issue comment id.",
} as const

const STRING_ARRAY_ARGUMENT_SCHEMA = {
  type: "array",
  items: {
    type: "string",
    minLength: 1,
  },
} as const

function pullRequestRepositoryProperties(extra: Record<string, unknown>) {
  return {
    owner: OWNER_ARGUMENT_SCHEMA,
    repo: REPO_ARGUMENT_SCHEMA,
    ...extra,
  }
}

const repositoryListCommand: IntegrationRuntimeCommandDefinition = {
  activityPresentation: {
    kind: "read",
    title: "List repositories",
  },
  argumentsSchema: {
    additionalProperties: false,
    properties: {
      limit: LIMIT_ARGUMENT_SCHEMA,
    },
    required: [],
    type: "object",
  },
  commandKey: "repository.list",
  commandPath: ["repository", "list"],
  description: "List GitHub repositories selected for this workspace.",
  effect: "read",
  exampleArguments: {
    limit: 25,
  },
  execute: executeGitHubRepositoryList,
  inputMode: "json",
  intentKeywords: ["github repository", "repo", "list repositories"],
  label: "List repositories",
  resultMode: "json",
  usageNotes: ["Only repositories selected for this workspace are returned."],
}

const repositoryGetCommand: IntegrationRuntimeCommandDefinition = {
  activityPresentation: {
    kind: "read",
    title: "Get repository",
  },
  argumentsSchema: {
    additionalProperties: false,
    properties: {
      owner: OWNER_ARGUMENT_SCHEMA,
      repo: REPO_ARGUMENT_SCHEMA,
    },
    required: ["owner", "repo"],
    type: "object",
  },
  commandKey: "repository.get",
  commandPath: ["repository", "get"],
  description: "Read cached metadata for a GitHub repository selected for this workspace.",
  effect: "read",
  exampleArguments: {
    owner: "acme",
    repo: "web-app",
  },
  execute: executeGitHubRepositoryGet,
  inputMode: "json",
  intentKeywords: ["github repository", "repo", "get repository"],
  label: "Get repository",
  resultMode: "json",
  usageNotes: ["Only repositories selected for this workspace are available."],
}

const repositorySearchCommand: IntegrationRuntimeCommandDefinition = {
  activityPresentation: {
    kind: "search",
    title: "Search repositories",
  },
  argumentsSchema: {
    additionalProperties: false,
    properties: {
      limit: LIMIT_ARGUMENT_SCHEMA,
      query: QUERY_ARGUMENT_SCHEMA,
    },
    required: ["query"],
    type: "object",
  },
  commandKey: "repository.search",
  commandPath: ["repository", "search"],
  description: "Search GitHub repositories selected for this workspace.",
  effect: "read",
  exampleArguments: {
    limit: 10,
    query: "web",
  },
  execute: executeGitHubRepositorySearch,
  inputMode: "json",
  intentKeywords: ["github repository", "repo", "search repositories"],
  label: "Search repositories",
  resultMode: "json",
  usageNotes: ["Only repositories selected for this workspace are returned."],
}

const branchListRemoteCommand: IntegrationRuntimeCommandDefinition = {
  activityPresentation: {
    kind: "read",
    title: "List remote branches",
  },
  argumentsSchema: {
    additionalProperties: false,
    properties: {
      limit: LIMIT_ARGUMENT_SCHEMA,
      owner: OWNER_ARGUMENT_SCHEMA,
      repo: REPO_ARGUMENT_SCHEMA,
    },
    required: ["owner", "repo"],
    type: "object",
  },
  commandKey: "branch.list_remote",
  commandPath: ["branch", "list_remote"],
  description: "List remote GitHub branches for a selected repository.",
  effect: "read",
  exampleArguments: {
    limit: 25,
    owner: "acme",
    repo: "web-app",
  },
  execute: executeGitHubBranchListRemote,
  inputMode: "json",
  intentKeywords: ["github branch", "list branches", "remote branch"],
  label: "List remote branches",
  resultMode: "json",
  usageNotes: ["Only repositories selected for this workspace are available."],
}

const branchGetRemoteCommand: IntegrationRuntimeCommandDefinition = {
  activityPresentation: {
    kind: "read",
    title: "Get remote branch",
  },
  argumentsSchema: {
    additionalProperties: false,
    properties: {
      branch: BRANCH_ARGUMENT_SCHEMA,
      owner: OWNER_ARGUMENT_SCHEMA,
      repo: REPO_ARGUMENT_SCHEMA,
    },
    required: ["owner", "repo", "branch"],
    type: "object",
  },
  commandKey: "branch.get_remote",
  commandPath: ["branch", "get_remote"],
  description: "Read one remote GitHub branch for a selected repository.",
  effect: "read",
  exampleArguments: {
    branch: "main",
    owner: "acme",
    repo: "web-app",
  },
  execute: executeGitHubBranchGetRemote,
  inputMode: "json",
  intentKeywords: ["github branch", "get branch", "remote branch"],
  label: "Get remote branch",
  resultMode: "json",
  usageNotes: ["Only repositories selected for this workspace are available."],
}

const branchDeleteRemoteCommand: IntegrationRuntimeCommandDefinition = {
  activityPresentation: {
    kind: "write",
    title: "Delete remote branch",
  },
  argumentsSchema: {
    additionalProperties: false,
    properties: {
      branch: BRANCH_ARGUMENT_SCHEMA,
      owner: OWNER_ARGUMENT_SCHEMA,
      repo: REPO_ARGUMENT_SCHEMA,
    },
    required: ["owner", "repo", "branch"],
    type: "object",
  },
  commandKey: "branch.delete_remote",
  commandPath: ["branch", "delete_remote"],
  description: "Delete a non-default remote GitHub branch from a selected repository.",
  effect: "write",
  exampleArguments: {
    branch: "feature/demo",
    owner: "acme",
    repo: "web-app",
  },
  execute: executeGitHubBranchDeleteRemote,
  inputMode: "json",
  intentKeywords: ["github branch", "delete remote branch", "remove branch"],
  label: "Delete remote branch",
  resultMode: "json",
  safety: "destructive",
  usageNotes: [
    "Only repositories selected for this workspace are available.",
    "The default branch cannot be deleted.",
  ],
}

const pullRequestCommands: IntegrationRuntimeCommandDefinition[] = [
  {
    activityPresentation: { kind: "read", title: "List pull requests" },
    argumentsSchema: {
      additionalProperties: false,
      properties: pullRequestRepositoryProperties({
        limit: LIMIT_ARGUMENT_SCHEMA,
        state: {
          type: "string",
          enum: ["open", "closed", "all"],
          description: "Pull request state filter.",
        },
      }),
      required: ["owner", "repo"],
      type: "object",
    },
    commandKey: "pull_request.list",
    commandPath: ["pull_request", "list"],
    description: "List pull requests for a selected GitHub repository.",
    effect: "read",
    exampleArguments: { limit: 25, owner: "acme", repo: "web-app" },
    execute: executeGitHubPullRequestList,
    inputMode: "json",
    intentKeywords: ["github pull request", "list pull requests", "pr"],
    label: "List pull requests",
    resultMode: "json",
  },
  {
    activityPresentation: { kind: "read", title: "Get pull request" },
    argumentsSchema: {
      additionalProperties: false,
      properties: pullRequestRepositoryProperties({
        number: PR_NUMBER_ARGUMENT_SCHEMA,
      }),
      required: ["owner", "repo", "number"],
      type: "object",
    },
    commandKey: "pull_request.get",
    commandPath: ["pull_request", "get"],
    description: "Read one pull request from a selected GitHub repository.",
    effect: "read",
    exampleArguments: { number: 7, owner: "acme", repo: "web-app" },
    execute: executeGitHubPullRequestGet,
    inputMode: "json",
    intentKeywords: ["github pull request", "get pull request", "pr"],
    label: "Get pull request",
    resultMode: "json",
  },
  {
    activityPresentation: { kind: "read", title: "List pull request files" },
    argumentsSchema: {
      additionalProperties: false,
      properties: pullRequestRepositoryProperties({
        limit: LIMIT_ARGUMENT_SCHEMA,
        number: PR_NUMBER_ARGUMENT_SCHEMA,
      }),
      required: ["owner", "repo", "number"],
      type: "object",
    },
    commandKey: "pull_request.list_files",
    commandPath: ["pull_request", "list_files"],
    description: "List files changed by a pull request.",
    effect: "read",
    exampleArguments: { number: 7, owner: "acme", repo: "web-app" },
    execute: executeGitHubPullRequestListFiles,
    inputMode: "json",
    intentKeywords: ["github pull request files", "pr files"],
    label: "List pull request files",
    resultMode: "json",
  },
  {
    activityPresentation: { kind: "read", title: "List pull request comments" },
    argumentsSchema: {
      additionalProperties: false,
      properties: pullRequestRepositoryProperties({
        limit: LIMIT_ARGUMENT_SCHEMA,
        number: PR_NUMBER_ARGUMENT_SCHEMA,
      }),
      required: ["owner", "repo", "number"],
      type: "object",
    },
    commandKey: "pull_request.list_comments",
    commandPath: ["pull_request", "list_comments"],
    description: "List issue-thread comments on a pull request.",
    effect: "read",
    exampleArguments: { number: 7, owner: "acme", repo: "web-app" },
    execute: executeGitHubPullRequestListComments,
    inputMode: "json",
    intentKeywords: ["github pull request comments", "pr comments"],
    label: "List pull request comments",
    resultMode: "json",
  },
  {
    activityPresentation: { kind: "read", title: "List pull request reviews" },
    argumentsSchema: {
      additionalProperties: false,
      properties: pullRequestRepositoryProperties({
        limit: LIMIT_ARGUMENT_SCHEMA,
        number: PR_NUMBER_ARGUMENT_SCHEMA,
      }),
      required: ["owner", "repo", "number"],
      type: "object",
    },
    commandKey: "pull_request.list_reviews",
    commandPath: ["pull_request", "list_reviews"],
    description: "List reviews on a pull request.",
    effect: "read",
    exampleArguments: { number: 7, owner: "acme", repo: "web-app" },
    execute: executeGitHubPullRequestListReviews,
    inputMode: "json",
    intentKeywords: ["github pull request reviews", "pr reviews"],
    label: "List pull request reviews",
    resultMode: "json",
  },
  {
    activityPresentation: { kind: "read", title: "List pull request checks" },
    argumentsSchema: {
      additionalProperties: false,
      properties: pullRequestRepositoryProperties({
        limit: LIMIT_ARGUMENT_SCHEMA,
        number: PR_NUMBER_ARGUMENT_SCHEMA,
      }),
      required: ["owner", "repo", "number"],
      type: "object",
    },
    commandKey: "pull_request.list_checks",
    commandPath: ["pull_request", "list_checks"],
    description: "List check runs for the pull request head commit.",
    effect: "read",
    exampleArguments: { number: 7, owner: "acme", repo: "web-app" },
    execute: executeGitHubPullRequestListChecks,
    inputMode: "json",
    intentKeywords: ["github pull request checks", "pr checks", "ci status"],
    label: "List pull request checks",
    resultMode: "json",
  },
  {
    activityPresentation: { kind: "write", title: "Create pull request" },
    argumentsSchema: {
      additionalProperties: false,
      properties: pullRequestRepositoryProperties({
        base: PR_REF_ARGUMENT_SCHEMA,
        body: PR_BODY_ARGUMENT_SCHEMA,
        draft: { type: "boolean" },
        head: PR_REF_ARGUMENT_SCHEMA,
        title: PR_TITLE_ARGUMENT_SCHEMA,
      }),
      required: ["owner", "repo", "title", "head", "base"],
      type: "object",
    },
    commandKey: "pull_request.create",
    commandPath: ["pull_request", "create"],
    description: "Create a pull request in a selected GitHub repository.",
    effect: "write",
    exampleArguments: {
      base: "main",
      head: "feature/demo",
      owner: "acme",
      repo: "web-app",
      title: "Demo",
    },
    execute: executeGitHubPullRequestCreate,
    inputMode: "json",
    intentKeywords: ["github pull request", "create pr", "open pr"],
    label: "Create pull request",
    resultMode: "json",
  },
  {
    activityPresentation: { kind: "write", title: "Update pull request" },
    argumentsSchema: {
      additionalProperties: false,
      properties: pullRequestRepositoryProperties({
        base: PR_REF_ARGUMENT_SCHEMA,
        body: PR_BODY_ARGUMENT_SCHEMA,
        maintainerCanModify: { type: "boolean" },
        number: PR_NUMBER_ARGUMENT_SCHEMA,
        state: { type: "string", enum: ["open", "closed"] },
        title: PR_TITLE_ARGUMENT_SCHEMA,
      }),
      required: ["owner", "repo", "number"],
      type: "object",
    },
    commandKey: "pull_request.update",
    commandPath: ["pull_request", "update"],
    description: "Update pull request metadata.",
    effect: "write",
    exampleArguments: { number: 7, owner: "acme", repo: "web-app", title: "Demo" },
    execute: executeGitHubPullRequestUpdate,
    inputMode: "json",
    intentKeywords: ["github pull request", "update pr", "edit pr"],
    label: "Update pull request",
    resultMode: "json",
  },
  {
    activityPresentation: { kind: "write", title: "Comment on pull request" },
    argumentsSchema: {
      additionalProperties: false,
      properties: pullRequestRepositoryProperties({
        body: PR_BODY_ARGUMENT_SCHEMA,
        number: PR_NUMBER_ARGUMENT_SCHEMA,
      }),
      required: ["owner", "repo", "number", "body"],
      type: "object",
    },
    commandKey: "pull_request.comment",
    commandPath: ["pull_request", "comment"],
    description: "Add an issue-thread comment to a pull request.",
    effect: "write",
    exampleArguments: {
      body: "Looks good.",
      number: 7,
      owner: "acme",
      repo: "web-app",
    },
    execute: executeGitHubPullRequestComment,
    inputMode: "json",
    intentKeywords: ["github pull request comment", "comment on pr"],
    label: "Comment on pull request",
    resultMode: "json",
  },
  {
    activityPresentation: { kind: "write", title: "Update pull request comment" },
    argumentsSchema: {
      additionalProperties: false,
      properties: pullRequestRepositoryProperties({
        body: PR_BODY_ARGUMENT_SCHEMA,
        commentId: PR_COMMENT_ID_ARGUMENT_SCHEMA,
      }),
      required: ["owner", "repo", "commentId", "body"],
      type: "object",
    },
    commandKey: "pull_request.update_comment",
    commandPath: ["pull_request", "update_comment"],
    description: "Update a pull request issue-thread comment.",
    effect: "write",
    exampleArguments: {
      body: "Updated comment.",
      commentId: 123,
      owner: "acme",
      repo: "web-app",
    },
    execute: executeGitHubPullRequestUpdateComment,
    inputMode: "json",
    intentKeywords: ["github pull request comment", "update pr comment"],
    label: "Update pull request comment",
    resultMode: "json",
  },
  {
    activityPresentation: { kind: "write", title: "Delete pull request comment" },
    argumentsSchema: {
      additionalProperties: false,
      properties: pullRequestRepositoryProperties({
        commentId: PR_COMMENT_ID_ARGUMENT_SCHEMA,
      }),
      required: ["owner", "repo", "commentId"],
      type: "object",
    },
    commandKey: "pull_request.delete_comment",
    commandPath: ["pull_request", "delete_comment"],
    description: "Delete a pull request issue-thread comment.",
    effect: "write",
    exampleArguments: { commentId: 123, owner: "acme", repo: "web-app" },
    execute: executeGitHubPullRequestDeleteComment,
    inputMode: "json",
    intentKeywords: ["github pull request comment", "delete pr comment"],
    label: "Delete pull request comment",
    resultMode: "json",
    safety: "destructive",
  },
  {
    activityPresentation: { kind: "write", title: "Close pull request" },
    argumentsSchema: {
      additionalProperties: false,
      properties: pullRequestRepositoryProperties({
        number: PR_NUMBER_ARGUMENT_SCHEMA,
      }),
      required: ["owner", "repo", "number"],
      type: "object",
    },
    commandKey: "pull_request.close",
    commandPath: ["pull_request", "close"],
    description: "Close a pull request without merging it.",
    effect: "write",
    exampleArguments: { number: 7, owner: "acme", repo: "web-app" },
    execute: executeGitHubPullRequestClose,
    inputMode: "json",
    intentKeywords: ["github pull request", "close pr"],
    label: "Close pull request",
    resultMode: "json",
  },
  {
    activityPresentation: { kind: "write", title: "Reopen pull request" },
    argumentsSchema: {
      additionalProperties: false,
      properties: pullRequestRepositoryProperties({
        number: PR_NUMBER_ARGUMENT_SCHEMA,
      }),
      required: ["owner", "repo", "number"],
      type: "object",
    },
    commandKey: "pull_request.reopen",
    commandPath: ["pull_request", "reopen"],
    description: "Reopen a closed pull request.",
    effect: "write",
    exampleArguments: { number: 7, owner: "acme", repo: "web-app" },
    execute: executeGitHubPullRequestReopen,
    inputMode: "json",
    intentKeywords: ["github pull request", "reopen pr"],
    label: "Reopen pull request",
    resultMode: "json",
  },
  {
    activityPresentation: { kind: "write", title: "Mark ready for review" },
    argumentsSchema: {
      additionalProperties: false,
      properties: pullRequestRepositoryProperties({
        number: PR_NUMBER_ARGUMENT_SCHEMA,
      }),
      required: ["owner", "repo", "number"],
      type: "object",
    },
    commandKey: "pull_request.mark_ready_for_review",
    commandPath: ["pull_request", "mark_ready_for_review"],
    description: "Mark a draft pull request as ready for review.",
    effect: "write",
    exampleArguments: { number: 7, owner: "acme", repo: "web-app" },
    execute: executeGitHubPullRequestMarkReadyForReview,
    inputMode: "json",
    intentKeywords: ["github pull request", "ready for review", "draft pr"],
    label: "Mark ready for review",
    resultMode: "json",
  },
  {
    activityPresentation: { kind: "write", title: "Convert to draft" },
    argumentsSchema: {
      additionalProperties: false,
      properties: pullRequestRepositoryProperties({
        number: PR_NUMBER_ARGUMENT_SCHEMA,
      }),
      required: ["owner", "repo", "number"],
      type: "object",
    },
    commandKey: "pull_request.convert_to_draft",
    commandPath: ["pull_request", "convert_to_draft"],
    description: "Convert a pull request to draft.",
    effect: "write",
    exampleArguments: { number: 7, owner: "acme", repo: "web-app" },
    execute: executeGitHubPullRequestConvertToDraft,
    inputMode: "json",
    intentKeywords: ["github pull request", "convert to draft", "draft pr"],
    label: "Convert to draft",
    resultMode: "json",
  },
  {
    activityPresentation: { kind: "write", title: "Request pull request review" },
    argumentsSchema: {
      additionalProperties: false,
      properties: pullRequestRepositoryProperties({
        number: PR_NUMBER_ARGUMENT_SCHEMA,
        reviewers: STRING_ARRAY_ARGUMENT_SCHEMA,
        teamReviewers: STRING_ARRAY_ARGUMENT_SCHEMA,
      }),
      required: ["owner", "repo", "number"],
      type: "object",
    },
    commandKey: "pull_request.request_review",
    commandPath: ["pull_request", "request_review"],
    description: "Request user or team reviews on a pull request.",
    effect: "write",
    exampleArguments: {
      number: 7,
      owner: "acme",
      repo: "web-app",
      reviewers: ["octocat"],
    },
    execute: executeGitHubPullRequestRequestReview,
    inputMode: "json",
    intentKeywords: ["github pull request", "request review", "pr reviewers"],
    label: "Request pull request review",
    resultMode: "json",
  },
  {
    activityPresentation: { kind: "write", title: "Submit pull request review" },
    argumentsSchema: {
      additionalProperties: false,
      properties: pullRequestRepositoryProperties({
        body: PR_BODY_ARGUMENT_SCHEMA,
        event: {
          type: "string",
          enum: ["APPROVE", "REQUEST_CHANGES", "COMMENT"],
        },
        number: PR_NUMBER_ARGUMENT_SCHEMA,
      }),
      required: ["owner", "repo", "number", "event"],
      type: "object",
    },
    commandKey: "pull_request.submit_review",
    commandPath: ["pull_request", "submit_review"],
    description: "Submit an approve, request-changes, or comment review.",
    effect: "write",
    exampleArguments: {
      event: "APPROVE",
      number: 7,
      owner: "acme",
      repo: "web-app",
    },
    execute: executeGitHubPullRequestSubmitReview,
    inputMode: "json",
    intentKeywords: ["github pull request", "submit review", "approve pr"],
    label: "Submit pull request review",
    resultMode: "json",
  },
  {
    activityPresentation: { kind: "write", title: "Merge pull request" },
    argumentsSchema: {
      additionalProperties: false,
      properties: pullRequestRepositoryProperties({
        commitMessage: { type: "string", minLength: 1 },
        commitTitle: { type: "string", minLength: 1 },
        mergeMethod: { type: "string", enum: ["merge", "squash", "rebase"] },
        number: PR_NUMBER_ARGUMENT_SCHEMA,
        sha: { type: "string", minLength: 1 },
      }),
      required: ["owner", "repo", "number"],
      type: "object",
    },
    commandKey: "pull_request.merge",
    commandPath: ["pull_request", "merge"],
    description:
      "Merge a pull request and return GitHub's error message if merge is blocked.",
    effect: "write",
    exampleArguments: {
      mergeMethod: "squash",
      number: 7,
      owner: "acme",
      repo: "web-app",
    },
    execute: executeGitHubPullRequestMerge,
    inputMode: "json",
    intentKeywords: ["github pull request", "merge pr"],
    label: "Merge pull request",
    resultMode: "json",
  },
]

export const githubIntegrationDefinition: IntegrationDefinition = {
  agentCapabilities: [],
  auth: {
    kind: "github_app_installation",
  },
  categoryLabel: "Code",
  catalogDescription:
    "Connect selected GitHub repositories so the assistant can inspect code, work in branches, and prepare pull requests.",
  description:
    "Workspace-managed GitHub App integration for selected repositories, branches, pull requests, checks, and code worktrees.",
  iconSrc: "/integrations/github.svg",
  ingress: {
    endpoints: [
      {
        endpointKey: "webhook",
        label: "GitHub App webhook",
      },
    ],
    setupMode: "provider_managed",
  },
  key: "github",
  label: "GitHub",
  managementMode: "workspace_managed",
  pageDescription:
    "Connect GitHub so the assistant can inspect selected repositories, work on branches, and prepare pull requests.",
  runtimeSurface: {
    commandGroups: [
      {
        commands: [
          repositoryListCommand,
          repositoryGetCommand,
          repositorySearchCommand,
        ],
        description: "Repository discovery and checkout commands.",
        groupKey: "repository",
        groupPath: ["repository"],
        intentKeywords: ["github repository", "repo", "checkout"],
        label: "Repository",
      },
      {
        commands: [
          branchListRemoteCommand,
          branchGetRemoteCommand,
          branchDeleteRemoteCommand,
        ],
        description: "Remote branch discovery and cleanup commands.",
        groupKey: "branch",
        groupPath: ["branch"],
        intentKeywords: ["github branch", "remote branch"],
        label: "Branch",
      },
      {
        commands: pullRequestCommands,
        description: "Pull request read, update, review, comment, and merge commands.",
        groupKey: "pull_request",
        groupPath: ["pull_request"],
        intentKeywords: ["github pull request", "pr", "merge"],
        label: "Pull Request",
      },
    ],
    rootCommands: [],
    toolDescription:
      "GitHub is connected through the managed GitHub App integration. Runtime commands are only advertised after their executors are implemented.",
    toolName: "github",
  },
  settingsPath: (orgSlug) => `/${orgSlug}/settings/agent/integrations/github`,
  showInWorkspaceCatalog: true,
}
