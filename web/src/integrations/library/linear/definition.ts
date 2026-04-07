import type { IntegrationDefinition } from "@/integrations/framework/types";
import type { AgentCapabilityDirection } from "@/tools/types";

import { executeLinearIssueAddLabel } from "./commands/issue/add-label";
import { executeLinearIssueArchive } from "./commands/issue/archive";
import { executeLinearIssueBatchUpdate } from "./commands/issue/batch-update";
import { executeLinearIssueCreate } from "./commands/issue/create";
import { executeLinearIssueGet } from "./commands/issue/get";
import { executeLinearIssueList } from "./commands/issue/list";
import { executeLinearIssueListAttachments } from "./commands/issue/list-attachments";
import { executeLinearIssueListComments } from "./commands/issue/list-comments";
import { executeLinearIssueListDocuments } from "./commands/issue/list-documents";
import { executeLinearIssueListRelations } from "./commands/issue/list-relations";
import { executeLinearIssueRemoveLabel } from "./commands/issue/remove-label";
import { executeLinearIssueSearch } from "./commands/issue/search";
import { executeLinearIssueUpdate } from "./commands/issue/update";
import { executeLinearWorkspaceGetOrganization } from "./commands/workspace/get-organization";
import { executeLinearWorkspaceGetViewer } from "./commands/workspace/get-viewer";
import { executeLinearWorkspaceListProjectStatuses } from "./commands/workspace/list-project-statuses";
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

const IDENTIFIER_OR_ID_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Issue identifier like ENG-123 or a Linear issue id.",
} as const;

const IDENTIFIERS_OR_IDS_ARGUMENT_SCHEMA = {
  type: "array",
  minItems: 1,
  maxItems: 50,
  items: {
    type: "string",
    minLength: 1,
  },
  description:
    "Issue identifiers like ENG-123 or Linear issue ids. Maximum 50 issues at a time.",
} as const;

const TITLE_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Issue title.",
} as const;

const OPTIONAL_STRING_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
} as const;

const LABEL_IDS_ARGUMENT_SCHEMA = {
  type: "array",
  items: {
    type: "string",
    minLength: 1,
  },
  description: "List of Linear issue label ids.",
} as const;

const PRIORITY_ARGUMENT_SCHEMA = {
  type: "integer",
  minimum: 0,
  maximum: 4,
  description:
    "Issue priority where 0 = none, 1 = urgent, 2 = high, 3 = medium, 4 = low.",
} as const;

export const linearIntegrationDefinition: IntegrationDefinition = {
  agentCapabilities: [
    buildCapability({
      description:
        "Read the current workspace user, organization, teams, users, workflow states, and project statuses from Linear.",
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
    buildCapability({
      description:
        "Create, update, archive, and relabel issues in the connected Linear workspace.",
      direction: "tool",
      key: "issue.write",
      label: "Write issues",
    }),
  ],
  categoryLabel: "Product Management",
  catalogDescription:
    "Connect Linear so Otto can inspect your workspace, search issue work, and create or update issue context when needed.",
  description:
    "Workspace-managed Linear connection for workspace metadata plus issue reads and writes.",
  iconSrc: "/integrations/linear.svg",
  key: "linear",
  label: "Linear",
  oauth: {
    provider: linearOAuthProvider,
  },
  pageDescription:
    "Connect Linear so Otto can inspect your workspace, search issue work, and create or update issues for your team.",
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
              properties: {},
            },
            commandKey: "workspace.get_organization",
            commandPath: ["workspace", "get_organization"],
            description:
              "Read organization-level metadata for the connected Linear workspace.",
            exampleArguments: {},
            inputMode: "json",
            intentKeywords: [
              "linear",
              "organization",
              "workspace",
              "org",
              "settings",
            ],
            label: "Get organization",
            resultMode: "json",
            usageNotes: [
              "Use this when you need organization-level context such as the workspace url key or project-status count.",
            ],
            execute: executeLinearWorkspaceGetOrganization,
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
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                limit: LIMIT_ARGUMENT_SCHEMA,
              },
            },
            commandKey: "workspace.list_project_statuses",
            commandPath: ["workspace", "list_project_statuses"],
            description:
              "List project statuses across the connected Linear workspace.",
            exampleArguments: {
              limit: 25,
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "project",
              "statuses",
              "project status",
              "roadmap",
            ],
            label: "List project statuses",
            resultMode: "json",
            usageNotes: [
              "Use this when you need the canonical project lifecycle states before reading or updating projects.",
            ],
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 25,
            }),
            execute: executeLinearWorkspaceListProjectStatuses,
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
                identifierOrId: IDENTIFIER_OR_ID_ARGUMENT_SCHEMA,
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
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                identifierOrId: IDENTIFIER_OR_ID_ARGUMENT_SCHEMA,
                limit: LIMIT_ARGUMENT_SCHEMA,
              },
              required: ["identifierOrId"],
            },
            commandKey: "issue.list_comments",
            commandPath: ["issue", "list_comments"],
            description: "List comments on one Linear issue.",
            exampleArguments: {
              identifierOrId: "INT-6",
              limit: 25,
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "issue",
              "comments",
              "thread",
              "discussion",
            ],
            label: "List issue comments",
            resultMode: "json",
            usageNotes: [
              "Use this after issue.get when you need the full discussion thread on one issue.",
            ],
            validate: (argumentsObject) => ({
              identifierOrId:
                typeof argumentsObject.identifierOrId === "string"
                  ? argumentsObject.identifierOrId.trim()
                  : "",
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 25,
            }),
            execute: executeLinearIssueListComments,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                identifierOrId: IDENTIFIER_OR_ID_ARGUMENT_SCHEMA,
                limit: LIMIT_ARGUMENT_SCHEMA,
              },
              required: ["identifierOrId"],
            },
            commandKey: "issue.list_attachments",
            commandPath: ["issue", "list_attachments"],
            description: "List attachments on one Linear issue.",
            exampleArguments: {
              identifierOrId: "INT-6",
              limit: 25,
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "issue",
              "attachments",
              "links",
              "files",
            ],
            label: "List issue attachments",
            resultMode: "json",
            usageNotes: [
              "Use this when an issue is likely linked to customer tickets, PRs, or uploaded assets.",
            ],
            validate: (argumentsObject) => ({
              identifierOrId:
                typeof argumentsObject.identifierOrId === "string"
                  ? argumentsObject.identifierOrId.trim()
                  : "",
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 25,
            }),
            execute: executeLinearIssueListAttachments,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                identifierOrId: IDENTIFIER_OR_ID_ARGUMENT_SCHEMA,
                limit: LIMIT_ARGUMENT_SCHEMA,
              },
              required: ["identifierOrId"],
            },
            commandKey: "issue.list_documents",
            commandPath: ["issue", "list_documents"],
            description: "List documents linked to one Linear issue.",
            exampleArguments: {
              identifierOrId: "INT-6",
              limit: 25,
            },
            inputMode: "json",
            intentKeywords: ["linear", "issue", "documents", "docs", "specs"],
            label: "List issue documents",
            resultMode: "json",
            usageNotes: [
              "Use this when you need related specs, RFCs, or other Linear documents linked from an issue.",
            ],
            validate: (argumentsObject) => ({
              identifierOrId:
                typeof argumentsObject.identifierOrId === "string"
                  ? argumentsObject.identifierOrId.trim()
                  : "",
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 25,
            }),
            execute: executeLinearIssueListDocuments,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                identifierOrId: IDENTIFIER_OR_ID_ARGUMENT_SCHEMA,
                limit: LIMIT_ARGUMENT_SCHEMA,
              },
              required: ["identifierOrId"],
            },
            commandKey: "issue.list_relations",
            commandPath: ["issue", "list_relations"],
            description:
              "List incoming and outgoing relations for one Linear issue.",
            exampleArguments: {
              identifierOrId: "INT-6",
              limit: 25,
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "issue",
              "relations",
              "dependencies",
              "blocked",
            ],
            label: "List issue relations",
            resultMode: "json",
            usageNotes: [
              "This includes both outgoing relations and inverse relations so dependency context is complete.",
            ],
            validate: (argumentsObject) => ({
              identifierOrId:
                typeof argumentsObject.identifierOrId === "string"
                  ? argumentsObject.identifierOrId.trim()
                  : "",
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 25,
            }),
            execute: executeLinearIssueListRelations,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                assigneeId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description:
                    "Optional Linear user id to assign the issue to.",
                },
                cycleId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional Linear cycle id.",
                },
                description: {
                  type: "string",
                  description: "Optional markdown issue description.",
                },
                labelIds: LABEL_IDS_ARGUMENT_SCHEMA,
                parentId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description:
                    "Optional parent issue id or identifier accepted by Linear.",
                },
                priority: PRIORITY_ARGUMENT_SCHEMA,
                projectId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional Linear project id.",
                },
                stateId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional Linear workflow state id.",
                },
                teamId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Linear team id for the new issue.",
                },
                title: TITLE_ARGUMENT_SCHEMA,
              },
              required: ["teamId", "title"],
            },
            commandKey: "issue.create",
            commandPath: ["issue", "create"],
            description: "Create a new Linear issue.",
            exampleArguments: {
              description: "Need a workspace flow for credits tracking.",
              teamId: "team-id",
              title: "Track credits workflow",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "issue",
              "create",
              "new issue",
              "ticket",
            ],
            label: "Create issue",
            resultMode: "json",
            usageNotes: [
              "Use workspace.list_teams first if you need canonical team ids before creating the issue.",
            ],
            validate: (argumentsObject) => ({
              assigneeId:
                typeof argumentsObject.assigneeId === "string"
                  ? argumentsObject.assigneeId.trim()
                  : null,
              cycleId:
                typeof argumentsObject.cycleId === "string"
                  ? argumentsObject.cycleId.trim()
                  : null,
              description:
                typeof argumentsObject.description === "string"
                  ? argumentsObject.description
                  : null,
              labelIds: Array.isArray(argumentsObject.labelIds)
                ? argumentsObject.labelIds
                : undefined,
              parentId:
                typeof argumentsObject.parentId === "string"
                  ? argumentsObject.parentId.trim()
                  : null,
              priority:
                typeof argumentsObject.priority === "number" &&
                Number.isInteger(argumentsObject.priority)
                  ? argumentsObject.priority
                  : null,
              projectId:
                typeof argumentsObject.projectId === "string"
                  ? argumentsObject.projectId.trim()
                  : null,
              stateId:
                typeof argumentsObject.stateId === "string"
                  ? argumentsObject.stateId.trim()
                  : null,
              teamId:
                typeof argumentsObject.teamId === "string"
                  ? argumentsObject.teamId.trim()
                  : "",
              title:
                typeof argumentsObject.title === "string"
                  ? argumentsObject.title.trim()
                  : "",
            }),
            execute: executeLinearIssueCreate,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                addedLabelIds: LABEL_IDS_ARGUMENT_SCHEMA,
                assigneeId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description:
                    "Optional Linear user id to assign the issue to.",
                },
                cycleId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional Linear cycle id.",
                },
                description: {
                  type: "string",
                  description: "Optional markdown issue description.",
                },
                identifierOrId: IDENTIFIER_OR_ID_ARGUMENT_SCHEMA,
                labelIds: LABEL_IDS_ARGUMENT_SCHEMA,
                parentId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description:
                    "Optional parent issue id or identifier accepted by Linear.",
                },
                priority: PRIORITY_ARGUMENT_SCHEMA,
                projectId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional Linear project id.",
                },
                removedLabelIds: LABEL_IDS_ARGUMENT_SCHEMA,
                stateId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional Linear workflow state id.",
                },
                teamId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description:
                    "Optional Linear team id if the issue moves teams.",
                },
                title: TITLE_ARGUMENT_SCHEMA,
                trashed: {
                  type: "boolean",
                  description: "Whether the issue should be marked as trashed.",
                },
              },
              required: ["identifierOrId"],
            },
            commandKey: "issue.update",
            commandPath: ["issue", "update"],
            description: "Update an existing Linear issue.",
            exampleArguments: {
              identifierOrId: "INT-6",
              priority: 2,
              title: "Track credits workflow and billing states",
            },
            inputMode: "json",
            intentKeywords: ["linear", "issue", "update", "edit", "ticket"],
            label: "Update issue",
            resultMode: "json",
            usageNotes: [
              "This requires at least one update field besides identifierOrId.",
            ],
            validate: (argumentsObject) => ({
              addedLabelIds: Array.isArray(argumentsObject.addedLabelIds)
                ? argumentsObject.addedLabelIds
                : undefined,
              assigneeId:
                typeof argumentsObject.assigneeId === "string"
                  ? argumentsObject.assigneeId.trim()
                  : null,
              cycleId:
                typeof argumentsObject.cycleId === "string"
                  ? argumentsObject.cycleId.trim()
                  : null,
              description:
                typeof argumentsObject.description === "string"
                  ? argumentsObject.description
                  : null,
              identifierOrId:
                typeof argumentsObject.identifierOrId === "string"
                  ? argumentsObject.identifierOrId.trim()
                  : "",
              labelIds: Array.isArray(argumentsObject.labelIds)
                ? argumentsObject.labelIds
                : undefined,
              parentId:
                typeof argumentsObject.parentId === "string"
                  ? argumentsObject.parentId.trim()
                  : null,
              priority:
                typeof argumentsObject.priority === "number" &&
                Number.isInteger(argumentsObject.priority)
                  ? argumentsObject.priority
                  : null,
              projectId:
                typeof argumentsObject.projectId === "string"
                  ? argumentsObject.projectId.trim()
                  : null,
              removedLabelIds: Array.isArray(argumentsObject.removedLabelIds)
                ? argumentsObject.removedLabelIds
                : undefined,
              stateId:
                typeof argumentsObject.stateId === "string"
                  ? argumentsObject.stateId.trim()
                  : null,
              teamId:
                typeof argumentsObject.teamId === "string"
                  ? argumentsObject.teamId.trim()
                  : null,
              title:
                typeof argumentsObject.title === "string"
                  ? argumentsObject.title.trim()
                  : null,
              trashed:
                typeof argumentsObject.trashed === "boolean"
                  ? argumentsObject.trashed
                  : null,
            }),
            execute: executeLinearIssueUpdate,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                identifierOrId: IDENTIFIER_OR_ID_ARGUMENT_SCHEMA,
                trash: {
                  type: "boolean",
                  description:
                    "Whether the archived issue should also be trashed.",
                },
              },
              required: ["identifierOrId"],
            },
            commandKey: "issue.archive",
            commandPath: ["issue", "archive"],
            description: "Archive one Linear issue.",
            exampleArguments: {
              identifierOrId: "INT-6",
            },
            inputMode: "json",
            intentKeywords: ["linear", "issue", "archive", "close", "remove"],
            label: "Archive issue",
            resultMode: "json",
            usageNotes: [
              "Use trash=true only when you want the issue archived and moved to trash.",
            ],
            validate: (argumentsObject) => ({
              identifierOrId:
                typeof argumentsObject.identifierOrId === "string"
                  ? argumentsObject.identifierOrId.trim()
                  : "",
              trash:
                typeof argumentsObject.trash === "boolean"
                  ? argumentsObject.trash
                  : false,
            }),
            execute: executeLinearIssueArchive,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                addedLabelIds: LABEL_IDS_ARGUMENT_SCHEMA,
                assigneeId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description:
                    "Optional Linear user id to assign the issues to.",
                },
                cycleId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional Linear cycle id.",
                },
                description: {
                  type: "string",
                  description: "Optional markdown issue description.",
                },
                identifiersOrIds: IDENTIFIERS_OR_IDS_ARGUMENT_SCHEMA,
                labelIds: LABEL_IDS_ARGUMENT_SCHEMA,
                parentId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description:
                    "Optional parent issue id or identifier accepted by Linear.",
                },
                priority: PRIORITY_ARGUMENT_SCHEMA,
                projectId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional Linear project id.",
                },
                removedLabelIds: LABEL_IDS_ARGUMENT_SCHEMA,
                stateId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional Linear workflow state id.",
                },
                teamId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description:
                    "Optional Linear team id if the issues move teams.",
                },
                title: TITLE_ARGUMENT_SCHEMA,
                trashed: {
                  type: "boolean",
                  description:
                    "Whether the issues should be marked as trashed.",
                },
              },
              required: ["identifiersOrIds"],
            },
            commandKey: "issue.batch_update",
            commandPath: ["issue", "batch_update"],
            description: "Update up to 50 Linear issues in one batch.",
            exampleArguments: {
              identifiersOrIds: ["INT-6", "INT-7"],
              priority: 2,
            },
            inputMode: "json",
            intentKeywords: ["linear", "issue", "batch", "bulk", "update"],
            label: "Batch update issues",
            resultMode: "json",
            usageNotes: [
              "Use this for bulk priority, assignee, state, or label changes across up to 50 issues.",
            ],
            validate: (argumentsObject) => ({
              addedLabelIds: Array.isArray(argumentsObject.addedLabelIds)
                ? argumentsObject.addedLabelIds
                : undefined,
              assigneeId:
                typeof argumentsObject.assigneeId === "string"
                  ? argumentsObject.assigneeId.trim()
                  : null,
              cycleId:
                typeof argumentsObject.cycleId === "string"
                  ? argumentsObject.cycleId.trim()
                  : null,
              description:
                typeof argumentsObject.description === "string"
                  ? argumentsObject.description
                  : null,
              identifiersOrIds: Array.isArray(argumentsObject.identifiersOrIds)
                ? argumentsObject.identifiersOrIds
                : [],
              labelIds: Array.isArray(argumentsObject.labelIds)
                ? argumentsObject.labelIds
                : undefined,
              parentId:
                typeof argumentsObject.parentId === "string"
                  ? argumentsObject.parentId.trim()
                  : null,
              priority:
                typeof argumentsObject.priority === "number" &&
                Number.isInteger(argumentsObject.priority)
                  ? argumentsObject.priority
                  : null,
              projectId:
                typeof argumentsObject.projectId === "string"
                  ? argumentsObject.projectId.trim()
                  : null,
              removedLabelIds: Array.isArray(argumentsObject.removedLabelIds)
                ? argumentsObject.removedLabelIds
                : undefined,
              stateId:
                typeof argumentsObject.stateId === "string"
                  ? argumentsObject.stateId.trim()
                  : null,
              teamId:
                typeof argumentsObject.teamId === "string"
                  ? argumentsObject.teamId.trim()
                  : null,
              title:
                typeof argumentsObject.title === "string"
                  ? argumentsObject.title.trim()
                  : null,
              trashed:
                typeof argumentsObject.trashed === "boolean"
                  ? argumentsObject.trashed
                  : null,
            }),
            execute: executeLinearIssueBatchUpdate,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                identifierOrId: IDENTIFIER_OR_ID_ARGUMENT_SCHEMA,
                labelId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Linear issue label id to add to the issue.",
                },
              },
              required: ["identifierOrId", "labelId"],
            },
            commandKey: "issue.add_label",
            commandPath: ["issue", "add_label"],
            description: "Add one label to a Linear issue.",
            exampleArguments: {
              identifierOrId: "INT-6",
              labelId: "label-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "issue", "label", "tag", "add label"],
            label: "Add issue label",
            resultMode: "json",
            usageNotes: [
              "Use this when you only need to add one label without touching the rest of the issue fields.",
            ],
            validate: (argumentsObject) => ({
              identifierOrId:
                typeof argumentsObject.identifierOrId === "string"
                  ? argumentsObject.identifierOrId.trim()
                  : "",
              labelId:
                typeof argumentsObject.labelId === "string"
                  ? argumentsObject.labelId.trim()
                  : "",
            }),
            execute: executeLinearIssueAddLabel,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                identifierOrId: IDENTIFIER_OR_ID_ARGUMENT_SCHEMA,
                labelId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description:
                    "Linear issue label id to remove from the issue.",
                },
              },
              required: ["identifierOrId", "labelId"],
            },
            commandKey: "issue.remove_label",
            commandPath: ["issue", "remove_label"],
            description: "Remove one label from a Linear issue.",
            exampleArguments: {
              identifierOrId: "INT-6",
              labelId: "label-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "issue", "label", "tag", "remove label"],
            label: "Remove issue label",
            resultMode: "json",
            usageNotes: [
              "Use this when you only need to remove one label without replacing the full label set.",
            ],
            validate: (argumentsObject) => ({
              identifierOrId:
                typeof argumentsObject.identifierOrId === "string"
                  ? argumentsObject.identifierOrId.trim()
                  : "",
              labelId:
                typeof argumentsObject.labelId === "string"
                  ? argumentsObject.labelId.trim()
                  : "",
            }),
            execute: executeLinearIssueRemoveLabel,
          },
        ],
        description:
          "Issue reads and writes for the connected Linear workspace.",
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
