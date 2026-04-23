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
    ],
    rootCommands: [],
    toolDescription:
      "GitHub is connected through the managed GitHub App integration. Runtime commands are only advertised after their executors are implemented.",
    toolName: "github",
  },
  settingsPath: (orgSlug) => `/${orgSlug}/settings/agent/integrations/github`,
  showInWorkspaceCatalog: true,
}
