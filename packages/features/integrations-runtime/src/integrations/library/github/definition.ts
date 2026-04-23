import type { IntegrationDefinition } from "../../framework"

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
    commandGroups: [],
    rootCommands: [],
    toolDescription:
      "GitHub is connected through the managed GitHub App integration. Runtime commands are only advertised after their executors are implemented.",
    toolName: "github",
  },
  settingsPath: (orgSlug) => `/${orgSlug}/settings/agent/integrations/github`,
  showInWorkspaceCatalog: true,
}
