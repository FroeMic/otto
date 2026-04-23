import type {
  IntegrationDefinition,
  IntegrationRuntimeCommandDefinition,
} from "../../framework"

import {
  executeGitHubRepositoryGet,
  executeGitHubRepositoryList,
} from "./commands/repository"

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
        commands: [repositoryListCommand, repositoryGetCommand],
        description: "Repository discovery and checkout commands.",
        groupKey: "repository",
        groupPath: ["repository"],
        intentKeywords: ["github repository", "repo", "checkout"],
        label: "Repository",
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
