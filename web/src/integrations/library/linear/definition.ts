import type { IntegrationDefinition } from "@/integrations/framework/types";
import type { AgentCapabilityDirection } from "@/tools/types";

import { executeLinearIssueGet } from "./commands/issue/get";
import { executeLinearIssueList } from "./commands/issue/list";
import { executeLinearIssueSearch } from "./commands/issue/search";
import { executeLinearWorkspaceGetViewer } from "./commands/workspace/get-viewer";
import { executeLinearWorkspaceListTeams } from "./commands/workspace/list-teams";
import { executeLinearWorkspaceListUsers } from "./commands/workspace/list-users";
import { executeLinearWorkspaceListWorkflowStates } from "./commands/workspace/list-workflow-states";
import { linearOAuthProvider } from "./oauth/provider";
import { LinearIntegrationListItem } from "./ui/list-item";

const LIMIT_ARGUMENT_SCHEMA = {
  type: "integer",
  minimum: 1,
  maximum: 100,
  description: "Maximum number of results to return.",
} as const;

export const linearIntegrationDefinition: IntegrationDefinition = {
  agentCapabilities: [
    buildCapability({
      description:
        "Read the current workspace user, teams, users, and workflow states from Linear.",
      direction: "read",
      key: "workspace.read",
      label: "Read workspace metadata",
    }),
    buildCapability({
      description:
        "Search and inspect issues across Linear projects, teams, assignees, and states.",
      direction: "read",
      key: "issue.read",
      label: "Read issues",
    }),
  ],
  categoryLabel: "Product Management",
  catalogDescription:
    "Connect Linear so Otto can inspect your workspace, search issue work, and summarize relevant issue context.",
  description:
    "Workspace-managed Linear connection for workspace metadata, issue search, and issue context reads.",
  iconSrc: "/integrations/linear.svg",
  key: "linear",
  label: "Linear",
  oauth: {
    provider: linearOAuthProvider,
  },
  pageDescription:
    "Connect Linear so Otto can inspect your workspace, search issue work, and summarize issue context for your team.",
  runtimeSurface: {
    commandGroups: [
      {
        commands: [
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {},
            },
            commandKey: "workspace.get_viewer",
            commandPath: ["workspace", "get_viewer"],
            description:
              "Read the authenticated Linear user profile for the connected workspace.",
            exampleArguments: {},
            inputMode: "json",
            intentKeywords: ["linear", "viewer", "me", "workspace", "profile"],
            label: "Get viewer",
            resultMode: "json",
            usageNotes: [
              "Use this to confirm which Linear account the workspace is connected with.",
            ],
            execute: executeLinearWorkspaceGetViewer,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                limit: LIMIT_ARGUMENT_SCHEMA,
              },
            },
            commandKey: "workspace.list_teams",
            commandPath: ["workspace", "list_teams"],
            description:
              "List teams visible in the connected Linear workspace.",
            exampleArguments: {
              limit: 25,
            },
            inputMode: "json",
            intentKeywords: ["linear", "workspace", "teams", "squads"],
            label: "List teams",
            resultMode: "json",
            usageNotes: [
              "Use this when you need canonical team keys before narrowing issue work.",
            ],
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 25,
            }),
            execute: executeLinearWorkspaceListTeams,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                limit: LIMIT_ARGUMENT_SCHEMA,
              },
            },
            commandKey: "workspace.list_users",
            commandPath: ["workspace", "list_users"],
            description:
              "List users visible in the connected Linear workspace.",
            exampleArguments: {
              limit: 25,
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "workspace",
              "users",
              "people",
              "members",
            ],
            label: "List users",
            resultMode: "json",
            usageNotes: [
              "Use this when you need canonical assignee names or emails.",
            ],
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 25,
            }),
            execute: executeLinearWorkspaceListUsers,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                limit: {
                  ...LIMIT_ARGUMENT_SCHEMA,
                  maximum: 200,
                },
              },
            },
            commandKey: "workspace.list_workflow_states",
            commandPath: ["workspace", "list_workflow_states"],
            description:
              "List workflow states across teams in the connected Linear workspace.",
            exampleArguments: {
              limit: 50,
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "workflow",
              "states",
              "status",
              "backlog",
              "triage",
            ],
            label: "List workflow states",
            resultMode: "json",
            usageNotes: [
              "Use this when you need the canonical team-specific workflow states before filtering or updating issues.",
            ],
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 50,
            }),
            execute: executeLinearWorkspaceListWorkflowStates,
          },
        ],
        description:
          "Workspace-scoped metadata and directory reads for the connected Linear workspace.",
        groupKey: "workspace",
        groupPath: ["workspace"],
        intentKeywords: ["linear", "workspace", "metadata", "teams", "users"],
        label: "Workspace",
      },
      {
        commands: [
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                identifierOrId: {
                  type: "string",
                  minLength: 1,
                  description:
                    "Issue identifier like ENG-123 or a Linear issue id.",
                },
              },
              required: ["identifierOrId"],
            },
            commandKey: "issue.get",
            commandPath: ["issue", "get"],
            description:
              "Read one Linear issue by identifier or id and return normalized issue context.",
            exampleArguments: {
              identifierOrId: "INT-6",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "issue",
              "ticket",
              "get issue",
              "read issue",
            ],
            label: "Get issue",
            resultMode: "json",
            usageNotes: [
              "Prefer issue identifiers like ENG-123 when you know them.",
            ],
            validate: (argumentsObject) => ({
              identifierOrId:
                typeof argumentsObject.identifierOrId === "string"
                  ? argumentsObject.identifierOrId.trim()
                  : "",
            }),
            execute: executeLinearIssueGet,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                limit: {
                  ...LIMIT_ARGUMENT_SCHEMA,
                  maximum: 50,
                },
              },
            },
            commandKey: "issue.list",
            commandPath: ["issue", "list"],
            description:
              "List recently updated issues from the connected Linear workspace.",
            exampleArguments: {
              limit: 10,
            },
            inputMode: "json",
            intentKeywords: ["linear", "issues", "tickets", "recent issues"],
            label: "List issues",
            resultMode: "json",
            usageNotes: ["This returns a recent slice, not a semantic search."],
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 10,
            }),
            execute: executeLinearIssueList,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                limit: {
                  ...LIMIT_ARGUMENT_SCHEMA,
                  maximum: 25,
                  description: "Maximum number of matching issues to return.",
                },
                query: {
                  type: "string",
                  minLength: 1,
                  description: "Free-text issue search query.",
                },
              },
              required: ["query"],
            },
            commandKey: "issue.search",
            commandPath: ["issue", "search"],
            description:
              "Search issues across Linear projects, teams, assignees, and states.",
            exampleArguments: {
              limit: 5,
              query: "credit",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "issue",
              "issues",
              "ticket",
              "tickets",
              "bug",
              "bugs",
              "project",
              "projects",
              "backlog",
              "roadmap",
              "credit",
              "credits",
              "search",
            ],
            label: "Search issues",
            resultMode: "json",
            usageNotes: [
              "Use free-text queries such as issue IDs, topics, project names, or owner names.",
              "A query with no results is valid and returns an empty items array.",
              "Example query: credit",
            ],
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 10,
              query:
                typeof argumentsObject.query === "string"
                  ? argumentsObject.query.trim()
                  : "",
            }),
            execute: executeLinearIssueSearch,
          },
        ],
        description:
          "Issue search and issue context reads for the connected Linear workspace.",
        groupKey: "issue",
        groupPath: ["issue"],
        intentKeywords: ["linear", "issue", "issues", "tickets"],
        label: "Issues",
      },
    ],
    rootCommands: [],
    toolDescription:
      "Read Linear workspace metadata and issue context through Otto's managed integration runtime surface.",
    toolName: "linear",
  },
  settingsPath: (orgSlug) => `/${orgSlug}/integrations2/linear`,
  showInWorkspaceCatalog: true,
  ui: {
    loadDetailPage: async () =>
      (await import("./ui/page")).LinearIntegrationPage,
    overviewItem: LinearIntegrationListItem,
  },
};

function buildCapability(input: {
  description: string;
  direction: AgentCapabilityDirection;
  key: string;
  label: string;
}) {
  return {
    description: input.description,
    direction: input.direction,
    key: input.key,
    label: input.label,
    source: "integration" as const,
  };
}
