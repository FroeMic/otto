import type {
  IntegrationCommandActivityPresentationKind,
  IntegrationCommandDefinition,
  IntegrationCommandEffect,
  IntegrationCommandSafety,
  IntegrationDefinition,
  IntegrationRuntimeCommandDefinition,
  IntegrationRuntimeCommandGroupDefinition,
} from "../../framework"

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

const BRANCH_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Git branch name.",
} as const

const SHA_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 7,
  description: "Git commit SHA.",
} as const

const QUERY_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Search query.",
} as const

const LIMIT_ARGUMENT_SCHEMA = {
  type: "integer",
  minimum: 1,
  maximum: 100,
  description: "Maximum number of results to return.",
} as const

const PATH_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Repository-relative file or directory path.",
} as const

const CONFIRM_ARGUMENT_SCHEMA = {
  type: "boolean",
  const: true,
  description: "Must be true to confirm the GitHub write operation.",
} as const

const CHANGE_REASON_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Why this GitHub write operation is being performed.",
} as const

const PR_NUMBER_ARGUMENT_SCHEMA = {
  type: "integer",
  minimum: 1,
  description: "GitHub pull request number.",
} as const

const COMMENT_ID_ARGUMENT_SCHEMA = {
  type: "integer",
  minimum: 1,
  description: "GitHub comment id.",
} as const

const BODY_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Markdown body.",
} as const

type CommandSpec = {
  description: string
  effect?: IntegrationCommandEffect
  exampleArguments?: Record<string, unknown>
  extraProperties?: Record<string, Record<string, unknown>>
  groupKey: string
  intentKeywords?: string[]
  key: string
  label: string
  required?: string[]
  safety?: IntegrationCommandSafety
}

function notImplemented(commandKey: string) {
  return async () => {
    throw new Error(
      `GitHub command ${commandKey} is registered but not implemented yet.`,
    )
  }
}

function buildArgumentsSchema(input: {
  effect: IntegrationCommandEffect
  extraProperties?: Record<string, Record<string, unknown>>
  required?: string[]
}) {
  const properties: Record<string, Record<string, unknown>> = {
    owner: OWNER_ARGUMENT_SCHEMA,
    repo: REPO_ARGUMENT_SCHEMA,
    ...(input.extraProperties ?? {}),
  }
  const required = ["owner", "repo", ...(input.required ?? [])]

  if (input.effect === "write") {
    properties.confirm = CONFIRM_ARGUMENT_SCHEMA
    properties.changeReason = CHANGE_REASON_ARGUMENT_SCHEMA
    required.push("confirm", "changeReason")
  }

  return {
    type: "object",
    additionalProperties: false,
    properties,
    required,
  } as const
}

function buildCommand(spec: CommandSpec): IntegrationRuntimeCommandDefinition {
  const effect = spec.effect ?? "read"
  const commandKey = `${spec.groupKey}.${spec.key}`

  return {
    activityPresentation: {
      kind: effect === "write" ? "write" : getReadActivityKind(spec.groupKey),
      title: spec.label,
    },
    argumentsSchema: buildArgumentsSchema({
      effect,
      extraProperties: spec.extraProperties,
      required: spec.required,
    }),
    commandKey,
    commandPath: [spec.groupKey, spec.key],
    description: spec.description,
    effect,
    exampleArguments: spec.exampleArguments ?? {
      owner: "acme",
      repo: "web-app",
    },
    inputMode: "json",
    intentKeywords: spec.intentKeywords,
    label: spec.label,
    resultMode: "json",
    safety: spec.safety,
    usageNotes:
      effect === "write"
        ? [
            "GitHub writes require confirm=true and a non-empty changeReason.",
            "Commands only operate on repositories selected for this workspace.",
          ]
        : [
            "Commands only operate on repositories selected for this workspace.",
          ],
    execute: notImplemented(commandKey),
  }
}

function getReadActivityKind(
  groupKey: string,
): IntegrationCommandActivityPresentationKind {
  if (groupKey === "repository" || groupKey === "branch") {
    return "read"
  }

  return "search"
}

function group(input: {
  commands: IntegrationRuntimeCommandDefinition[]
  description: string
  groupKey: string
  intentKeywords: string[]
  label: string
}): IntegrationRuntimeCommandGroupDefinition {
  return {
    commands: input.commands,
    description: input.description,
    groupKey: input.groupKey,
    groupPath: [input.groupKey],
    intentKeywords: input.intentKeywords,
    label: input.label,
  }
}

const repositoryCommands = [
  buildCommand({
    description: "List repositories selected for this workspace.",
    extraProperties: {
      limit: LIMIT_ARGUMENT_SCHEMA,
    },
    groupKey: "repository",
    key: "list",
    label: "List repositories",
    required: [],
  }),
  buildCommand({
    description: "Read repository metadata for a selected GitHub repository.",
    groupKey: "repository",
    key: "get",
    label: "Get repository",
  }),
  buildCommand({
    description: "Search selected GitHub repositories by name or metadata.",
    extraProperties: {
      query: QUERY_ARGUMENT_SCHEMA,
      limit: LIMIT_ARGUMENT_SCHEMA,
    },
    groupKey: "repository",
    key: "search",
    label: "Search repositories",
    required: ["query"],
  }),
  buildCommand({
    description: "List files and directories in a selected repository tree.",
    extraProperties: {
      path: PATH_ARGUMENT_SCHEMA,
      ref: BRANCH_ARGUMENT_SCHEMA,
    },
    groupKey: "repository",
    key: "list_tree",
    label: "List repository tree",
  }),
  buildCommand({
    description: "Read a bounded file from a selected GitHub repository.",
    extraProperties: {
      path: PATH_ARGUMENT_SCHEMA,
      ref: BRANCH_ARGUMENT_SCHEMA,
    },
    groupKey: "repository",
    key: "get_file",
    label: "Get repository file",
    required: ["path"],
  }),
  buildCommand({
    description: "Compare two refs in a selected repository.",
    extraProperties: {
      base: BRANCH_ARGUMENT_SCHEMA,
      head: BRANCH_ARGUMENT_SCHEMA,
    },
    groupKey: "repository",
    key: "compare",
    label: "Compare repository refs",
    required: ["base", "head"],
  }),
  buildCommand({
    description:
      "Check out a selected repository into the dedicated runtime repository root.",
    extraProperties: {
      ref: BRANCH_ARGUMENT_SCHEMA,
    },
    groupKey: "repository",
    key: "checkout",
    label: "Checkout repository",
  }),
  buildCommand({
    description:
      "Fetch updates for a checked-out repository without exposing GitHub credentials.",
    groupKey: "repository",
    key: "fetch",
    label: "Fetch repository",
  }),
  buildCommand({
    description:
      "Fast-forward pull a checked-out repository branch without exposing GitHub credentials.",
    extraProperties: {
      branch: BRANCH_ARGUMENT_SCHEMA,
    },
    groupKey: "repository",
    key: "pull",
    label: "Pull repository",
  }),
  buildCommand({
    description: "Read local status for a checked-out repository worktree.",
    groupKey: "repository",
    key: "status",
    label: "Read repository status",
  }),
  buildCommand({
    description: "Read a bounded diff for a checked-out repository worktree.",
    groupKey: "repository",
    key: "diff",
    label: "Read repository diff",
  }),
  buildCommand({
    description:
      "Commit current worktree changes after explicit confirmation and change reason.",
    effect: "write",
    extraProperties: {
      message: {
        type: "string",
        minLength: 1,
        description: "Commit message.",
      },
    },
    groupKey: "repository",
    key: "commit",
    label: "Commit repository changes",
    required: ["message"],
    safety: "destructive",
  }),
  buildCommand({
    description:
      "Clean up a checked-out repository worktree, optionally discarding local changes after confirmation.",
    effect: "write",
    extraProperties: {
      discardChanges: {
        type: "boolean",
        description: "Whether to discard uncommitted local worktree changes.",
      },
    },
    groupKey: "repository",
    key: "cleanup_worktree",
    label: "Clean up repository worktree",
    safety: "destructive",
  }),
]

const branchCommands = [
  buildCommand({
    description: "List branches in a selected repository.",
    extraProperties: {
      limit: LIMIT_ARGUMENT_SCHEMA,
    },
    groupKey: "branch",
    key: "list",
    label: "List branches",
  }),
  buildCommand({
    description: "Read branch metadata from a selected repository.",
    extraProperties: {
      branch: BRANCH_ARGUMENT_SCHEMA,
    },
    groupKey: "branch",
    key: "get",
    label: "Get branch",
    required: ["branch"],
  }),
  buildCommand({
    description: "Compare two branches or refs in a selected repository.",
    extraProperties: {
      base: BRANCH_ARGUMENT_SCHEMA,
      head: BRANCH_ARGUMENT_SCHEMA,
    },
    groupKey: "branch",
    key: "compare",
    label: "Compare branches",
    required: ["base", "head"],
  }),
  buildCommand({
    description: "Checkout a branch in the local runtime repository worktree.",
    extraProperties: {
      branch: BRANCH_ARGUMENT_SCHEMA,
    },
    groupKey: "branch",
    key: "checkout",
    label: "Checkout branch",
    required: ["branch"],
  }),
  buildCommand({
    description: "Fast-forward pull a branch in the local runtime worktree.",
    extraProperties: {
      branch: BRANCH_ARGUMENT_SCHEMA,
    },
    groupKey: "branch",
    key: "pull",
    label: "Pull branch",
    required: ["branch"],
  }),
  buildCommand({
    description:
      "Create a branch from an explicit base branch or commit SHA after confirmation.",
    effect: "write",
    extraProperties: {
      base: BRANCH_ARGUMENT_SCHEMA,
      branch: BRANCH_ARGUMENT_SCHEMA,
    },
    groupKey: "branch",
    key: "create",
    label: "Create branch",
    required: ["base", "branch"],
  }),
  buildCommand({
    description:
      "Push an assistant-created or explicitly adopted branch after confirmation.",
    effect: "write",
    extraProperties: {
      branch: BRANCH_ARGUMENT_SCHEMA,
    },
    groupKey: "branch",
    key: "push",
    label: "Push branch",
    required: ["branch"],
    safety: "destructive",
  }),
  buildCommand({
    description:
      "Delete an assistant-created branch after exact branch confirmation.",
    effect: "write",
    extraProperties: {
      branch: BRANCH_ARGUMENT_SCHEMA,
    },
    groupKey: "branch",
    key: "delete",
    label: "Delete branch",
    required: ["branch"],
    safety: "destructive",
  }),
]

const pullRequestCommands = [
  buildCommand({
    description: "List pull requests in a selected repository.",
    extraProperties: {
      limit: LIMIT_ARGUMENT_SCHEMA,
      state: {
        type: "string",
        enum: ["open", "closed", "all"],
        description: "Pull request state filter.",
      },
    },
    groupKey: "pull_request",
    key: "list",
    label: "List pull requests",
  }),
  buildCommand({
    description: "Search pull requests in selected GitHub repositories.",
    extraProperties: {
      query: QUERY_ARGUMENT_SCHEMA,
      limit: LIMIT_ARGUMENT_SCHEMA,
    },
    groupKey: "pull_request",
    key: "search",
    label: "Search pull requests",
    required: ["query"],
  }),
  ...[
    ["get", "Get pull request", "Read pull request metadata."],
    ["list_files", "List pull request files", "List changed files for a pull request."],
    ["list_reviews", "List pull request reviews", "List reviews for a pull request."],
    ["list_comments", "List pull request comments", "List comments for a pull request."],
    ["list_checks", "List pull request checks", "List checks for a pull request."],
  ].map(([key, label, description]) =>
    buildCommand({
      description,
      extraProperties: {
        number: PR_NUMBER_ARGUMENT_SCHEMA,
      },
      groupKey: "pull_request",
      key,
      label,
      required: ["number"],
    }),
  ),
  buildCommand({
    description:
      "Create a draft pull request from an assistant-created or explicitly adopted branch after confirmation.",
    effect: "write",
    extraProperties: {
      base: BRANCH_ARGUMENT_SCHEMA,
      body: BODY_ARGUMENT_SCHEMA,
      draft: {
        type: "boolean",
        description: "Whether to create the pull request as a draft.",
      },
      head: BRANCH_ARGUMENT_SCHEMA,
      title: {
        type: "string",
        minLength: 1,
        description: "Pull request title.",
      },
    },
    groupKey: "pull_request",
    key: "create",
    label: "Create pull request",
    required: ["base", "head", "title"],
  }),
  ...[
    ["update", "Update pull request", "Update pull request title, body, or base branch."],
    ["close", "Close pull request", "Close a pull request."],
    ["reopen", "Reopen pull request", "Reopen a closed pull request."],
    [
      "mark_ready_for_review",
      "Mark pull request ready",
      "Mark a draft pull request ready for review.",
    ],
    [
      "convert_to_draft",
      "Convert pull request to draft",
      "Convert a pull request back to draft.",
    ],
  ].map(([key, label, description]) =>
    buildCommand({
      description,
      effect: "write",
      extraProperties: {
        number: PR_NUMBER_ARGUMENT_SCHEMA,
      },
      groupKey: "pull_request",
      key,
      label,
      required: ["number"],
    }),
  ),
  ...[
    ["comment", "Comment on pull request", "Create a pull request comment."],
    [
      "update_comment",
      "Update pull request comment",
      "Update a pull request comment.",
    ],
    [
      "delete_comment",
      "Delete pull request comment",
      "Delete a pull request comment.",
    ],
  ].map(([key, label, description]) =>
    buildCommand({
      description,
      effect: "write",
      extraProperties: {
        body: BODY_ARGUMENT_SCHEMA,
        commentId: COMMENT_ID_ARGUMENT_SCHEMA,
        number: PR_NUMBER_ARGUMENT_SCHEMA,
      },
      groupKey: "pull_request",
      key,
      label,
      required:
        key === "comment" ? ["number", "body"] : ["number", "commentId"],
    }),
  ),
  buildCommand({
    description: "Request review from users or teams on a pull request.",
    effect: "write",
    extraProperties: {
      number: PR_NUMBER_ARGUMENT_SCHEMA,
      reviewers: {
        type: "array",
        items: {
          type: "string",
          minLength: 1,
        },
        description: "GitHub usernames to request as reviewers.",
      },
      teamReviewers: {
        type: "array",
        items: {
          type: "string",
          minLength: 1,
        },
        description: "GitHub team slugs to request as reviewers.",
      },
    },
    groupKey: "pull_request",
    key: "request_review",
    label: "Request pull request review",
    required: ["number"],
  }),
  buildCommand({
    description: "Submit a pull request review.",
    effect: "write",
    extraProperties: {
      body: BODY_ARGUMENT_SCHEMA,
      event: {
        type: "string",
        enum: ["APPROVE", "COMMENT", "REQUEST_CHANGES"],
        description: "Review event.",
      },
      number: PR_NUMBER_ARGUMENT_SCHEMA,
    },
    groupKey: "pull_request",
    key: "submit_review",
    label: "Submit pull request review",
    required: ["body", "event", "number"],
  }),
  buildCommand({
    description:
      "Merge a pull request after exact head SHA, passing checks, confirmation, and change reason.",
    effect: "write",
    extraProperties: {
      expectedHeadSha: SHA_ARGUMENT_SCHEMA,
      mergeMethod: {
        type: "string",
        enum: ["merge", "squash", "rebase"],
        description: "GitHub merge method.",
      },
      number: PR_NUMBER_ARGUMENT_SCHEMA,
    },
    groupKey: "pull_request",
    key: "merge",
    label: "Merge pull request",
    required: ["expectedHeadSha", "mergeMethod", "number"],
    safety: "destructive",
  }),
]

const issueCommands = [
  ...[
    ["search", "Search issues", "Search issues in selected repositories."],
    ["get", "Get issue", "Read issue metadata."],
    ["list_comments", "List issue comments", "List comments for an issue."],
  ].map(([key, label, description]) =>
    buildCommand({
      description,
      extraProperties:
        key === "search"
          ? {
              query: QUERY_ARGUMENT_SCHEMA,
            }
          : {
              number: {
                type: "integer",
                minimum: 1,
                description: "GitHub issue number.",
              },
            },
      groupKey: "issue",
      key,
      label,
      required: [key === "search" ? "query" : "number"],
    }),
  ),
  ...[
    ["create", "Create issue", "Create an issue."],
    ["comment", "Comment on issue", "Create an issue comment."],
    ["update", "Update issue", "Update issue title or body."],
    ["close", "Close issue", "Close an issue."],
    ["reopen", "Reopen issue", "Reopen an issue."],
    ["add_labels", "Add issue labels", "Add labels to an issue."],
    ["remove_labels", "Remove issue labels", "Remove labels from an issue."],
  ].map(([key, label, description]) =>
    buildCommand({
      description,
      effect: "write",
      extraProperties: {
        body: BODY_ARGUMENT_SCHEMA,
        number: {
          type: "integer",
          minimum: 1,
          description: "GitHub issue number.",
        },
        title: {
          type: "string",
          minLength: 1,
          description: "Issue title.",
        },
      },
      groupKey: "issue",
      key,
      label,
    }),
  ),
]

export const githubIntegrationDefinition: IntegrationDefinition = {
  agentCapabilities: [],
  auth: {
    kind: "github_app_installation",
  },
  categoryLabel: "Code",
  catalogDescription:
    "Connect selected GitHub repositories so Otto can inspect code, work in branches, and prepare pull requests.",
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
    "Connect GitHub so Otto can inspect selected repositories, work on branches, and prepare pull requests.",
  runtimeSurface: {
    commandGroups: [
      group({
        commands: repositoryCommands,
        description:
          "Repository discovery, file reads, and runtime worktree lifecycle commands.",
        groupKey: "repository",
        intentKeywords: ["github repository", "repo", "checkout", "commit"],
        label: "Repository",
      }),
      group({
        commands: branchCommands,
        description:
          "Branch listing, checkout, pull, creation, push, and deletion commands.",
        groupKey: "branch",
        intentKeywords: ["github branch", "checkout branch", "push branch"],
        label: "Branch",
      }),
      group({
        commands: pullRequestCommands,
        description:
          "Pull request discovery, comments, review, update, close, reopen, and merge commands.",
        groupKey: "pull_request",
        intentKeywords: ["github pull request", "github pr", "merge pr"],
        label: "Pull Request",
      }),
      group({
        commands: issueCommands,
        description: "Issue discovery and lower-priority issue write commands.",
        groupKey: "issue",
        intentKeywords: ["github issue", "issue comment", "issue labels"],
        label: "Issue",
      }),
    ],
    rootCommands: [],
    toolDescription:
      "Use GitHub commands to inspect selected repositories, work on branches, and prepare pull requests through Otto's managed GitHub App integration.",
    toolName: "github",
  },
  settingsPath: (orgSlug) => `/${orgSlug}/settings/agent/integrations/github`,
  showInWorkspaceCatalog: true,
}
