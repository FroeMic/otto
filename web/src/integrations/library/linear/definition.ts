import type { IntegrationDefinition } from "@/integrations/framework/types";
import type { AgentCapabilityDirection } from "@/tools/types";

import { executeLinearCommentCreate } from "./commands/comment/create";
import { executeLinearCommentDelete } from "./commands/comment/delete";
import { executeLinearCommentGet } from "./commands/comment/get";
import { executeLinearCommentList } from "./commands/comment/list";
import { executeLinearCommentUpdate } from "./commands/comment/update";
import { executeLinearCycleCreate } from "./commands/cycle/create";
import { executeLinearCycleGet } from "./commands/cycle/get";
import { executeLinearCycleList } from "./commands/cycle/list";
import { executeLinearCycleUpdate } from "./commands/cycle/update";
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
import { executeLinearProjectArchive } from "./commands/project/archive";
import { executeLinearProjectCreate } from "./commands/project/create";
import { executeLinearProjectCreateUpdate } from "./commands/project/create-update";
import { executeLinearProjectGet } from "./commands/project/get";
import { executeLinearProjectList } from "./commands/project/list";
import { executeLinearProjectListDocuments } from "./commands/project/list-documents";
import { executeLinearProjectListIssues } from "./commands/project/list-issues";
import { executeLinearProjectListLabels } from "./commands/project/list-labels";
import { executeLinearProjectListMilestones } from "./commands/project/list-milestones";
import { executeLinearProjectListUpdates } from "./commands/project/list-updates";
import { executeLinearProjectSearch } from "./commands/project/search";
import { executeLinearProjectUpdate } from "./commands/project/update";
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

const COMMENT_ID_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Linear comment id.",
} as const;

const COMMENT_BODY_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Comment body in markdown.",
} as const;

const PROJECT_ID_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Linear project id.",
} as const;

const PROJECT_NAME_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Project name.",
} as const;

const PROJECT_QUERY_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Free-text project search query.",
} as const;

const TEAM_IDS_ARGUMENT_SCHEMA = {
  type: "array",
  minItems: 1,
  items: {
    type: "string",
    minLength: 1,
  },
  description: "List of Linear team ids associated with the project.",
} as const;

const MEMBER_IDS_ARGUMENT_SCHEMA = {
  type: "array",
  items: {
    type: "string",
    minLength: 1,
  },
  description: "Optional list of Linear user ids for project members.",
} as const;

const DATE_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Timeless date in YYYY-MM-DD format.",
} as const;

const PROJECT_UPDATE_HEALTH_ARGUMENT_SCHEMA = {
  type: "string",
  enum: ["onTrack", "atRisk", "offTrack"],
  description: "Project update health state.",
} as const;

const CYCLE_ID_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Linear cycle id.",
} as const;

const DATETIME_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "ISO-8601 datetime string.",
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
    buildCapability({
      description:
        "Read and inspect comments across issue threads in the connected Linear workspace.",
      direction: "read",
      key: "comment.read",
      label: "Read comments",
    }),
    buildCapability({
      description:
        "Create, update, and delete issue-thread comments in the connected Linear workspace.",
      direction: "tool",
      key: "comment.write",
      label: "Write comments",
    }),
    buildCapability({
      description:
        "Read projects, milestones, updates, documents, labels, and related issue work in the connected Linear workspace.",
      direction: "read",
      key: "project.read",
      label: "Read projects",
    }),
    buildCapability({
      description:
        "Read cycles and sprint metadata in the connected Linear workspace.",
      direction: "read",
      key: "cycle.read",
      label: "Read cycles",
    }),
    buildCapability({
      description:
        "Create and later update or archive cycles in the connected Linear workspace.",
      direction: "tool",
      key: "cycle.write",
      label: "Write cycles",
    }),
    buildCapability({
      description:
        "Create, update, archive, and post project updates in the connected Linear workspace.",
      direction: "tool",
      key: "project.write",
      label: "Write projects",
    }),
  ],
  categoryLabel: "Product Management",
  catalogDescription:
    "Connect Linear so Otto can inspect your workspace, search issue and project work, and create or update Linear context when needed.",
  description:
    "Workspace-managed Linear connection for workspace metadata plus issue, comment, and project reads and writes.",
  iconSrc: "/integrations/linear.svg",
  key: "linear",
  label: "Linear",
  oauth: {
    provider: linearOAuthProvider,
  },
  pageDescription:
    "Connect Linear so Otto can inspect your workspace, search issue and project work, and create or update Linear records for your team.",
  runtimeSurface: {
    commandGroups: [
      {
        commands: [
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                completedAt: {
                  ...DATETIME_ARGUMENT_SCHEMA,
                  description:
                    "Optional completion datetime when creating a completed cycle.",
                },
                description: {
                  type: "string",
                  minLength: 1,
                  description: "Optional cycle description.",
                },
                endsAt: {
                  ...DATETIME_ARGUMENT_SCHEMA,
                  description: "Cycle end datetime.",
                },
                name: {
                  type: "string",
                  minLength: 1,
                  description: "Optional custom cycle name.",
                },
                startsAt: {
                  ...DATETIME_ARGUMENT_SCHEMA,
                  description: "Cycle start datetime.",
                },
                teamId: {
                  type: "string",
                  minLength: 1,
                  description: "Linear team id for the cycle.",
                },
              },
              required: ["teamId", "startsAt", "endsAt"],
            },
            commandKey: "cycle.create",
            commandPath: ["cycle", "create"],
            description: "Create a new Linear cycle.",
            exampleArguments: {
              endsAt: "2026-04-14T00:00:00.000Z",
              startsAt: "2026-04-07T00:00:00.000Z",
              teamId: "team-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "cycle", "create", "sprint"],
            label: "Create cycle",
            resultMode: "json",
            usageNotes: [
              "Use workspace.list_teams first if you need the canonical team id before creating the cycle.",
            ],
            validate: (argumentsObject) => ({
              completedAt:
                typeof argumentsObject.completedAt === "string"
                  ? argumentsObject.completedAt.trim()
                  : null,
              description:
                typeof argumentsObject.description === "string"
                  ? argumentsObject.description.trim()
                  : null,
              endsAt:
                typeof argumentsObject.endsAt === "string"
                  ? argumentsObject.endsAt.trim()
                  : "",
              name:
                typeof argumentsObject.name === "string"
                  ? argumentsObject.name.trim()
                  : null,
              startsAt:
                typeof argumentsObject.startsAt === "string"
                  ? argumentsObject.startsAt.trim()
                  : "",
              teamId:
                typeof argumentsObject.teamId === "string"
                  ? argumentsObject.teamId.trim()
                  : "",
            }),
            execute: executeLinearCycleCreate,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                completedAt: {
                  ...DATETIME_ARGUMENT_SCHEMA,
                  description: "Optional cycle completion datetime.",
                },
                cycleId: CYCLE_ID_ARGUMENT_SCHEMA,
                description: {
                  type: "string",
                  minLength: 1,
                  description: "Optional updated cycle description.",
                },
                endsAt: {
                  ...DATETIME_ARGUMENT_SCHEMA,
                  description: "Optional updated cycle end datetime.",
                },
                name: {
                  type: "string",
                  minLength: 1,
                  description: "Optional updated custom cycle name.",
                },
                startsAt: {
                  ...DATETIME_ARGUMENT_SCHEMA,
                  description: "Optional updated cycle start datetime.",
                },
              },
              required: ["cycleId"],
            },
            commandKey: "cycle.update",
            commandPath: ["cycle", "update"],
            description: "Update an existing Linear cycle.",
            exampleArguments: {
              cycleId: "cycle-id",
              description: "Updated cycle description",
            },
            inputMode: "json",
            intentKeywords: ["linear", "cycle", "update", "edit", "sprint"],
            label: "Update cycle",
            resultMode: "json",
            usageNotes: [
              "This requires at least one update field besides cycleId.",
            ],
            validate: (argumentsObject) => ({
              completedAt:
                typeof argumentsObject.completedAt === "string"
                  ? argumentsObject.completedAt.trim()
                  : null,
              cycleId:
                typeof argumentsObject.cycleId === "string"
                  ? argumentsObject.cycleId.trim()
                  : "",
              description:
                typeof argumentsObject.description === "string"
                  ? argumentsObject.description.trim()
                  : null,
              endsAt:
                typeof argumentsObject.endsAt === "string"
                  ? argumentsObject.endsAt.trim()
                  : null,
              name:
                typeof argumentsObject.name === "string"
                  ? argumentsObject.name.trim()
                  : null,
              startsAt:
                typeof argumentsObject.startsAt === "string"
                  ? argumentsObject.startsAt.trim()
                  : null,
            }),
            execute: executeLinearCycleUpdate,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                cycleId: CYCLE_ID_ARGUMENT_SCHEMA,
              },
              required: ["cycleId"],
            },
            commandKey: "cycle.get",
            commandPath: ["cycle", "get"],
            description:
              "Read one Linear cycle by cycle id and return normalized cycle context.",
            exampleArguments: {
              cycleId: "cycle-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "cycle", "sprint", "get cycle"],
            label: "Get cycle",
            resultMode: "json",
            usageNotes: [
              "Use cycle ids returned by cycle.list before reading one cycle in detail.",
            ],
            validate: (argumentsObject) => ({
              cycleId:
                typeof argumentsObject.cycleId === "string"
                  ? argumentsObject.cycleId.trim()
                  : "",
            }),
            execute: executeLinearCycleGet,
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
            commandKey: "cycle.list",
            commandPath: ["cycle", "list"],
            description:
              "List recently updated cycles from the connected Linear workspace.",
            exampleArguments: {
              limit: 10,
            },
            inputMode: "json",
            intentKeywords: ["linear", "cycle", "cycles", "sprint", "sprints"],
            label: "List cycles",
            resultMode: "json",
            usageNotes: [
              "This returns a recent slice of cycles and is useful for browsing current or recent sprint windows.",
            ],
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 10,
            }),
            execute: executeLinearCycleList,
          },
        ],
        description: "Cycle reads for the connected Linear workspace.",
        groupKey: "cycle",
        groupPath: ["cycle"],
        intentKeywords: ["linear", "cycle", "cycles", "sprint"],
        label: "Cycles",
      },
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
      {
        commands: [
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                projectId: PROJECT_ID_ARGUMENT_SCHEMA,
              },
              required: ["projectId"],
            },
            commandKey: "project.get",
            commandPath: ["project", "get"],
            description:
              "Read one Linear project by project id and return normalized project context.",
            exampleArguments: {
              projectId: "project-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "project", "roadmap", "get project"],
            label: "Get project",
            resultMode: "json",
            usageNotes: [
              "Use project ids returned by project.list or project.search.",
            ],
            validate: (argumentsObject) => ({
              projectId:
                typeof argumentsObject.projectId === "string"
                  ? argumentsObject.projectId.trim()
                  : "",
            }),
            execute: executeLinearProjectGet,
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
            commandKey: "project.list",
            commandPath: ["project", "list"],
            description:
              "List recently updated projects from the connected Linear workspace.",
            exampleArguments: {
              limit: 10,
            },
            inputMode: "json",
            intentKeywords: ["linear", "projects", "roadmap", "list projects"],
            label: "List projects",
            resultMode: "json",
            usageNotes: [
              "This returns a recent slice of projects, not a semantic search.",
            ],
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 10,
            }),
            execute: executeLinearProjectList,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                limit: {
                  ...LIMIT_ARGUMENT_SCHEMA,
                  maximum: 25,
                  description: "Maximum number of matching projects to return.",
                },
                query: PROJECT_QUERY_ARGUMENT_SCHEMA,
              },
              required: ["query"],
            },
            commandKey: "project.search",
            commandPath: ["project", "search"],
            description:
              "Search projects across names and descriptions in the connected Linear workspace.",
            exampleArguments: {
              limit: 5,
              query: "credits",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "project",
              "projects",
              "roadmap",
              "initiative",
              "search",
            ],
            label: "Search projects",
            resultMode: "json",
            usageNotes: [
              "Use this when you know the topic but not the exact project id.",
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
            execute: executeLinearProjectSearch,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                color: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional project color as a HEX string.",
                },
                content: {
                  type: "string",
                  description: "Optional markdown project overview content.",
                },
                description: {
                  type: "string",
                  description: "Optional project description.",
                },
                icon: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional project icon emoji.",
                },
                labelIds: LABEL_IDS_ARGUMENT_SCHEMA,
                leadId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional Linear user id for the project lead.",
                },
                memberIds: MEMBER_IDS_ARGUMENT_SCHEMA,
                name: PROJECT_NAME_ARGUMENT_SCHEMA,
                priority: PRIORITY_ARGUMENT_SCHEMA,
                startDate: DATE_ARGUMENT_SCHEMA,
                statusId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional Linear project status id.",
                },
                targetDate: DATE_ARGUMENT_SCHEMA,
                teamIds: TEAM_IDS_ARGUMENT_SCHEMA,
              },
              required: ["name", "teamIds"],
            },
            commandKey: "project.create",
            commandPath: ["project", "create"],
            description: "Create a new Linear project.",
            exampleArguments: {
              name: "Credits workflow",
              teamIds: ["team-id"],
            },
            inputMode: "json",
            intentKeywords: ["linear", "project", "create", "roadmap"],
            label: "Create project",
            resultMode: "json",
            usageNotes: [
              "Use workspace.list_teams first if you need canonical team ids before creating the project.",
            ],
            validate: (argumentsObject) => ({
              color:
                typeof argumentsObject.color === "string"
                  ? argumentsObject.color.trim()
                  : null,
              content:
                typeof argumentsObject.content === "string"
                  ? argumentsObject.content
                  : null,
              description:
                typeof argumentsObject.description === "string"
                  ? argumentsObject.description
                  : null,
              icon:
                typeof argumentsObject.icon === "string"
                  ? argumentsObject.icon.trim()
                  : null,
              labelIds: Array.isArray(argumentsObject.labelIds)
                ? argumentsObject.labelIds
                : undefined,
              leadId:
                typeof argumentsObject.leadId === "string"
                  ? argumentsObject.leadId.trim()
                  : null,
              memberIds: Array.isArray(argumentsObject.memberIds)
                ? argumentsObject.memberIds
                : undefined,
              name:
                typeof argumentsObject.name === "string"
                  ? argumentsObject.name.trim()
                  : "",
              priority:
                typeof argumentsObject.priority === "number" &&
                Number.isInteger(argumentsObject.priority)
                  ? argumentsObject.priority
                  : null,
              startDate:
                typeof argumentsObject.startDate === "string"
                  ? argumentsObject.startDate.trim()
                  : null,
              statusId:
                typeof argumentsObject.statusId === "string"
                  ? argumentsObject.statusId.trim()
                  : null,
              targetDate:
                typeof argumentsObject.targetDate === "string"
                  ? argumentsObject.targetDate.trim()
                  : null,
              teamIds: Array.isArray(argumentsObject.teamIds)
                ? argumentsObject.teamIds
                : [],
            }),
            execute: executeLinearProjectCreate,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                color: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional project color as a HEX string.",
                },
                content: {
                  type: "string",
                  description: "Optional markdown project overview content.",
                },
                description: {
                  type: "string",
                  description: "Optional project description.",
                },
                icon: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional project icon emoji.",
                },
                labelIds: LABEL_IDS_ARGUMENT_SCHEMA,
                leadId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional Linear user id for the project lead.",
                },
                memberIds: MEMBER_IDS_ARGUMENT_SCHEMA,
                name: PROJECT_NAME_ARGUMENT_SCHEMA,
                priority: PRIORITY_ARGUMENT_SCHEMA,
                projectId: PROJECT_ID_ARGUMENT_SCHEMA,
                startDate: DATE_ARGUMENT_SCHEMA,
                statusId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional Linear project status id.",
                },
                targetDate: DATE_ARGUMENT_SCHEMA,
                teamIds: TEAM_IDS_ARGUMENT_SCHEMA,
                trashed: {
                  type: "boolean",
                  description:
                    "Whether the project should be marked as trashed.",
                },
              },
              required: ["projectId"],
            },
            commandKey: "project.update",
            commandPath: ["project", "update"],
            description: "Update an existing Linear project.",
            exampleArguments: {
              name: "Credits workflow and billing",
              projectId: "project-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "project", "update", "edit", "roadmap"],
            label: "Update project",
            resultMode: "json",
            usageNotes: [
              "This requires at least one update field besides projectId.",
            ],
            validate: (argumentsObject) => ({
              color:
                typeof argumentsObject.color === "string"
                  ? argumentsObject.color.trim()
                  : null,
              content:
                typeof argumentsObject.content === "string"
                  ? argumentsObject.content
                  : null,
              description:
                typeof argumentsObject.description === "string"
                  ? argumentsObject.description
                  : null,
              icon:
                typeof argumentsObject.icon === "string"
                  ? argumentsObject.icon.trim()
                  : null,
              labelIds: Array.isArray(argumentsObject.labelIds)
                ? argumentsObject.labelIds
                : undefined,
              leadId:
                typeof argumentsObject.leadId === "string"
                  ? argumentsObject.leadId.trim()
                  : null,
              memberIds: Array.isArray(argumentsObject.memberIds)
                ? argumentsObject.memberIds
                : undefined,
              name:
                typeof argumentsObject.name === "string"
                  ? argumentsObject.name.trim()
                  : null,
              priority:
                typeof argumentsObject.priority === "number" &&
                Number.isInteger(argumentsObject.priority)
                  ? argumentsObject.priority
                  : null,
              projectId:
                typeof argumentsObject.projectId === "string"
                  ? argumentsObject.projectId.trim()
                  : "",
              startDate:
                typeof argumentsObject.startDate === "string"
                  ? argumentsObject.startDate.trim()
                  : null,
              statusId:
                typeof argumentsObject.statusId === "string"
                  ? argumentsObject.statusId.trim()
                  : null,
              targetDate:
                typeof argumentsObject.targetDate === "string"
                  ? argumentsObject.targetDate.trim()
                  : null,
              teamIds: Array.isArray(argumentsObject.teamIds)
                ? argumentsObject.teamIds
                : undefined,
              trashed:
                typeof argumentsObject.trashed === "boolean"
                  ? argumentsObject.trashed
                  : null,
            }),
            execute: executeLinearProjectUpdate,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                projectId: PROJECT_ID_ARGUMENT_SCHEMA,
                trash: {
                  type: "boolean",
                  description:
                    "Whether the archived project should also be trashed.",
                },
              },
              required: ["projectId"],
            },
            commandKey: "project.archive",
            commandPath: ["project", "archive"],
            description: "Archive one Linear project.",
            exampleArguments: {
              projectId: "project-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "project", "archive", "close", "remove"],
            label: "Archive project",
            resultMode: "json",
            usageNotes: [
              "Use trash=true only when you want the project archived and moved to trash.",
            ],
            validate: (argumentsObject) => ({
              projectId:
                typeof argumentsObject.projectId === "string"
                  ? argumentsObject.projectId.trim()
                  : "",
              trash:
                typeof argumentsObject.trash === "boolean"
                  ? argumentsObject.trash
                  : false,
            }),
            execute: executeLinearProjectArchive,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                limit: LIMIT_ARGUMENT_SCHEMA,
                projectId: PROJECT_ID_ARGUMENT_SCHEMA,
              },
              required: ["projectId"],
            },
            commandKey: "project.list_issues",
            commandPath: ["project", "list_issues"],
            description: "List issues attached to one Linear project.",
            exampleArguments: {
              limit: 25,
              projectId: "project-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "project", "issues", "roadmap"],
            label: "List project issues",
            resultMode: "json",
            usageNotes: [
              "Use this to expand a project into the underlying issue work.",
            ],
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 25,
              projectId:
                typeof argumentsObject.projectId === "string"
                  ? argumentsObject.projectId.trim()
                  : "",
            }),
            execute: executeLinearProjectListIssues,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                limit: LIMIT_ARGUMENT_SCHEMA,
                projectId: PROJECT_ID_ARGUMENT_SCHEMA,
              },
              required: ["projectId"],
            },
            commandKey: "project.list_updates",
            commandPath: ["project", "list_updates"],
            description: "List posted updates for one Linear project.",
            exampleArguments: {
              limit: 25,
              projectId: "project-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "project", "updates", "status report"],
            label: "List project updates",
            resultMode: "json",
            usageNotes: [
              "Use this to inspect project status updates and authored progress reports.",
            ],
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 25,
              projectId:
                typeof argumentsObject.projectId === "string"
                  ? argumentsObject.projectId.trim()
                  : "",
            }),
            execute: executeLinearProjectListUpdates,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                body: {
                  type: "string",
                  minLength: 1,
                  description: "Optional markdown project update body.",
                },
                health: PROJECT_UPDATE_HEALTH_ARGUMENT_SCHEMA,
                isDiffHidden: {
                  type: "boolean",
                  description:
                    "Whether the project update diff should be hidden.",
                },
                projectId: PROJECT_ID_ARGUMENT_SCHEMA,
              },
              required: ["projectId"],
            },
            commandKey: "project.create_update",
            commandPath: ["project", "create_update"],
            description: "Create a new update for a Linear project.",
            exampleArguments: {
              body: "Credits workflow is on track for this week.",
              projectId: "project-id",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "project",
              "update",
              "status report",
              "progress update",
            ],
            label: "Create project update",
            resultMode: "json",
            usageNotes: [
              "Provide at least one of body, health, or isDiffHidden along with the project id.",
            ],
            validate: (argumentsObject) => ({
              body:
                typeof argumentsObject.body === "string"
                  ? argumentsObject.body.trim()
                  : null,
              health:
                typeof argumentsObject.health === "string"
                  ? argumentsObject.health.trim()
                  : null,
              isDiffHidden:
                typeof argumentsObject.isDiffHidden === "boolean"
                  ? argumentsObject.isDiffHidden
                  : null,
              projectId:
                typeof argumentsObject.projectId === "string"
                  ? argumentsObject.projectId.trim()
                  : "",
            }),
            execute: executeLinearProjectCreateUpdate,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                limit: LIMIT_ARGUMENT_SCHEMA,
                projectId: PROJECT_ID_ARGUMENT_SCHEMA,
              },
              required: ["projectId"],
            },
            commandKey: "project.list_documents",
            commandPath: ["project", "list_documents"],
            description: "List documents attached to one Linear project.",
            exampleArguments: {
              limit: 25,
              projectId: "project-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "project", "documents", "docs", "specs"],
            label: "List project documents",
            resultMode: "json",
            usageNotes: [
              "Use this to inspect project-level docs and planning artifacts.",
            ],
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 25,
              projectId:
                typeof argumentsObject.projectId === "string"
                  ? argumentsObject.projectId.trim()
                  : "",
            }),
            execute: executeLinearProjectListDocuments,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                limit: LIMIT_ARGUMENT_SCHEMA,
                projectId: PROJECT_ID_ARGUMENT_SCHEMA,
              },
              required: ["projectId"],
            },
            commandKey: "project.list_milestones",
            commandPath: ["project", "list_milestones"],
            description: "List milestones for one Linear project.",
            exampleArguments: {
              limit: 25,
              projectId: "project-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "project", "milestones", "deadlines"],
            label: "List project milestones",
            resultMode: "json",
            usageNotes: [
              "Use this when a project is organized around milestones or target dates.",
            ],
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 25,
              projectId:
                typeof argumentsObject.projectId === "string"
                  ? argumentsObject.projectId.trim()
                  : "",
            }),
            execute: executeLinearProjectListMilestones,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                limit: LIMIT_ARGUMENT_SCHEMA,
                projectId: PROJECT_ID_ARGUMENT_SCHEMA,
              },
              required: ["projectId"],
            },
            commandKey: "project.list_labels",
            commandPath: ["project", "list_labels"],
            description: "List labels attached to one Linear project.",
            exampleArguments: {
              limit: 25,
              projectId: "project-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "project", "labels", "taxonomy", "tags"],
            label: "List project labels",
            resultMode: "json",
            usageNotes: [
              "Use this to inspect project taxonomy without loading the full project label catalog.",
            ],
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 25,
              projectId:
                typeof argumentsObject.projectId === "string"
                  ? argumentsObject.projectId.trim()
                  : "",
            }),
            execute: executeLinearProjectListLabels,
          },
        ],
        description:
          "Project reads and writes for the connected Linear workspace.",
        groupKey: "project",
        groupPath: ["project"],
        intentKeywords: ["linear", "project", "projects", "roadmap"],
        label: "Projects",
      },
      {
        commands: [
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                issueIdentifierOrId: {
                  type: "string",
                  minLength: 1,
                  description:
                    "Optional issue identifier like ENG-123 or Linear issue id to scope comments to one issue.",
                },
                limit: LIMIT_ARGUMENT_SCHEMA,
              },
            },
            commandKey: "comment.list",
            commandPath: ["comment", "list"],
            description:
              "List recent comments, optionally scoped to a specific issue thread.",
            exampleArguments: {
              issueIdentifierOrId: "INT-6",
              limit: 25,
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "comment",
              "comments",
              "thread",
              "discussion",
            ],
            label: "List comments",
            resultMode: "json",
            usageNotes: [
              "Use issueIdentifierOrId when you want the thread for one issue instead of a global recent comment slice.",
            ],
            validate: (argumentsObject) => ({
              issueIdentifierOrId:
                typeof argumentsObject.issueIdentifierOrId === "string"
                  ? argumentsObject.issueIdentifierOrId.trim()
                  : "",
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 25,
            }),
            execute: executeLinearCommentList,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                commentId: COMMENT_ID_ARGUMENT_SCHEMA,
              },
              required: ["commentId"],
            },
            commandKey: "comment.get",
            commandPath: ["comment", "get"],
            description: "Read one Linear comment by comment id.",
            exampleArguments: {
              commentId: "comment-id",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "comment",
              "thread",
              "get comment",
              "read comment",
            ],
            label: "Get comment",
            resultMode: "json",
            usageNotes: [
              "Use comment ids returned by comment.list or issue.list_comments.",
            ],
            validate: (argumentsObject) => ({
              commentId:
                typeof argumentsObject.commentId === "string"
                  ? argumentsObject.commentId.trim()
                  : "",
            }),
            execute: executeLinearCommentGet,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                body: COMMENT_BODY_ARGUMENT_SCHEMA,
                doNotSubscribeToIssue: {
                  type: "boolean",
                  description:
                    "Prevent auto-subscribing the actor to the issue thread.",
                },
                issueIdentifierOrId: {
                  type: "string",
                  minLength: 1,
                  description:
                    "Issue identifier like ENG-123 or a Linear issue id.",
                },
                parentCommentId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional parent comment id for nested replies.",
                },
                quotedText: {
                  type: "string",
                  minLength: 1,
                  description:
                    "Optional quoted text for inline comments or context snippets.",
                },
              },
              required: ["issueIdentifierOrId", "body"],
            },
            commandKey: "comment.create",
            commandPath: ["comment", "create"],
            description: "Create a new comment on a Linear issue thread.",
            exampleArguments: {
              body: "Hello from Otto",
              issueIdentifierOrId: "INT-6",
            },
            inputMode: "json",
            intentKeywords: ["linear", "comment", "reply", "thread", "message"],
            label: "Create comment",
            resultMode: "json",
            usageNotes: [
              "This creates issue-thread comments only; use issueIdentifierOrId from issue.get or issue.search results when possible.",
            ],
            validate: (argumentsObject) => ({
              body:
                typeof argumentsObject.body === "string"
                  ? argumentsObject.body.trim()
                  : "",
              doNotSubscribeToIssue:
                typeof argumentsObject.doNotSubscribeToIssue === "boolean"
                  ? argumentsObject.doNotSubscribeToIssue
                  : null,
              issueIdentifierOrId:
                typeof argumentsObject.issueIdentifierOrId === "string"
                  ? argumentsObject.issueIdentifierOrId.trim()
                  : "",
              parentCommentId:
                typeof argumentsObject.parentCommentId === "string"
                  ? argumentsObject.parentCommentId.trim()
                  : null,
              quotedText:
                typeof argumentsObject.quotedText === "string"
                  ? argumentsObject.quotedText.trim()
                  : null,
            }),
            execute: executeLinearCommentCreate,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                body: COMMENT_BODY_ARGUMENT_SCHEMA,
                commentId: COMMENT_ID_ARGUMENT_SCHEMA,
                doNotSubscribeToIssue: {
                  type: "boolean",
                  description:
                    "Prevent auto-subscribing the actor to the issue thread.",
                },
                quotedText: {
                  type: "string",
                  minLength: 1,
                  description:
                    "Optional quoted text for inline comments or context snippets.",
                },
              },
              required: ["commentId"],
            },
            commandKey: "comment.update",
            commandPath: ["comment", "update"],
            description: "Update an existing Linear comment.",
            exampleArguments: {
              body: "Updated by Otto",
              commentId: "comment-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "comment", "update", "edit", "reply"],
            label: "Update comment",
            resultMode: "json",
            usageNotes: [
              "This requires at least one update field besides commentId.",
            ],
            validate: (argumentsObject) => ({
              body:
                typeof argumentsObject.body === "string"
                  ? argumentsObject.body.trim()
                  : null,
              commentId:
                typeof argumentsObject.commentId === "string"
                  ? argumentsObject.commentId.trim()
                  : "",
              doNotSubscribeToIssue:
                typeof argumentsObject.doNotSubscribeToIssue === "boolean"
                  ? argumentsObject.doNotSubscribeToIssue
                  : null,
              quotedText:
                typeof argumentsObject.quotedText === "string"
                  ? argumentsObject.quotedText.trim()
                  : null,
            }),
            execute: executeLinearCommentUpdate,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                commentId: COMMENT_ID_ARGUMENT_SCHEMA,
              },
              required: ["commentId"],
            },
            commandKey: "comment.delete",
            commandPath: ["comment", "delete"],
            description: "Delete a Linear comment by comment id.",
            exampleArguments: {
              commentId: "comment-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "comment", "delete", "remove"],
            label: "Delete comment",
            resultMode: "json",
            usageNotes: [
              "Use comment ids returned by comment.list or comment.get.",
            ],
            validate: (argumentsObject) => ({
              commentId:
                typeof argumentsObject.commentId === "string"
                  ? argumentsObject.commentId.trim()
                  : "",
            }),
            execute: executeLinearCommentDelete,
          },
        ],
        description:
          "Issue-thread comment reads and writes for the connected Linear workspace.",
        groupKey: "comment",
        groupPath: ["comment"],
        intentKeywords: ["linear", "comment", "comments", "thread"],
        label: "Comments",
      },
    ],
    rootCommands: [],
    toolDescription:
      "Read Linear workspace metadata plus issue, comment, and project context through Otto's managed integration runtime surface.",
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
