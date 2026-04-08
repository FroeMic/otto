import type { IntegrationDefinition } from "@/integrations/framework/types";
import type { AgentCapabilityDirection } from "@/tools/types";
import { executeLinearAttachmentCreate } from "./commands/attachment/create";
import { executeLinearAttachmentCreateFromUploadedFile } from "./commands/attachment/create-from-uploaded-file";
import { executeLinearAttachmentGet } from "./commands/attachment/get";
import { executeLinearAttachmentList } from "./commands/attachment/list";
import { executeLinearAttachmentListForUrl } from "./commands/attachment/list-for-url";
import { executeLinearAttachmentRequestUploadUrl } from "./commands/attachment/request-upload-url";
import { executeLinearAttachmentUpdate } from "./commands/attachment/update";
import { executeLinearAttachmentUploadFile } from "./commands/attachment/upload-file";
import { executeLinearCommentCreate } from "./commands/comment/create";
import { executeLinearCommentDelete } from "./commands/comment/delete";
import { executeLinearCommentGet } from "./commands/comment/get";
import { executeLinearCommentList } from "./commands/comment/list";
import { executeLinearCommentUpdate } from "./commands/comment/update";
import {
  executeLinearCustomerCreate,
  executeLinearCustomerGet,
  executeLinearCustomerList,
  executeLinearCustomerListNeeds,
  executeLinearCustomerUpdate,
} from "./commands/customer/commands";
import {
  executeLinearCustomerNeedArchive,
  executeLinearCustomerNeedCreate,
  executeLinearCustomerNeedCreateFromAttachment,
  executeLinearCustomerNeedDelete,
  executeLinearCustomerNeedGet,
  executeLinearCustomerNeedList,
  executeLinearCustomerNeedUnarchive,
  executeLinearCustomerNeedUpdate,
} from "./commands/customer-need/commands";
import {
  executeLinearCustomerStatusCreate,
  executeLinearCustomerStatusDelete,
  executeLinearCustomerStatusGet,
  executeLinearCustomerStatusList,
  executeLinearCustomerStatusUpdate,
} from "./commands/customer-status/commands";
import {
  executeLinearCustomerTierCreate,
  executeLinearCustomerTierDelete,
  executeLinearCustomerTierGet,
  executeLinearCustomerTierList,
  executeLinearCustomerTierUpdate,
} from "./commands/customer-tier/commands";
import { executeLinearCycleArchive } from "./commands/cycle/archive";
import { executeLinearCycleCreate } from "./commands/cycle/create";
import { executeLinearCycleGet } from "./commands/cycle/get";
import { executeLinearCycleList } from "./commands/cycle/list";
import { executeLinearCycleListIssues } from "./commands/cycle/list-issues";
import { executeLinearCycleUpdate } from "./commands/cycle/update";
import { executeLinearDocumentCreate } from "./commands/document/create";
import { executeLinearDocumentDelete } from "./commands/document/delete";
import { executeLinearDocumentGet } from "./commands/document/get";
import { executeLinearDocumentList } from "./commands/document/list";
import { executeLinearDocumentSearch } from "./commands/document/search";
import { executeLinearDocumentUpdate } from "./commands/document/update";
import {
  executeLinearInitiativeArchive,
  executeLinearInitiativeCreate,
  executeLinearInitiativeGet,
  executeLinearInitiativeList,
  executeLinearInitiativeListProjects,
  executeLinearInitiativeListUpdates,
  executeLinearInitiativeUpdate,
} from "./commands/initiative/commands";
import { executeLinearIssueAddLabel } from "./commands/issue/add-label";
import { executeLinearIssueArchive } from "./commands/issue/archive";
import { executeLinearIssueBatchUpdate } from "./commands/issue/batch-update";
import { executeLinearIssueCreate } from "./commands/issue/create";
import { executeLinearIssueDelete } from "./commands/issue/delete";
import { executeLinearIssueGet } from "./commands/issue/get";
import { executeLinearIssueInsertInlineImage } from "./commands/issue/insert-inline-image";
import { executeLinearIssueList } from "./commands/issue/list";
import { executeLinearIssueListAttachments } from "./commands/issue/list-attachments";
import { executeLinearIssueListComments } from "./commands/issue/list-comments";
import { executeLinearIssueListDocuments } from "./commands/issue/list-documents";
import { executeLinearIssueListRelations } from "./commands/issue/list-relations";
import { executeLinearIssueRemoveLabel } from "./commands/issue/remove-label";
import { executeLinearIssueSearch } from "./commands/issue/search";
import { executeLinearIssueUpdate } from "./commands/issue/update";
import { executeLinearIssueUploadInlineImage } from "./commands/issue/upload-inline-image";
import {
  executeLinearLabelCreateIssueLabel,
  executeLinearLabelDeleteIssueLabel,
  executeLinearLabelGetIssueLabel,
  executeLinearLabelListIssueLabels,
  executeLinearLabelRestoreIssueLabel,
  executeLinearLabelRetireIssueLabel,
  executeLinearLabelUpdateIssueLabel,
} from "./commands/label/issue";
import {
  executeLinearLabelCreateProjectLabel,
  executeLinearLabelDeleteProjectLabel,
  executeLinearLabelGetProjectLabel,
  executeLinearLabelListProjectLabels,
  executeLinearLabelRestoreProjectLabel,
  executeLinearLabelRetireProjectLabel,
  executeLinearLabelUpdateProjectLabel,
} from "./commands/label/project";
import { executeLinearProjectArchive } from "./commands/project/archive";
import { executeLinearProjectCreate } from "./commands/project/create";
import { executeLinearProjectCreateUpdate } from "./commands/project/create-update";
import { executeLinearProjectDelete } from "./commands/project/delete";
import { executeLinearProjectGet } from "./commands/project/get";
import { executeLinearProjectList } from "./commands/project/list";
import { executeLinearProjectListDocuments } from "./commands/project/list-documents";
import { executeLinearProjectListIssues } from "./commands/project/list-issues";
import { executeLinearProjectListLabels } from "./commands/project/list-labels";
import { executeLinearProjectListMilestones } from "./commands/project/list-milestones";
import { executeLinearProjectListUpdates } from "./commands/project/list-updates";
import { executeLinearProjectSearch } from "./commands/project/search";
import { executeLinearProjectUpdate } from "./commands/project/update";
import {
  executeLinearProjectMilestoneCreate,
  executeLinearProjectMilestoneDelete,
  executeLinearProjectMilestoneGet,
  executeLinearProjectMilestoneList,
  executeLinearProjectMilestoneMove,
  executeLinearProjectMilestoneUpdate,
} from "./commands/project-milestone/commands";
import {
  executeLinearProjectStatusCreate,
  executeLinearProjectStatusGet,
  executeLinearProjectStatusList,
  executeLinearProjectStatusUpdate,
} from "./commands/project-status/commands";
import { executeLinearTeamCreate } from "./commands/team/create";
import { executeLinearTeamDelete } from "./commands/team/delete";
import { executeLinearTeamGet } from "./commands/team/get";
import { executeLinearTeamList } from "./commands/team/list";
import { executeLinearTeamListCycles } from "./commands/team/list-cycles";
import { executeLinearTeamListIssues } from "./commands/team/list-issues";
import { executeLinearTeamListLabels } from "./commands/team/list-labels";
import { executeLinearTeamListProjects } from "./commands/team/list-projects";
import { executeLinearTeamListWorkflowStates } from "./commands/team/list-workflow-states";
import { executeLinearTeamMembersAdd } from "./commands/team/members-add";
import { executeLinearTeamMembersRemove } from "./commands/team/members-remove";
import { executeLinearTeamMembersUpdate } from "./commands/team/members-update";
import { executeLinearTeamUnarchive } from "./commands/team/unarchive";
import { executeLinearTeamUpdate } from "./commands/team/update";
import { executeLinearUserGet } from "./commands/user/get";
import { executeLinearUserList } from "./commands/user/list";
import { executeLinearUserListAssignedIssues } from "./commands/user/list-assigned-issues";
import { executeLinearUserListCreatedIssues } from "./commands/user/list-created-issues";
import { executeLinearUserListTeamMemberships } from "./commands/user/list-team-memberships";
import { executeLinearWorkspaceGetOrganization } from "./commands/workspace/get-organization";
import { executeLinearWorkspaceGetViewer } from "./commands/workspace/get-viewer";
import { executeLinearWorkspaceListProjectStatuses } from "./commands/workspace/list-project-statuses";
import { executeLinearWorkspaceListTeams } from "./commands/workspace/list-teams";
import { executeLinearWorkspaceListUsers } from "./commands/workspace/list-users";
import { executeLinearWorkspaceListWorkflowStates } from "./commands/workspace/list-workflow-states";
import { executeLinearWorkspaceMemberInvite } from "./commands/workspace-member/invite";
import { executeLinearWorkspaceMemberInviteCancel } from "./commands/workspace-member/invite-cancel";
import { executeLinearWorkspaceMemberInviteResend } from "./commands/workspace-member/invite-resend";
import { executeLinearWorkspaceMemberInviteUpdate } from "./commands/workspace-member/invite-update";
import { executeLinearWorkspaceMemberUpdate } from "./commands/workspace-member/update";
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

const TEAM_ID_OR_KEY_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description:
    "Linear team id, preferably from workspace.list_teams, or a short team key such as INT.",
} as const;

const TEAM_NAME_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Team name.",
} as const;

const TEAM_KEY_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Optional short team key such as INT.",
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

const USER_ID_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Linear user id.",
} as const;

const USER_ROLE_ARGUMENT_SCHEMA = {
  type: "string",
  enum: ["admin", "app", "guest", "owner", "user"],
  description: "Linear user role.",
} as const;

const TEAM_MEMBERSHIP_ID_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Linear team membership id.",
} as const;

const EMAIL_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Email address.",
} as const;

const ORGANIZATION_INVITE_ID_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Linear organization invite id.",
} as const;

const DOCUMENT_ID_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Linear document id.",
} as const;

const ATTACHMENT_ID_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Linear attachment id.",
} as const;

const DOCUMENT_TITLE_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Document title.",
} as const;

const DOCUMENT_QUERY_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Free-text document search query.",
} as const;

const LABEL_ID_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Linear label id.",
} as const;

const LABEL_NAME_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Label name.",
} as const;

const MILESTONE_ID_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Linear project milestone id.",
} as const;

const PROJECT_STATUS_ID_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Linear project status id.",
} as const;

const INITIATIVE_ID_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Linear initiative id.",
} as const;

const INITIATIVE_STATUS_ARGUMENT_SCHEMA = {
  type: "string",
  enum: ["Planned", "Active", "Completed"],
  description: "Linear initiative status.",
} as const;

const CUSTOMER_STATUS_ID_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Linear customer status id.",
} as const;

const CUSTOMER_TIER_ID_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Linear customer tier id.",
} as const;

const CUSTOMER_ID_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Linear customer id.",
} as const;

const CUSTOMER_NEED_ID_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Linear customer need id.",
} as const;

const PROJECT_STATUS_TYPE_ARGUMENT_SCHEMA = {
  type: "string",
  enum: ["backlog", "canceled", "completed", "paused", "planned", "started"],
  description: "Linear project status type.",
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
        "Read attachments and uploaded asset links in the connected Linear workspace.",
      direction: "read",
      key: "attachment.read",
      label: "Read attachments",
    }),
    buildCapability({
      description:
        "Create and later update attachment links or uploaded asset references in the connected Linear workspace.",
      direction: "tool",
      key: "attachment.write",
      label: "Write attachments",
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
        "Read teams and the cycles, workflow states, labels, projects, and issues associated with them in the connected Linear workspace.",
      direction: "read",
      key: "team.read",
      label: "Read teams",
    }),
    buildCapability({
      description: "Create and update teams in the connected Linear workspace.",
      direction: "tool",
      key: "team.write",
      label: "Write teams",
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
    buildCapability({
      description:
        "Read initiatives and the projects or updates associated with them in the connected Linear workspace.",
      direction: "read",
      key: "initiative.read",
      label: "Read initiatives",
    }),
    buildCapability({
      description:
        "Create, update, and archive initiatives in the connected Linear workspace.",
      direction: "tool",
      key: "initiative.write",
      label: "Write initiatives",
    }),
    buildCapability({
      description:
        "Read customers and customer needs in the connected Linear workspace.",
      direction: "read",
      key: "customer.read",
      label: "Read customers",
    }),
    buildCapability({
      description:
        "Create and update customers, customer statuses, and customer tiers in the connected Linear workspace.",
      direction: "tool",
      key: "customer.write",
      label: "Write customers",
    }),
    buildCapability({
      description:
        "Create, update, archive, and delete customer needs in the connected Linear workspace.",
      direction: "tool",
      key: "customer_need.write",
      label: "Write customer needs",
    }),
  ],
  categoryLabel: "Product Management",
  catalogDescription:
    "Connect Linear so Otto can inspect workspace, team, issue, project, document, initiative, and customer context, and create or update Linear records when needed.",
  description:
    "Workspace-managed Linear connection for workspace, team, issue, comment, project, document, initiative, and customer reads and writes.",
  iconSrc: "/integrations/linear.svg",
  key: "linear",
  label: "Linear",
  oauth: {
    provider: linearOAuthProvider,
  },
  pageDescription:
    "Connect Linear so Otto can inspect workspace and team context, search and manage issues and projects, and create or update Linear records for your team.",
  runtimeSurface: {
    commandGroups: [
      {
        commands: [
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                contentType: {
                  type: "string",
                  minLength: 1,
                  description: "MIME type of the file to upload.",
                },
                filename: {
                  type: "string",
                  minLength: 1,
                  description: "Filename for the uploaded file.",
                },
                makePublic: {
                  type: "boolean",
                  description:
                    "Whether the uploaded file should be publicly accessible.",
                },
                metaData: {
                  type: "object",
                  additionalProperties: true,
                  description:
                    "Optional metadata object forwarded to Linear's upload request.",
                },
                size: {
                  type: "integer",
                  minimum: 1,
                  description: "File size in bytes.",
                },
              },
              required: ["contentType", "filename", "size"],
            },
            commandKey: "attachment.request_upload_url",
            commandPath: ["attachment", "request_upload_url"],
            description:
              "Request signed upload instructions for a file without uploading the bytes yet.",
            exampleArguments: {
              contentType: "application/pdf",
              filename: "credits.pdf",
              size: 12345,
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "request upload url",
              "attachment upload",
              "signed upload",
              "asset upload",
            ],
            label: "Request upload URL",
            resultMode: "json",
            usageNotes: [
              "This command does not upload the bytes itself.",
              "Next step: perform a server-side PUT to uploadFile.uploadUrl using every returned uploadFile.headers entry and also set Content-Type to uploadFile.contentType.",
              "After the PUT succeeds, either call attachment.create_from_uploaded_file with uploadFile.assetUrl or use issue.insert_inline_image to embed the uploaded asset in an issue description.",
            ],
            validate: (argumentsObject) => ({
              contentType:
                typeof argumentsObject.contentType === "string"
                  ? argumentsObject.contentType.trim()
                  : "",
              filename:
                typeof argumentsObject.filename === "string"
                  ? argumentsObject.filename.trim()
                  : "",
              makePublic:
                typeof argumentsObject.makePublic === "boolean"
                  ? argumentsObject.makePublic
                  : null,
              metaData:
                argumentsObject.metaData &&
                typeof argumentsObject.metaData === "object" &&
                !Array.isArray(argumentsObject.metaData)
                  ? argumentsObject.metaData
                  : null,
              size:
                typeof argumentsObject.size === "number" &&
                Number.isInteger(argumentsObject.size)
                  ? argumentsObject.size
                  : null,
            }),
            execute: executeLinearAttachmentRequestUploadUrl,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                commentBody: {
                  type: "string",
                  minLength: 1,
                  description:
                    "Optional markdown comment body linked to the attachment.",
                },
                contentBase64: {
                  type: "string",
                  minLength: 1,
                  description:
                    "Base64-encoded file bytes. Data URLs are also accepted.",
                },
                contentType: {
                  type: "string",
                  minLength: 1,
                  description: "MIME type of the file to upload.",
                },
                createAsUser: {
                  type: "string",
                  minLength: 1,
                  description:
                    "Optional non-Linear username to create the attachment as when supported by the auth mode.",
                },
                filename: {
                  type: "string",
                  minLength: 1,
                  description: "Filename for the uploaded file.",
                },
                groupBySource: {
                  type: "boolean",
                  description:
                    "Whether matching source attachments should be grouped together in Linear.",
                },
                iconUrl: {
                  type: "string",
                  minLength: 1,
                  description:
                    "Optional icon URL to display with the attachment.",
                },
                id: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                issueId: {
                  type: "string",
                  minLength: 1,
                  description:
                    "Optional alias for issueIdentifierOrId if the caller already has the issue id or identifier under this field name.",
                },
                issueIdentifierOrId: {
                  type: "string",
                  minLength: 1,
                  description:
                    "Linear issue id or identifier that should receive the uploaded attachment.",
                },
                makePublic: {
                  type: "boolean",
                  description:
                    "Whether the uploaded file should be publicly accessible.",
                },
                metaData: {
                  type: "object",
                  additionalProperties: true,
                  description:
                    "Optional metadata object forwarded to Linear's signed upload request.",
                },
                metadata: {
                  type: "object",
                  additionalProperties: true,
                  description:
                    "Optional metadata object stored on the final Linear attachment record.",
                },
                subtitle: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                title: {
                  type: "string",
                  minLength: 1,
                  description: "Attachment title shown in Linear.",
                },
              },
              required: [
                "contentBase64",
                "contentType",
                "filename",
                "issueIdentifierOrId",
                "title",
              ],
            },
            commandKey: "attachment.upload_file",
            commandPath: ["attachment", "upload_file"],
            description:
              "Upload file bytes to Linear storage on the server, then create the final Linear attachment in one step.",
            exampleArguments: {
              contentBase64: "<base64-file-bytes>",
              contentType: "application/pdf",
              filename: "credits.pdf",
              issueIdentifierOrId: "INT-6",
              title: "Credits PDF",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "upload file",
              "attach file",
              "attachment upload",
              "uploaded asset",
            ],
            label: "Upload file",
            resultMode: "json",
            usageNotes: [
              "This command performs the full server-side upload flow: request signed upload URL, PUT the file bytes, then create the Linear attachment.",
              "Provide contentBase64 with the raw file bytes. Data URL prefixes are accepted.",
              "Use attachment.request_upload_url only when you need the lower-level signed upload primitive for custom flows.",
            ],
            validate: (argumentsObject) => ({
              commentBody:
                typeof argumentsObject.commentBody === "string"
                  ? argumentsObject.commentBody.trim()
                  : null,
              contentBase64:
                typeof argumentsObject.contentBase64 === "string"
                  ? argumentsObject.contentBase64.trim()
                  : "",
              contentType:
                typeof argumentsObject.contentType === "string"
                  ? argumentsObject.contentType.trim()
                  : "",
              createAsUser:
                typeof argumentsObject.createAsUser === "string"
                  ? argumentsObject.createAsUser.trim()
                  : null,
              filename:
                typeof argumentsObject.filename === "string"
                  ? argumentsObject.filename.trim()
                  : "",
              groupBySource:
                typeof argumentsObject.groupBySource === "boolean"
                  ? argumentsObject.groupBySource
                  : null,
              iconUrl:
                typeof argumentsObject.iconUrl === "string"
                  ? argumentsObject.iconUrl.trim()
                  : null,
              id:
                typeof argumentsObject.id === "string"
                  ? argumentsObject.id.trim()
                  : null,
              issueId:
                typeof argumentsObject.issueId === "string"
                  ? argumentsObject.issueId.trim()
                  : null,
              issueIdentifierOrId:
                typeof argumentsObject.issueIdentifierOrId === "string"
                  ? argumentsObject.issueIdentifierOrId.trim()
                  : "",
              makePublic:
                typeof argumentsObject.makePublic === "boolean"
                  ? argumentsObject.makePublic
                  : null,
              metaData:
                argumentsObject.metaData &&
                typeof argumentsObject.metaData === "object" &&
                !Array.isArray(argumentsObject.metaData)
                  ? argumentsObject.metaData
                  : null,
              metadata:
                argumentsObject.metadata &&
                typeof argumentsObject.metadata === "object" &&
                !Array.isArray(argumentsObject.metadata)
                  ? argumentsObject.metadata
                  : null,
              subtitle:
                typeof argumentsObject.subtitle === "string"
                  ? argumentsObject.subtitle.trim()
                  : null,
              title:
                typeof argumentsObject.title === "string"
                  ? argumentsObject.title.trim()
                  : "",
            }),
            execute: executeLinearAttachmentUploadFile,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                attachmentId: ATTACHMENT_ID_ARGUMENT_SCHEMA,
                iconUrl: {
                  type: "string",
                  minLength: 1,
                  description:
                    "Optional replacement icon URL to display with the attachment.",
                },
                metadata: {
                  type: "object",
                  additionalProperties: true,
                  description:
                    "Optional replacement metadata object stored on the attachment.",
                },
                subtitle: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                title: {
                  type: "string",
                  minLength: 1,
                  description: "Updated attachment title shown in Linear.",
                },
              },
              required: ["attachmentId"],
            },
            commandKey: "attachment.update",
            commandPath: ["attachment", "update"],
            description: "Update one existing Linear attachment.",
            exampleArguments: {
              attachmentId: "attachment-id",
              title: "Updated attachment title",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "attachment",
              "update attachment",
              "rename file link",
              "edit attachment",
            ],
            label: "Update attachment",
            resultMode: "json",
            usageNotes: [
              "This requires at least one update field besides attachmentId.",
            ],
            validate: (argumentsObject) => ({
              attachmentId:
                typeof argumentsObject.attachmentId === "string"
                  ? argumentsObject.attachmentId.trim()
                  : "",
              iconUrl:
                typeof argumentsObject.iconUrl === "string"
                  ? argumentsObject.iconUrl.trim()
                  : null,
              metadata:
                argumentsObject.metadata &&
                typeof argumentsObject.metadata === "object" &&
                !Array.isArray(argumentsObject.metadata)
                  ? argumentsObject.metadata
                  : null,
              subtitle:
                typeof argumentsObject.subtitle === "string"
                  ? argumentsObject.subtitle.trim()
                  : null,
              title:
                typeof argumentsObject.title === "string"
                  ? argumentsObject.title.trim()
                  : null,
            }),
            execute: executeLinearAttachmentUpdate,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                assetUrl: {
                  type: "string",
                  minLength: 1,
                  description:
                    "Uploaded Linear asset URL returned by attachment.request_upload_url or the uploadFile field from attachment.upload_file.",
                },
                commentBody: {
                  type: "string",
                  minLength: 1,
                  description:
                    "Optional markdown comment body linked to the attachment.",
                },
                createAsUser: {
                  type: "string",
                  minLength: 1,
                  description:
                    "Optional non-Linear username to create the attachment as when supported by the auth mode.",
                },
                groupBySource: {
                  type: "boolean",
                  description:
                    "Whether matching source attachments should be grouped together in Linear.",
                },
                iconUrl: {
                  type: "string",
                  minLength: 1,
                  description:
                    "Optional icon URL to display with the attachment.",
                },
                id: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                issueId: {
                  type: "string",
                  minLength: 1,
                  description:
                    "Linear issue id or identifier to attach the uploaded asset to.",
                },
                metadata: {
                  type: "object",
                  additionalProperties: true,
                  description:
                    "Optional metadata object stored on the attachment.",
                },
                subtitle: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                title: {
                  type: "string",
                  minLength: 1,
                  description: "Attachment title shown in Linear.",
                },
              },
              required: ["assetUrl", "issueId", "title"],
            },
            commandKey: "attachment.create_from_uploaded_file",
            commandPath: ["attachment", "create_from_uploaded_file"],
            description:
              "Create a Linear attachment record from an uploaded Linear asset URL.",
            exampleArguments: {
              assetUrl: "https://uploads.linear.app/assets/credits.pdf",
              issueId: "INT-6",
              title: "Credits PDF",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "attachment",
              "uploaded file",
              "asset url",
              "attach uploaded file",
            ],
            label: "Create attachment from uploaded file",
            resultMode: "json",
            usageNotes: [
              "Use this after attachment.request_upload_url and after the bytes have been uploaded to the returned signed URL.",
              "You do not need this follow-up command when using the high-level attachment.upload_file command.",
            ],
            validate: (argumentsObject) => ({
              assetUrl:
                typeof argumentsObject.assetUrl === "string"
                  ? argumentsObject.assetUrl.trim()
                  : "",
              commentBody:
                typeof argumentsObject.commentBody === "string"
                  ? argumentsObject.commentBody.trim()
                  : null,
              createAsUser:
                typeof argumentsObject.createAsUser === "string"
                  ? argumentsObject.createAsUser.trim()
                  : null,
              groupBySource:
                typeof argumentsObject.groupBySource === "boolean"
                  ? argumentsObject.groupBySource
                  : null,
              iconUrl:
                typeof argumentsObject.iconUrl === "string"
                  ? argumentsObject.iconUrl.trim()
                  : null,
              id:
                typeof argumentsObject.id === "string"
                  ? argumentsObject.id.trim()
                  : null,
              issueId:
                typeof argumentsObject.issueId === "string"
                  ? argumentsObject.issueId.trim()
                  : "",
              metadata:
                argumentsObject.metadata &&
                typeof argumentsObject.metadata === "object" &&
                !Array.isArray(argumentsObject.metadata)
                  ? argumentsObject.metadata
                  : null,
              subtitle:
                typeof argumentsObject.subtitle === "string"
                  ? argumentsObject.subtitle.trim()
                  : null,
              title:
                typeof argumentsObject.title === "string"
                  ? argumentsObject.title.trim()
                  : "",
            }),
            execute: executeLinearAttachmentCreateFromUploadedFile,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                commentBody: {
                  type: "string",
                  minLength: 1,
                  description:
                    "Optional markdown comment body linked to the attachment.",
                },
                createAsUser: {
                  type: "string",
                  minLength: 1,
                  description:
                    "Optional non-Linear username to create the attachment as when supported by the auth mode.",
                },
                groupBySource: {
                  type: "boolean",
                  description:
                    "Whether matching source attachments should be grouped together in Linear.",
                },
                iconUrl: {
                  type: "string",
                  minLength: 1,
                  description:
                    "Optional icon URL to display with the attachment.",
                },
                id: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                issueId: {
                  type: "string",
                  minLength: 1,
                  description:
                    "Linear issue id or identifier to attach the link to.",
                },
                metadata: {
                  type: "object",
                  additionalProperties: true,
                  description:
                    "Optional metadata object stored on the attachment.",
                },
                subtitle: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                title: {
                  type: "string",
                  minLength: 1,
                  description: "Attachment title shown in Linear.",
                },
                url: {
                  type: "string",
                  minLength: 1,
                  description:
                    "Attachment URL. Reusing a URL updates the existing attachment in Linear.",
                },
              },
              required: ["issueId", "title", "url"],
            },
            commandKey: "attachment.create",
            commandPath: ["attachment", "create"],
            description: "Create a new Linear attachment link on one issue.",
            exampleArguments: {
              issueId: "INT-6",
              title: "AWS Credits",
              url: "https://example.com/aws-credits",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "attachment",
              "attach link",
              "add file link",
              "asset link",
            ],
            label: "Create attachment",
            resultMode: "json",
            usageNotes: [
              "Use this to attach an external URL or previously uploaded asset URL to a Linear issue.",
              "Linear treats the attachment URL as a unique identifier, so reusing the same URL updates the existing record.",
            ],
            validate: (argumentsObject) => ({
              commentBody:
                typeof argumentsObject.commentBody === "string"
                  ? argumentsObject.commentBody.trim()
                  : null,
              createAsUser:
                typeof argumentsObject.createAsUser === "string"
                  ? argumentsObject.createAsUser.trim()
                  : null,
              groupBySource:
                typeof argumentsObject.groupBySource === "boolean"
                  ? argumentsObject.groupBySource
                  : null,
              iconUrl:
                typeof argumentsObject.iconUrl === "string"
                  ? argumentsObject.iconUrl.trim()
                  : null,
              id:
                typeof argumentsObject.id === "string"
                  ? argumentsObject.id.trim()
                  : null,
              issueId:
                typeof argumentsObject.issueId === "string"
                  ? argumentsObject.issueId.trim()
                  : "",
              metadata:
                argumentsObject.metadata &&
                typeof argumentsObject.metadata === "object" &&
                !Array.isArray(argumentsObject.metadata)
                  ? argumentsObject.metadata
                  : null,
              subtitle:
                typeof argumentsObject.subtitle === "string"
                  ? argumentsObject.subtitle.trim()
                  : null,
              title:
                typeof argumentsObject.title === "string"
                  ? argumentsObject.title.trim()
                  : "",
              url:
                typeof argumentsObject.url === "string"
                  ? argumentsObject.url.trim()
                  : "",
            }),
            execute: executeLinearAttachmentCreate,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                limit: LIMIT_ARGUMENT_SCHEMA,
                url: {
                  type: "string",
                  minLength: 1,
                  description: "Attachment URL to look up in Linear.",
                },
              },
              required: ["url"],
            },
            commandKey: "attachment.list_for_url",
            commandPath: ["attachment", "list_for_url"],
            description:
              "List Linear attachments associated with one exact attachment URL.",
            exampleArguments: {
              limit: 10,
              url: "https://example.com/aws-credits",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "attachment",
              "attachments for url",
              "linked url",
              "lookup attachment",
            ],
            label: "List attachments for URL",
            resultMode: "json",
            usageNotes: [
              "Use this when you know the original attachment URL and want to see whether Linear already linked it to one or more issues.",
            ],
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 25,
              url:
                typeof argumentsObject.url === "string"
                  ? argumentsObject.url.trim()
                  : "",
            }),
            execute: executeLinearAttachmentListForUrl,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                attachmentId: ATTACHMENT_ID_ARGUMENT_SCHEMA,
              },
              required: ["attachmentId"],
            },
            commandKey: "attachment.get",
            commandPath: ["attachment", "get"],
            description:
              "Read one Linear attachment by attachment id and return normalized attachment context.",
            exampleArguments: {
              attachmentId: "attachment-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "attachment", "file", "link", "asset"],
            label: "Get attachment",
            resultMode: "json",
            usageNotes: [
              "Use ids returned by attachment.list or issue.list_attachments before reading one attachment in detail.",
            ],
            validate: (argumentsObject) => ({
              attachmentId:
                typeof argumentsObject.attachmentId === "string"
                  ? argumentsObject.attachmentId.trim()
                  : "",
            }),
            execute: executeLinearAttachmentGet,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                limit: LIMIT_ARGUMENT_SCHEMA,
              },
            },
            commandKey: "attachment.list",
            commandPath: ["attachment", "list"],
            description:
              "List recently updated attachments from the connected Linear workspace.",
            exampleArguments: {
              limit: 25,
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "attachment",
              "attachments",
              "files",
              "links",
              "assets",
            ],
            label: "List attachments",
            resultMode: "json",
            usageNotes: [
              "Use this to browse recent attachment records before reading one in detail or linking uploaded assets to issues.",
            ],
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 25,
            }),
            execute: executeLinearAttachmentList,
          },
        ],
        description:
          "Attachment metadata and uploaded asset reads for the connected Linear workspace.",
        groupKey: "attachment",
        groupPath: ["attachment"],
        intentKeywords: [
          "linear",
          "attachment",
          "attachments",
          "files",
          "links",
          "assets",
        ],
        label: "Attachments",
      },
      {
        commands: [
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                includeArchived: {
                  type: "boolean",
                  description:
                    "Whether archived customer needs should be included.",
                },
                limit: LIMIT_ARGUMENT_SCHEMA,
              },
            },
            commandKey: "customer_need.list",
            commandPath: ["customer_need", "list"],
            description:
              "List customer needs from the connected Linear workspace.",
            exampleArguments: {
              includeArchived: false,
              limit: 10,
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "customer need",
              "customer needs",
              "feedback",
            ],
            label: "List customer needs",
            resultMode: "json",
            usageNotes: [
              "Use includeArchived=true when you need to inspect resolved or archived customer needs too.",
            ],
            validate: (argumentsObject) => ({
              includeArchived:
                typeof argumentsObject.includeArchived === "boolean"
                  ? argumentsObject.includeArchived
                  : false,
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 10,
            }),
            execute: executeLinearCustomerNeedList,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                needId: CUSTOMER_NEED_ID_ARGUMENT_SCHEMA,
              },
              required: ["needId"],
            },
            commandKey: "customer_need.get",
            commandPath: ["customer_need", "get"],
            description: "Read one Linear customer need by id.",
            exampleArguments: {
              needId: "customer-need-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "customer need", "get feedback"],
            label: "Get customer need",
            resultMode: "json",
            validate: (argumentsObject) => ({
              needId:
                typeof argumentsObject.needId === "string"
                  ? argumentsObject.needId.trim()
                  : "",
            }),
            execute: executeLinearCustomerNeedGet,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                attachmentId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description:
                    "Optional Linear attachment id linked to the need.",
                },
                attachmentUrl: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional attachment URL linked to the need.",
                },
                body: {
                  type: "string",
                  description: "Optional markdown body for the need.",
                },
                commentId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional Linear comment id linked to the need.",
                },
                customerExternalId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional customer external id.",
                },
                customerId: CUSTOMER_ID_ARGUMENT_SCHEMA,
                issueId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description:
                    "Optional issue identifier or id linked to the need.",
                },
                priority: {
                  type: "number",
                  description:
                    "Optional importance level where 0 = not important and 1 = important.",
                },
                projectId: PROJECT_ID_ARGUMENT_SCHEMA,
              },
            },
            commandKey: "customer_need.create",
            commandPath: ["customer_need", "create"],
            description: "Create a new Linear customer need.",
            exampleArguments: {
              body: "Need better billing exports",
              customerId: "customer-id",
              issueId: "INT-15",
            },
            inputMode: "json",
            intentKeywords: ["linear", "customer need", "create", "feedback"],
            label: "Create customer need",
            resultMode: "json",
            usageNotes: [
              "Provide customerId, customerExternalId, issueId, projectId, or attachment linkage so the need is attached to real customer context.",
            ],
            validate: (argumentsObject) => ({
              attachmentId:
                typeof argumentsObject.attachmentId === "string"
                  ? argumentsObject.attachmentId.trim()
                  : null,
              attachmentUrl:
                typeof argumentsObject.attachmentUrl === "string"
                  ? argumentsObject.attachmentUrl.trim()
                  : null,
              body:
                typeof argumentsObject.body === "string"
                  ? argumentsObject.body
                  : null,
              commentId:
                typeof argumentsObject.commentId === "string"
                  ? argumentsObject.commentId.trim()
                  : null,
              customerExternalId:
                typeof argumentsObject.customerExternalId === "string"
                  ? argumentsObject.customerExternalId.trim()
                  : null,
              customerId:
                typeof argumentsObject.customerId === "string"
                  ? argumentsObject.customerId.trim()
                  : null,
              issueId:
                typeof argumentsObject.issueId === "string"
                  ? argumentsObject.issueId.trim()
                  : null,
              priority:
                typeof argumentsObject.priority === "number" &&
                Number.isFinite(argumentsObject.priority)
                  ? argumentsObject.priority
                  : null,
              projectId:
                typeof argumentsObject.projectId === "string"
                  ? argumentsObject.projectId.trim()
                  : null,
            }),
            execute: executeLinearCustomerNeedCreate,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                attachmentId: {
                  type: "string",
                  minLength: 1,
                  description: "Linear attachment id used to create the need.",
                },
              },
              required: ["attachmentId"],
            },
            commandKey: "customer_need.create_from_attachment",
            commandPath: ["customer_need", "create_from_attachment"],
            description:
              "Create a new Linear customer need from one attachment.",
            exampleArguments: {
              attachmentId: "attachment-id",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "customer need",
              "attachment",
              "feedback link",
            ],
            label: "Create customer need from attachment",
            resultMode: "json",
            usageNotes: [
              "Use this when the customer need already has a canonical attachment in Linear and should be derived from it.",
            ],
            validate: (argumentsObject) => ({
              attachmentId:
                typeof argumentsObject.attachmentId === "string"
                  ? argumentsObject.attachmentId.trim()
                  : "",
            }),
            execute: executeLinearCustomerNeedCreateFromAttachment,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                applyPriorityToRelatedNeeds: {
                  type: "boolean",
                  description:
                    "Whether to update the priority of related needs on the same customer issue or project.",
                },
                attachmentUrl: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional attachment URL linked to the need.",
                },
                body: {
                  type: "string",
                  description: "Optional markdown body for the need.",
                },
                clearAttachment: {
                  type: "boolean",
                  description:
                    "Whether to clear any existing attachment association.",
                },
                customerExternalId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional customer external id.",
                },
                customerId: CUSTOMER_ID_ARGUMENT_SCHEMA,
                issueId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description:
                    "Optional issue identifier or id linked to the need.",
                },
                needId: CUSTOMER_NEED_ID_ARGUMENT_SCHEMA,
                priority: {
                  type: "number",
                  description:
                    "Optional importance level where 0 = not important and 1 = important.",
                },
                projectId: PROJECT_ID_ARGUMENT_SCHEMA,
              },
              required: ["needId"],
            },
            commandKey: "customer_need.update",
            commandPath: ["customer_need", "update"],
            description: "Update an existing Linear customer need.",
            exampleArguments: {
              needId: "customer-need-id",
              priority: 1,
            },
            inputMode: "json",
            intentKeywords: ["linear", "customer need", "update", "feedback"],
            label: "Update customer need",
            resultMode: "json",
            usageNotes: [
              "This requires at least one update field besides needId.",
            ],
            validate: (argumentsObject) => ({
              applyPriorityToRelatedNeeds:
                typeof argumentsObject.applyPriorityToRelatedNeeds === "boolean"
                  ? argumentsObject.applyPriorityToRelatedNeeds
                  : null,
              attachmentUrl:
                typeof argumentsObject.attachmentUrl === "string"
                  ? argumentsObject.attachmentUrl.trim()
                  : null,
              body:
                typeof argumentsObject.body === "string"
                  ? argumentsObject.body
                  : null,
              clearAttachment:
                typeof argumentsObject.clearAttachment === "boolean"
                  ? argumentsObject.clearAttachment
                  : null,
              customerExternalId:
                typeof argumentsObject.customerExternalId === "string"
                  ? argumentsObject.customerExternalId.trim()
                  : null,
              customerId:
                typeof argumentsObject.customerId === "string"
                  ? argumentsObject.customerId.trim()
                  : null,
              issueId:
                typeof argumentsObject.issueId === "string"
                  ? argumentsObject.issueId.trim()
                  : null,
              needId:
                typeof argumentsObject.needId === "string"
                  ? argumentsObject.needId.trim()
                  : "",
              priority:
                typeof argumentsObject.priority === "number" &&
                Number.isFinite(argumentsObject.priority)
                  ? argumentsObject.priority
                  : null,
              projectId:
                typeof argumentsObject.projectId === "string"
                  ? argumentsObject.projectId.trim()
                  : null,
            }),
            execute: executeLinearCustomerNeedUpdate,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                needId: CUSTOMER_NEED_ID_ARGUMENT_SCHEMA,
              },
              required: ["needId"],
            },
            commandKey: "customer_need.archive",
            commandPath: ["customer_need", "archive"],
            description: "Archive one Linear customer need.",
            exampleArguments: {
              needId: "customer-need-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "customer need", "archive", "resolve"],
            label: "Archive customer need",
            resultMode: "json",
            usageNotes: [
              "Archive a customer need when it should leave the active customer-need backlog.",
            ],
            validate: (argumentsObject) => ({
              needId:
                typeof argumentsObject.needId === "string"
                  ? argumentsObject.needId.trim()
                  : "",
            }),
            execute: executeLinearCustomerNeedArchive,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                needId: CUSTOMER_NEED_ID_ARGUMENT_SCHEMA,
              },
              required: ["needId"],
            },
            commandKey: "customer_need.unarchive",
            commandPath: ["customer_need", "unarchive"],
            description: "Unarchive one Linear customer need.",
            exampleArguments: {
              needId: "customer-need-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "customer need", "restore", "unarchive"],
            label: "Unarchive customer need",
            resultMode: "json",
            validate: (argumentsObject) => ({
              needId:
                typeof argumentsObject.needId === "string"
                  ? argumentsObject.needId.trim()
                  : "",
            }),
            execute: executeLinearCustomerNeedUnarchive,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                keepAttachment: {
                  type: "boolean",
                  description:
                    "Whether the linked attachment should be kept when deleting the need.",
                },
                needId: CUSTOMER_NEED_ID_ARGUMENT_SCHEMA,
              },
              required: ["needId"],
            },
            commandKey: "customer_need.delete",
            commandPath: ["customer_need", "delete"],
            description: "Delete one Linear customer need.",
            exampleArguments: {
              keepAttachment: true,
              needId: "customer-need-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "customer need", "delete", "remove"],
            label: "Delete customer need",
            resultMode: "json",
            usageNotes: [
              "Use keepAttachment=true when the attachment should survive after the need is deleted.",
            ],
            validate: (argumentsObject) => ({
              keepAttachment:
                typeof argumentsObject.keepAttachment === "boolean"
                  ? argumentsObject.keepAttachment
                  : null,
              needId:
                typeof argumentsObject.needId === "string"
                  ? argumentsObject.needId.trim()
                  : "",
            }),
            execute: executeLinearCustomerNeedDelete,
          },
        ],
        description:
          "Customer-need reads and writes for product feedback and demand tracking in Linear.",
        groupKey: "customer_need",
        groupPath: ["customer_need"],
        intentKeywords: ["linear", "customer need", "needs", "feedback"],
        label: "Customer Needs",
      },
      {
        commands: [
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                limit: LIMIT_ARGUMENT_SCHEMA,
              },
            },
            commandKey: "customer.list",
            commandPath: ["customer", "list"],
            description: "List customers from the connected Linear workspace.",
            exampleArguments: {
              limit: 10,
            },
            inputMode: "json",
            intentKeywords: ["linear", "customer", "customers", "accounts"],
            label: "List customers",
            resultMode: "json",
            usageNotes: [
              "Use this before customer.get when you need a canonical customer id.",
            ],
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 10,
            }),
            execute: executeLinearCustomerList,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                customerId: CUSTOMER_ID_ARGUMENT_SCHEMA,
              },
              required: ["customerId"],
            },
            commandKey: "customer.get",
            commandPath: ["customer", "get"],
            description: "Read one Linear customer by id.",
            exampleArguments: {
              customerId: "customer-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "customer", "get customer", "account"],
            label: "Get customer",
            resultMode: "json",
            validate: (argumentsObject) => ({
              customerId:
                typeof argumentsObject.customerId === "string"
                  ? argumentsObject.customerId.trim()
                  : "",
            }),
            execute: executeLinearCustomerGet,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                domains: {
                  type: "array",
                  items: {
                    type: "string",
                    minLength: 1,
                  },
                  description: "Optional customer domains.",
                },
                externalIds: {
                  type: "array",
                  items: {
                    type: "string",
                    minLength: 1,
                  },
                  description: "Optional customer external ids.",
                },
                logoUrl: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional customer logo URL.",
                },
                mainSourceId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description:
                    "Optional main source id. Must be one of externalIds.",
                },
                name: {
                  type: "string",
                  minLength: 1,
                  description: "Customer name.",
                },
                ownerId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description:
                    "Optional Linear user id for the customer owner.",
                },
                revenue: {
                  type: "integer",
                  description:
                    "Optional annual revenue generated by the customer.",
                },
                size: {
                  type: "integer",
                  description: "Optional approximate customer size.",
                },
                slackChannelId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description:
                    "Optional Slack channel id used to interact with the customer.",
                },
                statusId: CUSTOMER_STATUS_ID_ARGUMENT_SCHEMA,
                tierId: CUSTOMER_TIER_ID_ARGUMENT_SCHEMA,
              },
              required: ["name"],
            },
            commandKey: "customer.create",
            commandPath: ["customer", "create"],
            description: "Create a new Linear customer.",
            exampleArguments: {
              name: "Example Corp",
              statusId: "customer-status-id",
              tierId: "customer-tier-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "customer", "create", "account"],
            label: "Create customer",
            resultMode: "json",
            usageNotes: [
              "Use customer_status.list and customer_tier.list first if you need canonical status or tier ids.",
            ],
            validate: (argumentsObject) => ({
              domains: Array.isArray(argumentsObject.domains)
                ? argumentsObject.domains
                : undefined,
              externalIds: Array.isArray(argumentsObject.externalIds)
                ? argumentsObject.externalIds
                : undefined,
              logoUrl:
                typeof argumentsObject.logoUrl === "string"
                  ? argumentsObject.logoUrl.trim()
                  : null,
              mainSourceId:
                typeof argumentsObject.mainSourceId === "string"
                  ? argumentsObject.mainSourceId.trim()
                  : null,
              name:
                typeof argumentsObject.name === "string"
                  ? argumentsObject.name.trim()
                  : "",
              ownerId:
                typeof argumentsObject.ownerId === "string"
                  ? argumentsObject.ownerId.trim()
                  : null,
              revenue:
                typeof argumentsObject.revenue === "number" &&
                Number.isInteger(argumentsObject.revenue)
                  ? argumentsObject.revenue
                  : null,
              size:
                typeof argumentsObject.size === "number" &&
                Number.isInteger(argumentsObject.size)
                  ? argumentsObject.size
                  : null,
              slackChannelId:
                typeof argumentsObject.slackChannelId === "string"
                  ? argumentsObject.slackChannelId.trim()
                  : null,
              statusId:
                typeof argumentsObject.statusId === "string"
                  ? argumentsObject.statusId.trim()
                  : null,
              tierId:
                typeof argumentsObject.tierId === "string"
                  ? argumentsObject.tierId.trim()
                  : null,
            }),
            execute: executeLinearCustomerCreate,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                customerId: CUSTOMER_ID_ARGUMENT_SCHEMA,
                domains: {
                  type: "array",
                  items: {
                    type: "string",
                    minLength: 1,
                  },
                  description: "Optional customer domains.",
                },
                externalIds: {
                  type: "array",
                  items: {
                    type: "string",
                    minLength: 1,
                  },
                  description: "Optional customer external ids.",
                },
                logoUrl: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional customer logo URL.",
                },
                mainSourceId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description:
                    "Optional main source id. Must be one of externalIds.",
                },
                name: {
                  type: "string",
                  minLength: 1,
                  description: "Optional updated customer name.",
                },
                ownerId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description:
                    "Optional Linear user id for the customer owner.",
                },
                revenue: {
                  type: "integer",
                  description:
                    "Optional annual revenue generated by the customer.",
                },
                size: {
                  type: "integer",
                  description: "Optional approximate customer size.",
                },
                slackChannelId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description:
                    "Optional Slack channel id used to interact with the customer.",
                },
                statusId: CUSTOMER_STATUS_ID_ARGUMENT_SCHEMA,
                tierId: CUSTOMER_TIER_ID_ARGUMENT_SCHEMA,
              },
              required: ["customerId"],
            },
            commandKey: "customer.update",
            commandPath: ["customer", "update"],
            description: "Update an existing Linear customer.",
            exampleArguments: {
              customerId: "customer-id",
              name: "Example Corp Updated",
            },
            inputMode: "json",
            intentKeywords: ["linear", "customer", "update", "edit account"],
            label: "Update customer",
            resultMode: "json",
            usageNotes: [
              "This requires at least one update field besides customerId.",
            ],
            validate: (argumentsObject) => ({
              customerId:
                typeof argumentsObject.customerId === "string"
                  ? argumentsObject.customerId.trim()
                  : "",
              domains: Array.isArray(argumentsObject.domains)
                ? argumentsObject.domains
                : undefined,
              externalIds: Array.isArray(argumentsObject.externalIds)
                ? argumentsObject.externalIds
                : undefined,
              logoUrl:
                typeof argumentsObject.logoUrl === "string"
                  ? argumentsObject.logoUrl.trim()
                  : null,
              mainSourceId:
                typeof argumentsObject.mainSourceId === "string"
                  ? argumentsObject.mainSourceId.trim()
                  : null,
              name:
                typeof argumentsObject.name === "string"
                  ? argumentsObject.name.trim()
                  : null,
              ownerId:
                typeof argumentsObject.ownerId === "string"
                  ? argumentsObject.ownerId.trim()
                  : null,
              revenue:
                typeof argumentsObject.revenue === "number" &&
                Number.isInteger(argumentsObject.revenue)
                  ? argumentsObject.revenue
                  : null,
              size:
                typeof argumentsObject.size === "number" &&
                Number.isInteger(argumentsObject.size)
                  ? argumentsObject.size
                  : null,
              slackChannelId:
                typeof argumentsObject.slackChannelId === "string"
                  ? argumentsObject.slackChannelId.trim()
                  : null,
              statusId:
                typeof argumentsObject.statusId === "string"
                  ? argumentsObject.statusId.trim()
                  : null,
              tierId:
                typeof argumentsObject.tierId === "string"
                  ? argumentsObject.tierId.trim()
                  : null,
            }),
            execute: executeLinearCustomerUpdate,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                customerId: CUSTOMER_ID_ARGUMENT_SCHEMA,
                limit: LIMIT_ARGUMENT_SCHEMA,
              },
              required: ["customerId"],
            },
            commandKey: "customer.list_needs",
            commandPath: ["customer", "list_needs"],
            description: "List customer needs attached to one Linear customer.",
            exampleArguments: {
              customerId: "customer-id",
              limit: 25,
            },
            inputMode: "json",
            intentKeywords: ["linear", "customer", "needs", "feedback"],
            label: "List customer needs",
            resultMode: "json",
            usageNotes: [
              "Use this when you need the customer-specific need backlog before updating associated issues or projects.",
            ],
            validate: (argumentsObject) => ({
              customerId:
                typeof argumentsObject.customerId === "string"
                  ? argumentsObject.customerId.trim()
                  : "",
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 25,
            }),
            execute: executeLinearCustomerListNeeds,
          },
        ],
        description:
          "Customer reads and writes for workspace account context in Linear.",
        groupKey: "customer",
        groupPath: ["customer"],
        intentKeywords: ["linear", "customer", "customers", "accounts"],
        label: "Customers",
      },
      {
        commands: [
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                limit: LIMIT_ARGUMENT_SCHEMA,
              },
            },
            commandKey: "customer_tier.list",
            commandPath: ["customer_tier", "list"],
            description:
              "List customer tiers from the connected Linear workspace.",
            exampleArguments: {
              limit: 10,
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "customer tier",
              "customer tiers",
              "account tier",
            ],
            label: "List customer tiers",
            resultMode: "json",
            usageNotes: [
              "Use this before customer.create or customer.update when you need a canonical tier id.",
            ],
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 10,
            }),
            execute: executeLinearCustomerTierList,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                tierId: CUSTOMER_TIER_ID_ARGUMENT_SCHEMA,
              },
              required: ["tierId"],
            },
            commandKey: "customer_tier.get",
            commandPath: ["customer_tier", "get"],
            description: "Read one Linear customer tier by id.",
            exampleArguments: {
              tierId: "customer-tier-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "customer tier", "get customer tier"],
            label: "Get customer tier",
            resultMode: "json",
            validate: (argumentsObject) => ({
              tierId:
                typeof argumentsObject.tierId === "string"
                  ? argumentsObject.tierId.trim()
                  : "",
            }),
            execute: executeLinearCustomerTierGet,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                color: {
                  type: "string",
                  minLength: 1,
                  description: "Customer tier color as a HEX string.",
                },
                description: {
                  type: "string",
                  minLength: 1,
                  description: "Optional customer tier description.",
                },
                displayName: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional display name shown in the UI.",
                },
                name: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional internal customer tier name.",
                },
                position: {
                  type: "number",
                  description: "Optional position in the customer tier ladder.",
                },
              },
              required: ["color"],
            },
            commandKey: "customer_tier.create",
            commandPath: ["customer_tier", "create"],
            description: "Create a new Linear customer tier.",
            exampleArguments: {
              color: "#16A34A",
              displayName: "Strategic",
              name: "strategic",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "customer tier",
              "create",
              "account tier",
            ],
            label: "Create customer tier",
            resultMode: "json",
            usageNotes: [
              "Create tiers before assigning them to customers if your workspace account ladder is still being set up.",
            ],
            validate: (argumentsObject) => ({
              color:
                typeof argumentsObject.color === "string"
                  ? argumentsObject.color.trim()
                  : "",
              description:
                typeof argumentsObject.description === "string"
                  ? argumentsObject.description.trim()
                  : null,
              displayName:
                typeof argumentsObject.displayName === "string"
                  ? argumentsObject.displayName.trim()
                  : null,
              name:
                typeof argumentsObject.name === "string"
                  ? argumentsObject.name.trim()
                  : null,
              position:
                typeof argumentsObject.position === "number" &&
                Number.isFinite(argumentsObject.position)
                  ? argumentsObject.position
                  : null,
            }),
            execute: executeLinearCustomerTierCreate,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                color: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional customer tier color as a HEX string.",
                },
                description: {
                  type: "string",
                  minLength: 1,
                  description: "Optional customer tier description.",
                },
                displayName: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional display name shown in the UI.",
                },
                name: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional internal customer tier name.",
                },
                position: {
                  type: "number",
                  description: "Optional position in the customer tier ladder.",
                },
                tierId: CUSTOMER_TIER_ID_ARGUMENT_SCHEMA,
              },
              required: ["tierId"],
            },
            commandKey: "customer_tier.update",
            commandPath: ["customer_tier", "update"],
            description: "Update an existing Linear customer tier.",
            exampleArguments: {
              displayName: "Key",
              tierId: "customer-tier-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "customer tier", "update", "edit"],
            label: "Update customer tier",
            resultMode: "json",
            usageNotes: [
              "This requires at least one update field besides tierId.",
            ],
            validate: (argumentsObject) => ({
              color:
                typeof argumentsObject.color === "string"
                  ? argumentsObject.color.trim()
                  : null,
              description:
                typeof argumentsObject.description === "string"
                  ? argumentsObject.description.trim()
                  : null,
              displayName:
                typeof argumentsObject.displayName === "string"
                  ? argumentsObject.displayName.trim()
                  : null,
              name:
                typeof argumentsObject.name === "string"
                  ? argumentsObject.name.trim()
                  : null,
              position:
                typeof argumentsObject.position === "number" &&
                Number.isFinite(argumentsObject.position)
                  ? argumentsObject.position
                  : null,
              tierId:
                typeof argumentsObject.tierId === "string"
                  ? argumentsObject.tierId.trim()
                  : "",
            }),
            execute: executeLinearCustomerTierUpdate,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                tierId: CUSTOMER_TIER_ID_ARGUMENT_SCHEMA,
              },
              required: ["tierId"],
            },
            commandKey: "customer_tier.delete",
            commandPath: ["customer_tier", "delete"],
            description: "Delete one Linear customer tier.",
            exampleArguments: {
              tierId: "customer-tier-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "customer tier", "delete", "remove"],
            label: "Delete customer tier",
            resultMode: "json",
            usageNotes: [
              "Only delete tiers that are no longer referenced by active customers.",
            ],
            validate: (argumentsObject) => ({
              tierId:
                typeof argumentsObject.tierId === "string"
                  ? argumentsObject.tierId.trim()
                  : "",
            }),
            execute: executeLinearCustomerTierDelete,
          },
        ],
        description:
          "Customer-tier reads and writes for the workspace customer segmentation model.",
        groupKey: "customer_tier",
        groupPath: ["customer_tier"],
        intentKeywords: ["linear", "customer tier", "account tier"],
        label: "Customer Tiers",
      },
      {
        commands: [
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                limit: LIMIT_ARGUMENT_SCHEMA,
              },
            },
            commandKey: "customer_status.list",
            commandPath: ["customer_status", "list"],
            description:
              "List customer statuses from the connected Linear workspace.",
            exampleArguments: {
              limit: 10,
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "customer status",
              "customer statuses",
              "customer flow",
            ],
            label: "List customer statuses",
            resultMode: "json",
            usageNotes: [
              "Use this before customer.create or customer.update when you need a canonical status id.",
            ],
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 10,
            }),
            execute: executeLinearCustomerStatusList,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                statusId: CUSTOMER_STATUS_ID_ARGUMENT_SCHEMA,
              },
              required: ["statusId"],
            },
            commandKey: "customer_status.get",
            commandPath: ["customer_status", "get"],
            description: "Read one Linear customer status by id.",
            exampleArguments: {
              statusId: "customer-status-id",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "customer status",
              "get customer status",
            ],
            label: "Get customer status",
            resultMode: "json",
            validate: (argumentsObject) => ({
              statusId:
                typeof argumentsObject.statusId === "string"
                  ? argumentsObject.statusId.trim()
                  : "",
            }),
            execute: executeLinearCustomerStatusGet,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                color: {
                  type: "string",
                  minLength: 1,
                  description: "Customer status color as a HEX string.",
                },
                description: {
                  type: "string",
                  minLength: 1,
                  description: "Optional customer status description.",
                },
                displayName: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional display name shown in the UI.",
                },
                name: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional internal customer status name.",
                },
                position: {
                  type: "number",
                  description: "Optional position in the customer workflow.",
                },
              },
              required: ["color"],
            },
            commandKey: "customer_status.create",
            commandPath: ["customer_status", "create"],
            description: "Create a new Linear customer status.",
            exampleArguments: {
              color: "#4F46E5",
              displayName: "Active",
              name: "active",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "customer status",
              "create",
              "customer flow",
            ],
            label: "Create customer status",
            resultMode: "json",
            usageNotes: [
              "Create statuses before assigning them to customers if your workspace flow is still being set up.",
            ],
            validate: (argumentsObject) => ({
              color:
                typeof argumentsObject.color === "string"
                  ? argumentsObject.color.trim()
                  : "",
              description:
                typeof argumentsObject.description === "string"
                  ? argumentsObject.description.trim()
                  : null,
              displayName:
                typeof argumentsObject.displayName === "string"
                  ? argumentsObject.displayName.trim()
                  : null,
              name:
                typeof argumentsObject.name === "string"
                  ? argumentsObject.name.trim()
                  : null,
              position:
                typeof argumentsObject.position === "number" &&
                Number.isFinite(argumentsObject.position)
                  ? argumentsObject.position
                  : null,
            }),
            execute: executeLinearCustomerStatusCreate,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                color: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description:
                    "Optional customer status color as a HEX string.",
                },
                description: {
                  type: "string",
                  minLength: 1,
                  description: "Optional customer status description.",
                },
                displayName: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional display name shown in the UI.",
                },
                name: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional internal customer status name.",
                },
                position: {
                  type: "number",
                  description: "Optional position in the customer workflow.",
                },
                statusId: CUSTOMER_STATUS_ID_ARGUMENT_SCHEMA,
              },
              required: ["statusId"],
            },
            commandKey: "customer_status.update",
            commandPath: ["customer_status", "update"],
            description: "Update an existing Linear customer status.",
            exampleArguments: {
              displayName: "Current",
              statusId: "customer-status-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "customer status", "update", "edit"],
            label: "Update customer status",
            resultMode: "json",
            usageNotes: [
              "This requires at least one update field besides statusId.",
            ],
            validate: (argumentsObject) => ({
              color:
                typeof argumentsObject.color === "string"
                  ? argumentsObject.color.trim()
                  : null,
              description:
                typeof argumentsObject.description === "string"
                  ? argumentsObject.description.trim()
                  : null,
              displayName:
                typeof argumentsObject.displayName === "string"
                  ? argumentsObject.displayName.trim()
                  : null,
              name:
                typeof argumentsObject.name === "string"
                  ? argumentsObject.name.trim()
                  : null,
              position:
                typeof argumentsObject.position === "number" &&
                Number.isFinite(argumentsObject.position)
                  ? argumentsObject.position
                  : null,
              statusId:
                typeof argumentsObject.statusId === "string"
                  ? argumentsObject.statusId.trim()
                  : "",
            }),
            execute: executeLinearCustomerStatusUpdate,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                statusId: CUSTOMER_STATUS_ID_ARGUMENT_SCHEMA,
              },
              required: ["statusId"],
            },
            commandKey: "customer_status.delete",
            commandPath: ["customer_status", "delete"],
            description: "Delete one Linear customer status.",
            exampleArguments: {
              statusId: "customer-status-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "customer status", "delete", "remove"],
            label: "Delete customer status",
            resultMode: "json",
            usageNotes: [
              "Only delete statuses that are no longer referenced by active customer workflows.",
            ],
            validate: (argumentsObject) => ({
              statusId:
                typeof argumentsObject.statusId === "string"
                  ? argumentsObject.statusId.trim()
                  : "",
            }),
            execute: executeLinearCustomerStatusDelete,
          },
        ],
        description:
          "Customer-status reads and writes for the workspace customer lifecycle.",
        groupKey: "customer_status",
        groupPath: ["customer_status"],
        intentKeywords: ["linear", "customer status", "customer flow"],
        label: "Customer Statuses",
      },
      {
        commands: [
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                limit: LIMIT_ARGUMENT_SCHEMA,
              },
            },
            commandKey: "initiative.list",
            commandPath: ["initiative", "list"],
            description:
              "List recently updated initiatives from the connected Linear workspace.",
            exampleArguments: {
              limit: 10,
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "initiative",
              "initiatives",
              "strategy",
              "roadmap",
            ],
            label: "List initiatives",
            resultMode: "json",
            usageNotes: [
              "This returns a recent initiative slice, not semantic search.",
            ],
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 10,
            }),
            execute: executeLinearInitiativeList,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                initiativeId: INITIATIVE_ID_ARGUMENT_SCHEMA,
              },
              required: ["initiativeId"],
            },
            commandKey: "initiative.get",
            commandPath: ["initiative", "get"],
            description:
              "Read one Linear initiative by id and return normalized initiative context.",
            exampleArguments: {
              initiativeId: "initiative-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "initiative", "get initiative"],
            label: "Get initiative",
            resultMode: "json",
            usageNotes: ["Use initiative ids returned by initiative.list."],
            validate: (argumentsObject) => ({
              initiativeId:
                typeof argumentsObject.initiativeId === "string"
                  ? argumentsObject.initiativeId.trim()
                  : "",
            }),
            execute: executeLinearInitiativeGet,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                color: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional initiative color as a HEX string.",
                },
                content: {
                  type: "string",
                  description: "Optional initiative content in markdown.",
                },
                description: {
                  type: "string",
                  description: "Optional initiative description.",
                },
                icon: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional initiative icon name.",
                },
                name: {
                  type: "string",
                  minLength: 1,
                  description: "Initiative name.",
                },
                ownerId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description:
                    "Optional Linear user id for the initiative owner.",
                },
                sortOrder: {
                  type: "number",
                  description: "Optional initiative sort order.",
                },
                status: INITIATIVE_STATUS_ARGUMENT_SCHEMA,
                targetDate: {
                  ...DATE_ARGUMENT_SCHEMA,
                  description:
                    "Optional initiative target date in YYYY-MM-DD format.",
                },
                targetDateResolution: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional Linear target-date resolution value.",
                },
              },
              required: ["name"],
            },
            commandKey: "initiative.create",
            commandPath: ["initiative", "create"],
            description: "Create a new Linear initiative.",
            exampleArguments: {
              name: "Credits expansion",
              status: "Active",
              targetDate: "2026-06-30",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "initiative",
              "create",
              "new initiative",
            ],
            label: "Create initiative",
            resultMode: "json",
            usageNotes: [
              "Use workspace.list_users first if you need a canonical owner id before creating the initiative.",
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
              name:
                typeof argumentsObject.name === "string"
                  ? argumentsObject.name.trim()
                  : "",
              ownerId:
                typeof argumentsObject.ownerId === "string"
                  ? argumentsObject.ownerId.trim()
                  : null,
              sortOrder:
                typeof argumentsObject.sortOrder === "number" &&
                Number.isFinite(argumentsObject.sortOrder)
                  ? argumentsObject.sortOrder
                  : null,
              status:
                typeof argumentsObject.status === "string"
                  ? argumentsObject.status.trim()
                  : null,
              targetDate:
                typeof argumentsObject.targetDate === "string"
                  ? argumentsObject.targetDate.trim()
                  : null,
              targetDateResolution:
                typeof argumentsObject.targetDateResolution === "string"
                  ? argumentsObject.targetDateResolution.trim()
                  : null,
            }),
            execute: executeLinearInitiativeCreate,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                color: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional initiative color as a HEX string.",
                },
                content: {
                  type: "string",
                  description: "Optional initiative content in markdown.",
                },
                description: {
                  type: "string",
                  description: "Optional initiative description.",
                },
                icon: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional initiative icon name.",
                },
                initiativeId: INITIATIVE_ID_ARGUMENT_SCHEMA,
                name: {
                  type: "string",
                  minLength: 1,
                  description: "Optional updated initiative name.",
                },
                ownerId: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description:
                    "Optional Linear user id for the initiative owner.",
                },
                sortOrder: {
                  type: "number",
                  description: "Optional initiative sort order.",
                },
                status: INITIATIVE_STATUS_ARGUMENT_SCHEMA,
                targetDate: {
                  ...DATE_ARGUMENT_SCHEMA,
                  description:
                    "Optional initiative target date in YYYY-MM-DD format.",
                },
                targetDateResolution: {
                  ...OPTIONAL_STRING_ARGUMENT_SCHEMA,
                  description: "Optional Linear target-date resolution value.",
                },
                trashed: {
                  type: "boolean",
                  description:
                    "Whether the initiative should be marked as trashed.",
                },
              },
              required: ["initiativeId"],
            },
            commandKey: "initiative.update",
            commandPath: ["initiative", "update"],
            description: "Update an existing Linear initiative.",
            exampleArguments: {
              initiativeId: "initiative-id",
              status: "Completed",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "initiative",
              "update",
              "edit initiative",
            ],
            label: "Update initiative",
            resultMode: "json",
            usageNotes: [
              "This requires at least one update field besides initiativeId.",
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
              initiativeId:
                typeof argumentsObject.initiativeId === "string"
                  ? argumentsObject.initiativeId.trim()
                  : "",
              name:
                typeof argumentsObject.name === "string"
                  ? argumentsObject.name.trim()
                  : null,
              ownerId:
                typeof argumentsObject.ownerId === "string"
                  ? argumentsObject.ownerId.trim()
                  : null,
              sortOrder:
                typeof argumentsObject.sortOrder === "number" &&
                Number.isFinite(argumentsObject.sortOrder)
                  ? argumentsObject.sortOrder
                  : null,
              status:
                typeof argumentsObject.status === "string"
                  ? argumentsObject.status.trim()
                  : null,
              targetDate:
                typeof argumentsObject.targetDate === "string"
                  ? argumentsObject.targetDate.trim()
                  : null,
              targetDateResolution:
                typeof argumentsObject.targetDateResolution === "string"
                  ? argumentsObject.targetDateResolution.trim()
                  : null,
              trashed:
                typeof argumentsObject.trashed === "boolean"
                  ? argumentsObject.trashed
                  : null,
            }),
            execute: executeLinearInitiativeUpdate,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                initiativeId: INITIATIVE_ID_ARGUMENT_SCHEMA,
              },
              required: ["initiativeId"],
            },
            commandKey: "initiative.archive",
            commandPath: ["initiative", "archive"],
            description: "Archive one Linear initiative.",
            exampleArguments: {
              initiativeId: "initiative-id",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "initiative",
              "archive",
              "close initiative",
            ],
            label: "Archive initiative",
            resultMode: "json",
            usageNotes: [
              "Use this when the initiative should leave the active roadmap.",
            ],
            validate: (argumentsObject) => ({
              initiativeId:
                typeof argumentsObject.initiativeId === "string"
                  ? argumentsObject.initiativeId.trim()
                  : "",
            }),
            execute: executeLinearInitiativeArchive,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                initiativeId: INITIATIVE_ID_ARGUMENT_SCHEMA,
                limit: LIMIT_ARGUMENT_SCHEMA,
              },
              required: ["initiativeId"],
            },
            commandKey: "initiative.list_projects",
            commandPath: ["initiative", "list_projects"],
            description: "List projects linked to one Linear initiative.",
            exampleArguments: {
              initiativeId: "initiative-id",
              limit: 25,
            },
            inputMode: "json",
            intentKeywords: ["linear", "initiative", "projects", "roadmap"],
            label: "List initiative projects",
            resultMode: "json",
            usageNotes: [
              "Use this when you need the execution projects tied to one initiative.",
            ],
            validate: (argumentsObject) => ({
              initiativeId:
                typeof argumentsObject.initiativeId === "string"
                  ? argumentsObject.initiativeId.trim()
                  : "",
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 25,
            }),
            execute: executeLinearInitiativeListProjects,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                initiativeId: INITIATIVE_ID_ARGUMENT_SCHEMA,
                limit: LIMIT_ARGUMENT_SCHEMA,
              },
              required: ["initiativeId"],
            },
            commandKey: "initiative.list_updates",
            commandPath: ["initiative", "list_updates"],
            description: "List updates posted on one Linear initiative.",
            exampleArguments: {
              initiativeId: "initiative-id",
              limit: 25,
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "initiative",
              "updates",
              "status update",
            ],
            label: "List initiative updates",
            resultMode: "json",
            usageNotes: [
              "Use this when you need the historical status updates for one initiative.",
            ],
            validate: (argumentsObject) => ({
              initiativeId:
                typeof argumentsObject.initiativeId === "string"
                  ? argumentsObject.initiativeId.trim()
                  : "",
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 25,
            }),
            execute: executeLinearInitiativeListUpdates,
          },
        ],
        description:
          "Initiative reads and writes for roadmap-level planning in the connected Linear workspace.",
        groupKey: "initiative",
        groupPath: ["initiative"],
        intentKeywords: ["linear", "initiative", "initiatives", "roadmap"],
        label: "Initiatives",
      },
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
            commandKey: "cycle.archive",
            commandPath: ["cycle", "archive"],
            description: "Archive one Linear cycle.",
            exampleArguments: {
              cycleId: "cycle-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "cycle", "archive", "close", "sprint"],
            label: "Archive cycle",
            resultMode: "json",
            usageNotes: [
              "Use this when the cycle should be archived in Linear.",
            ],
            validate: (argumentsObject) => ({
              cycleId:
                typeof argumentsObject.cycleId === "string"
                  ? argumentsObject.cycleId.trim()
                  : "",
            }),
            execute: executeLinearCycleArchive,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                cycleId: CYCLE_ID_ARGUMENT_SCHEMA,
                limit: LIMIT_ARGUMENT_SCHEMA,
              },
              required: ["cycleId"],
            },
            commandKey: "cycle.list_issues",
            commandPath: ["cycle", "list_issues"],
            description: "List issues attached to one Linear cycle.",
            exampleArguments: {
              cycleId: "cycle-id",
              limit: 25,
            },
            inputMode: "json",
            intentKeywords: ["linear", "cycle", "issues", "sprint issues"],
            label: "List cycle issues",
            resultMode: "json",
            usageNotes: [
              "Use this to expand a cycle into the underlying issue work scheduled inside that sprint.",
            ],
            validate: (argumentsObject) => ({
              cycleId:
                typeof argumentsObject.cycleId === "string"
                  ? argumentsObject.cycleId.trim()
                  : "",
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 25,
            }),
            execute: executeLinearCycleListIssues,
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
                limit: LIMIT_ARGUMENT_SCHEMA,
              },
            },
            commandKey: "team.list",
            commandPath: ["team", "list"],
            description:
              "List teams visible in the connected Linear workspace with normalized team metadata.",
            exampleArguments: {
              limit: 25,
            },
            inputMode: "json",
            intentKeywords: ["linear", "team", "teams", "squad", "group"],
            label: "List teams",
            resultMode: "json",
            usageNotes: [
              "Use this when you need canonical team ids or keys before reading one team or narrowing team-specific work.",
            ],
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 25,
            }),
            execute: executeLinearTeamList,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                teamIdOrKey: TEAM_ID_OR_KEY_ARGUMENT_SCHEMA,
              },
              required: ["teamIdOrKey"],
            },
            commandKey: "team.get",
            commandPath: ["team", "get"],
            description:
              "Read one Linear team by team id, or by short team key if you already have it, and return normalized team context.",
            exampleArguments: {
              teamIdOrKey: "6332efd5-64d0-4e60-a33f-9078e7f2620b",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "team",
              "squad",
              "group",
              "team settings",
            ],
            label: "Get team",
            resultMode: "json",
            usageNotes: [
              "Prefer the canonical team id from workspace.list_teams for the most reliable lookup path.",
            ],
            validate: (argumentsObject) => ({
              teamIdOrKey:
                typeof argumentsObject.teamIdOrKey === "string"
                  ? argumentsObject.teamIdOrKey.trim()
                  : "",
            }),
            execute: executeLinearTeamGet,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                limit: LIMIT_ARGUMENT_SCHEMA,
                teamIdOrKey: TEAM_ID_OR_KEY_ARGUMENT_SCHEMA,
              },
              required: ["teamIdOrKey"],
            },
            commandKey: "team.list_cycles",
            commandPath: ["team", "list_cycles"],
            description: "List cycles associated with one Linear team.",
            exampleArguments: {
              limit: 25,
              teamIdOrKey: "6332efd5-64d0-4e60-a33f-9078e7f2620b",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "team",
              "cycles",
              "sprints",
              "iterations",
            ],
            label: "List team cycles",
            resultMode: "json",
            usageNotes: [
              "Prefer a canonical team id from workspace.list_teams before reading team-specific collections.",
              "Use this when you need the cycle history or active sprint context for one team.",
            ],
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 25,
              teamIdOrKey:
                typeof argumentsObject.teamIdOrKey === "string"
                  ? argumentsObject.teamIdOrKey.trim()
                  : "",
            }),
            execute: executeLinearTeamListCycles,
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
                teamIdOrKey: TEAM_ID_OR_KEY_ARGUMENT_SCHEMA,
              },
              required: ["teamIdOrKey"],
            },
            commandKey: "team.list_workflow_states",
            commandPath: ["team", "list_workflow_states"],
            description:
              "List workflow states associated with one Linear team.",
            exampleArguments: {
              limit: 50,
              teamIdOrKey: "6332efd5-64d0-4e60-a33f-9078e7f2620b",
            },
            inputMode: "json",
            intentKeywords: ["linear", "team", "workflow", "states", "status"],
            label: "List team workflow states",
            resultMode: "json",
            usageNotes: [
              "Prefer a canonical team id from workspace.list_teams before reading team-specific collections.",
              "Use this when you need the canonical workflow states for one team before filtering or updating team issues.",
            ],
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 50,
              teamIdOrKey:
                typeof argumentsObject.teamIdOrKey === "string"
                  ? argumentsObject.teamIdOrKey.trim()
                  : "",
            }),
            execute: executeLinearTeamListWorkflowStates,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                limit: LIMIT_ARGUMENT_SCHEMA,
                teamIdOrKey: TEAM_ID_OR_KEY_ARGUMENT_SCHEMA,
              },
              required: ["teamIdOrKey"],
            },
            commandKey: "team.list_labels",
            commandPath: ["team", "list_labels"],
            description: "List issue labels associated with one Linear team.",
            exampleArguments: {
              limit: 25,
              teamIdOrKey: "6332efd5-64d0-4e60-a33f-9078e7f2620b",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "team",
              "labels",
              "taxonomy",
              "issue labels",
            ],
            label: "List team labels",
            resultMode: "json",
            usageNotes: [
              "Prefer a canonical team id from workspace.list_teams before reading team-specific collections.",
              "Use this when you need team-scoped issue labels before labeling or filtering issues.",
            ],
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 25,
              teamIdOrKey:
                typeof argumentsObject.teamIdOrKey === "string"
                  ? argumentsObject.teamIdOrKey.trim()
                  : "",
            }),
            execute: executeLinearTeamListLabels,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                limit: LIMIT_ARGUMENT_SCHEMA,
                teamIdOrKey: TEAM_ID_OR_KEY_ARGUMENT_SCHEMA,
              },
              required: ["teamIdOrKey"],
            },
            commandKey: "team.list_projects",
            commandPath: ["team", "list_projects"],
            description: "List projects associated with one Linear team.",
            exampleArguments: {
              limit: 10,
              teamIdOrKey: "6332efd5-64d0-4e60-a33f-9078e7f2620b",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "team",
              "projects",
              "roadmap",
              "planning",
            ],
            label: "List team projects",
            resultMode: "json",
            usageNotes: [
              "Prefer a canonical team id from workspace.list_teams before reading team-specific collections.",
              "Use this when you need the project portfolio or planning context for one team.",
            ],
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 10,
              teamIdOrKey:
                typeof argumentsObject.teamIdOrKey === "string"
                  ? argumentsObject.teamIdOrKey.trim()
                  : "",
            }),
            execute: executeLinearTeamListProjects,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                limit: LIMIT_ARGUMENT_SCHEMA,
                teamIdOrKey: TEAM_ID_OR_KEY_ARGUMENT_SCHEMA,
              },
              required: ["teamIdOrKey"],
            },
            commandKey: "team.list_issues",
            commandPath: ["team", "list_issues"],
            description: "List issues associated with one Linear team.",
            exampleArguments: {
              limit: 25,
              teamIdOrKey: "6332efd5-64d0-4e60-a33f-9078e7f2620b",
            },
            inputMode: "json",
            intentKeywords: ["linear", "team", "issues", "tickets", "backlog"],
            label: "List team issues",
            resultMode: "json",
            usageNotes: [
              "Prefer a canonical team id from workspace.list_teams before reading team-specific collections.",
              "Use this when you need the recent issue backlog or active work for one team.",
            ],
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 25,
              teamIdOrKey:
                typeof argumentsObject.teamIdOrKey === "string"
                  ? argumentsObject.teamIdOrKey.trim()
                  : "",
            }),
            execute: executeLinearTeamListIssues,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                teamIdOrKey: TEAM_ID_OR_KEY_ARGUMENT_SCHEMA,
              },
              required: ["teamIdOrKey"],
            },
            commandKey: "team.delete",
            commandPath: ["team", "delete"],
            description: "Delete one Linear team.",
            exampleArguments: {
              teamIdOrKey: "6332efd5-64d0-4e60-a33f-9078e7f2620b",
            },
            inputMode: "json",
            intentKeywords: ["linear", "team", "delete team", "remove team"],
            label: "Delete team",
            resultMode: "json",
            usageNotes: [
              "Prefer the canonical team id from workspace.list_teams before deleting a team.",
              "This may require elevated Linear workspace permissions.",
            ],
            validate: (argumentsObject) => ({
              teamIdOrKey:
                typeof argumentsObject.teamIdOrKey === "string"
                  ? argumentsObject.teamIdOrKey.trim()
                  : "",
            }),
            execute: executeLinearTeamDelete,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                alsoLeaveParentTeams: {
                  type: "boolean",
                  description:
                    "Whether to also remove the user from inherited parent team memberships.",
                },
                membershipId: TEAM_MEMBERSHIP_ID_ARGUMENT_SCHEMA,
              },
              required: ["membershipId"],
            },
            commandKey: "team.members_remove",
            commandPath: ["team", "members_remove"],
            description: "Remove one user from a Linear team by membership id.",
            exampleArguments: {
              membershipId: "team-membership-id",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "team",
              "remove team member",
              "leave team",
              "team membership",
            ],
            label: "Remove team member",
            resultMode: "json",
            usageNotes: [
              "Use user.list_team_memberships first to get the canonical membership id.",
              "Set alsoLeaveParentTeams when the membership was inherited from a parent team structure.",
            ],
            validate: (argumentsObject) => ({
              alsoLeaveParentTeams:
                typeof argumentsObject.alsoLeaveParentTeams === "boolean"
                  ? argumentsObject.alsoLeaveParentTeams
                  : undefined,
              membershipId:
                typeof argumentsObject.membershipId === "string"
                  ? argumentsObject.membershipId.trim()
                  : "",
            }),
            execute: executeLinearTeamMembersRemove,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                membershipId: TEAM_MEMBERSHIP_ID_ARGUMENT_SCHEMA,
                owner: {
                  type: "boolean",
                  description: "Whether the user should be a team owner.",
                },
                sortOrder: {
                  type: "number",
                  description: "Optional sort order for the team membership.",
                },
              },
              required: ["membershipId"],
            },
            commandKey: "team.members_update",
            commandPath: ["team", "members_update"],
            description: "Update one Linear team membership.",
            exampleArguments: {
              membershipId: "team-membership-id",
              owner: true,
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "team",
              "update team member",
              "promote team member",
              "change team membership",
              "team membership",
            ],
            label: "Update team member",
            resultMode: "json",
            usageNotes: [
              "Use user.list_team_memberships first to get the canonical membership id.",
              "This requires at least one update field besides membershipId.",
            ],
            validate: (argumentsObject) => ({
              membershipId:
                typeof argumentsObject.membershipId === "string"
                  ? argumentsObject.membershipId.trim()
                  : "",
              owner:
                typeof argumentsObject.owner === "boolean"
                  ? argumentsObject.owner
                  : undefined,
              sortOrder:
                typeof argumentsObject.sortOrder === "number" &&
                Number.isFinite(argumentsObject.sortOrder)
                  ? argumentsObject.sortOrder
                  : undefined,
            }),
            execute: executeLinearTeamMembersUpdate,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                owner: {
                  type: "boolean",
                  description: "Whether the user should be a team owner.",
                },
                sortOrder: {
                  type: "number",
                  description: "Optional sort order for the team membership.",
                },
                teamIdOrKey: TEAM_ID_OR_KEY_ARGUMENT_SCHEMA,
                userId: USER_ID_ARGUMENT_SCHEMA,
              },
              required: ["teamIdOrKey", "userId"],
            },
            commandKey: "team.members_add",
            commandPath: ["team", "members_add"],
            description: "Add one user to a Linear team.",
            exampleArguments: {
              teamIdOrKey: "6332efd5-64d0-4e60-a33f-9078e7f2620b",
              userId: "7036157e-c337-4699-8134-6b833b85b844",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "team",
              "add team member",
              "invite to team",
              "team membership",
            ],
            label: "Add team member",
            resultMode: "json",
            usageNotes: [
              "Prefer the canonical team id from workspace.list_teams before adding a team member.",
              "Use user.list to find the target Linear user id first.",
            ],
            validate: (argumentsObject) => ({
              owner:
                typeof argumentsObject.owner === "boolean"
                  ? argumentsObject.owner
                  : undefined,
              sortOrder:
                typeof argumentsObject.sortOrder === "number" &&
                Number.isFinite(argumentsObject.sortOrder)
                  ? argumentsObject.sortOrder
                  : undefined,
              teamIdOrKey:
                typeof argumentsObject.teamIdOrKey === "string"
                  ? argumentsObject.teamIdOrKey.trim()
                  : "",
              userId:
                typeof argumentsObject.userId === "string"
                  ? argumentsObject.userId.trim()
                  : "",
            }),
            execute: executeLinearTeamMembersAdd,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                teamIdOrKey: TEAM_ID_OR_KEY_ARGUMENT_SCHEMA,
              },
              required: ["teamIdOrKey"],
            },
            commandKey: "team.unarchive",
            commandPath: ["team", "unarchive"],
            description: "Unarchive one previously deleted Linear team.",
            exampleArguments: {
              teamIdOrKey: "6332efd5-64d0-4e60-a33f-9078e7f2620b",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "team",
              "restore team",
              "unarchive team",
            ],
            label: "Unarchive team",
            resultMode: "json",
            usageNotes: [
              "Prefer the canonical team id from workspace.list_teams before restoring a team.",
              "This may require elevated Linear workspace permissions.",
            ],
            validate: (argumentsObject) => ({
              teamIdOrKey:
                typeof argumentsObject.teamIdOrKey === "string"
                  ? argumentsObject.teamIdOrKey.trim()
                  : "",
            }),
            execute: executeLinearTeamUnarchive,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                color: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                cyclesEnabled: {
                  type: "boolean",
                  description: "Whether the team uses cycles.",
                },
                description: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                icon: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                key: TEAM_KEY_ARGUMENT_SCHEMA,
                name: TEAM_NAME_ARGUMENT_SCHEMA,
                private: {
                  type: "boolean",
                  description: "Whether the team is private.",
                },
                triageEnabled: {
                  type: "boolean",
                  description: "Whether triage mode is enabled for the team.",
                },
              },
              required: ["name"],
            },
            commandKey: "team.create",
            commandPath: ["team", "create"],
            description: "Create a new Linear team.",
            exampleArguments: {
              key: "OPS",
              name: "Operations",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "team",
              "create team",
              "new team",
              "new squad",
            ],
            label: "Create team",
            resultMode: "json",
            usageNotes: [
              "This may require elevated Linear workspace permissions.",
            ],
            validate: (argumentsObject) => ({
              color:
                typeof argumentsObject.color === "string"
                  ? argumentsObject.color.trim()
                  : undefined,
              cyclesEnabled:
                typeof argumentsObject.cyclesEnabled === "boolean"
                  ? argumentsObject.cyclesEnabled
                  : undefined,
              description:
                typeof argumentsObject.description === "string"
                  ? argumentsObject.description.trim()
                  : undefined,
              icon:
                typeof argumentsObject.icon === "string"
                  ? argumentsObject.icon.trim()
                  : undefined,
              key:
                typeof argumentsObject.key === "string"
                  ? argumentsObject.key.trim()
                  : undefined,
              name:
                typeof argumentsObject.name === "string"
                  ? argumentsObject.name.trim()
                  : "",
              private:
                typeof argumentsObject.private === "boolean"
                  ? argumentsObject.private
                  : undefined,
              triageEnabled:
                typeof argumentsObject.triageEnabled === "boolean"
                  ? argumentsObject.triageEnabled
                  : undefined,
            }),
            execute: executeLinearTeamCreate,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                color: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                cyclesEnabled: {
                  type: "boolean",
                  description: "Whether the team uses cycles.",
                },
                description: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                icon: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                key: TEAM_KEY_ARGUMENT_SCHEMA,
                name: TEAM_NAME_ARGUMENT_SCHEMA,
                private: {
                  type: "boolean",
                  description: "Whether the team is private.",
                },
                teamIdOrKey: TEAM_ID_OR_KEY_ARGUMENT_SCHEMA,
                triageEnabled: {
                  type: "boolean",
                  description: "Whether triage mode is enabled for the team.",
                },
              },
              required: ["teamIdOrKey"],
            },
            commandKey: "team.update",
            commandPath: ["team", "update"],
            description: "Update one existing Linear team.",
            exampleArguments: {
              teamIdOrKey: "6332efd5-64d0-4e60-a33f-9078e7f2620b",
              triageEnabled: true,
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "team",
              "update team",
              "edit team",
              "team settings",
            ],
            label: "Update team",
            resultMode: "json",
            usageNotes: [
              "This requires at least one update field besides teamIdOrKey.",
              "Prefer the canonical team id from workspace.list_teams before updating a team.",
              "This may require elevated Linear workspace permissions.",
            ],
            validate: (argumentsObject) => ({
              color:
                typeof argumentsObject.color === "string"
                  ? argumentsObject.color.trim()
                  : undefined,
              cyclesEnabled:
                typeof argumentsObject.cyclesEnabled === "boolean"
                  ? argumentsObject.cyclesEnabled
                  : undefined,
              description:
                typeof argumentsObject.description === "string"
                  ? argumentsObject.description.trim()
                  : undefined,
              icon:
                typeof argumentsObject.icon === "string"
                  ? argumentsObject.icon.trim()
                  : undefined,
              key:
                typeof argumentsObject.key === "string"
                  ? argumentsObject.key.trim()
                  : undefined,
              name:
                typeof argumentsObject.name === "string"
                  ? argumentsObject.name.trim()
                  : undefined,
              private:
                typeof argumentsObject.private === "boolean"
                  ? argumentsObject.private
                  : undefined,
              teamIdOrKey:
                typeof argumentsObject.teamIdOrKey === "string"
                  ? argumentsObject.teamIdOrKey.trim()
                  : "",
              triageEnabled:
                typeof argumentsObject.triageEnabled === "boolean"
                  ? argumentsObject.triageEnabled
                  : undefined,
            }),
            execute: executeLinearTeamUpdate,
          },
        ],
        description:
          "Team reads and writes for the connected Linear workspace.",
        groupKey: "team",
        groupPath: ["team"],
        intentKeywords: ["linear", "team", "squad", "group", "planning"],
        label: "Teams",
      },
      {
        commands: [
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                avatarUrl: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                description: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                displayName: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                name: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                statusEmoji: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                statusLabel: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                statusUntilAt: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                timezone: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                userId: USER_ID_ARGUMENT_SCHEMA,
              },
              required: ["userId"],
            },
            commandKey: "workspace_member.update",
            commandPath: ["workspace_member", "update"],
            description: "Update one existing Linear workspace member profile.",
            exampleArguments: {
              statusLabel: "Helping customers",
              userId: "7036157e-c337-4699-8134-6b833b85b844",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "workspace member",
              "update member",
              "update user",
              "member profile",
            ],
            label: "Update workspace member",
            resultMode: "json",
            usageNotes: [
              "This updates the Linear user profile fields, not workspace role assignments.",
              "Use user.list or user.get first to confirm the target user id.",
            ],
            validate: (argumentsObject) => ({
              avatarUrl:
                typeof argumentsObject.avatarUrl === "string"
                  ? argumentsObject.avatarUrl.trim()
                  : undefined,
              description:
                typeof argumentsObject.description === "string"
                  ? argumentsObject.description.trim()
                  : undefined,
              displayName:
                typeof argumentsObject.displayName === "string"
                  ? argumentsObject.displayName.trim()
                  : undefined,
              name:
                typeof argumentsObject.name === "string"
                  ? argumentsObject.name.trim()
                  : undefined,
              statusEmoji:
                typeof argumentsObject.statusEmoji === "string"
                  ? argumentsObject.statusEmoji.trim()
                  : undefined,
              statusLabel:
                typeof argumentsObject.statusLabel === "string"
                  ? argumentsObject.statusLabel.trim()
                  : undefined,
              statusUntilAt:
                typeof argumentsObject.statusUntilAt === "string"
                  ? argumentsObject.statusUntilAt.trim()
                  : undefined,
              timezone:
                typeof argumentsObject.timezone === "string"
                  ? argumentsObject.timezone.trim()
                  : undefined,
              userId:
                typeof argumentsObject.userId === "string"
                  ? argumentsObject.userId.trim()
                  : "",
            }),
            execute: executeLinearWorkspaceMemberUpdate,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                email: EMAIL_ARGUMENT_SCHEMA,
                inviteId: ORGANIZATION_INVITE_ID_ARGUMENT_SCHEMA,
              },
            },
            commandKey: "workspace_member.invite_resend",
            commandPath: ["workspace_member", "invite_resend"],
            description:
              "Resend one pending Linear workspace invite by invite id or email.",
            exampleArguments: {
              inviteId: "organization-invite-id",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "workspace member",
              "resend invite",
              "retry invite email",
              "organization invite",
            ],
            label: "Resend workspace invite",
            resultMode: "json",
            usageNotes: [
              "Prefer inviteId when you already have the canonical invite id.",
              "Use email only when you need a simpler fallback lookup.",
            ],
            validate: (argumentsObject) => ({
              email:
                typeof argumentsObject.email === "string"
                  ? argumentsObject.email.trim()
                  : undefined,
              inviteId:
                typeof argumentsObject.inviteId === "string"
                  ? argumentsObject.inviteId.trim()
                  : undefined,
            }),
            execute: executeLinearWorkspaceMemberInviteResend,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                inviteId: ORGANIZATION_INVITE_ID_ARGUMENT_SCHEMA,
              },
              required: ["inviteId"],
            },
            commandKey: "workspace_member.invite_cancel",
            commandPath: ["workspace_member", "invite_cancel"],
            description: "Cancel one pending Linear workspace invite.",
            exampleArguments: {
              inviteId: "organization-invite-id",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "workspace member",
              "cancel invite",
              "revoke invite",
              "organization invite",
            ],
            label: "Cancel workspace invite",
            resultMode: "json",
            usageNotes: [
              "Use the inviteId returned by workspace_member.invite or a future invite-list command.",
            ],
            validate: (argumentsObject) => ({
              inviteId:
                typeof argumentsObject.inviteId === "string"
                  ? argumentsObject.inviteId.trim()
                  : "",
            }),
            execute: executeLinearWorkspaceMemberInviteCancel,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                inviteId: ORGANIZATION_INVITE_ID_ARGUMENT_SCHEMA,
                teamIds: TEAM_IDS_ARGUMENT_SCHEMA,
              },
              required: ["inviteId", "teamIds"],
            },
            commandKey: "workspace_member.invite_update",
            commandPath: ["workspace_member", "invite_update"],
            description:
              "Update one pending Linear workspace invite by replacing its assigned team ids.",
            exampleArguments: {
              inviteId: "organization-invite-id",
              teamIds: ["6332efd5-64d0-4e60-a33f-9078e7f2620b"],
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "workspace member",
              "update invite",
              "change invite teams",
              "organization invite",
            ],
            label: "Update workspace invite",
            resultMode: "json",
            usageNotes: [
              "Use the inviteId returned by workspace_member.invite or a future invite-list command.",
              "teamIds replaces the full team assignment for that pending invite.",
            ],
            validate: (argumentsObject) => ({
              inviteId:
                typeof argumentsObject.inviteId === "string"
                  ? argumentsObject.inviteId.trim()
                  : "",
              teamIds: Array.isArray(argumentsObject.teamIds)
                ? argumentsObject.teamIds
                    .filter((value) => typeof value === "string")
                    .map((value) => value.trim())
                    .filter((value) => value.length > 0)
                : [],
            }),
            execute: executeLinearWorkspaceMemberInviteUpdate,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                email: EMAIL_ARGUMENT_SCHEMA,
                role: USER_ROLE_ARGUMENT_SCHEMA,
                teamIds: TEAM_IDS_ARGUMENT_SCHEMA,
              },
              required: ["email"],
            },
            commandKey: "workspace_member.invite",
            commandPath: ["workspace_member", "invite"],
            description:
              "Invite one person into the Linear workspace, optionally scoped to teams.",
            exampleArguments: {
              email: "person@example.com",
              role: "user",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "workspace member",
              "invite member",
              "invite teammate",
              "organization invite",
            ],
            label: "Invite workspace member",
            resultMode: "json",
            usageNotes: [
              "Use teamIds to pre-assign the invited person to one or more teams.",
              "This requires Linear workspace invite permissions.",
            ],
            validate: (argumentsObject) => ({
              email:
                typeof argumentsObject.email === "string"
                  ? argumentsObject.email.trim()
                  : "",
              role:
                typeof argumentsObject.role === "string"
                  ? argumentsObject.role.trim()
                  : undefined,
              teamIds: Array.isArray(argumentsObject.teamIds)
                ? argumentsObject.teamIds
                    .filter((value) => typeof value === "string")
                    .map((value) => value.trim())
                    .filter((value) => value.length > 0)
                : undefined,
            }),
            execute: executeLinearWorkspaceMemberInvite,
          },
        ],
        description:
          "Workspace invite and member-management commands for the connected Linear workspace.",
        groupKey: "workspace_member",
        groupPath: ["workspace_member"],
        intentKeywords: ["linear", "workspace", "member", "invite", "people"],
        label: "Workspace Members",
      },
      {
        commands: [
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                userId: USER_ID_ARGUMENT_SCHEMA,
              },
              required: ["userId"],
            },
            commandKey: "user.get",
            commandPath: ["user", "get"],
            description:
              "Read one Linear user by user id and return normalized user context.",
            exampleArguments: {
              userId: "user-id",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "user",
              "person",
              "member",
              "profile",
              "assignee",
            ],
            label: "Get user",
            resultMode: "json",
            usageNotes: [
              "Use workspace.list_users first if you need a canonical Linear user id.",
            ],
            validate: (argumentsObject) => ({
              userId:
                typeof argumentsObject.userId === "string"
                  ? argumentsObject.userId.trim()
                  : "",
            }),
            execute: executeLinearUserGet,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                limit: LIMIT_ARGUMENT_SCHEMA,
              },
            },
            commandKey: "user.list",
            commandPath: ["user", "list"],
            description:
              "List users visible in the connected Linear workspace with normalized profile fields.",
            exampleArguments: {
              limit: 25,
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "user",
              "users",
              "people",
              "members",
              "assignees",
            ],
            label: "List users",
            resultMode: "json",
            usageNotes: [
              "Use this when you need canonical Linear user ids before reading one user or filtering work by person.",
            ],
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 25,
            }),
            execute: executeLinearUserList,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                limit: LIMIT_ARGUMENT_SCHEMA,
                userId: USER_ID_ARGUMENT_SCHEMA,
              },
              required: ["userId"],
            },
            commandKey: "user.list_assigned_issues",
            commandPath: ["user", "list_assigned_issues"],
            description: "List issues currently assigned to one Linear user.",
            exampleArguments: {
              limit: 25,
              userId: "user-id",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "user",
              "assignee",
              "assigned issues",
              "owned issues",
            ],
            label: "List assigned issues",
            resultMode: "json",
            usageNotes: [
              "Use this when you need the current issue workload for one Linear user.",
            ],
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 25,
              userId:
                typeof argumentsObject.userId === "string"
                  ? argumentsObject.userId.trim()
                  : "",
            }),
            execute: executeLinearUserListAssignedIssues,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                limit: LIMIT_ARGUMENT_SCHEMA,
                userId: USER_ID_ARGUMENT_SCHEMA,
              },
              required: ["userId"],
            },
            commandKey: "user.list_created_issues",
            commandPath: ["user", "list_created_issues"],
            description: "List issues created by one Linear user.",
            exampleArguments: {
              limit: 25,
              userId: "user-id",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "user",
              "creator",
              "created issues",
              "opened issues",
            ],
            label: "List created issues",
            resultMode: "json",
            usageNotes: [
              "Use this when you need the issue work originally opened by one Linear user.",
            ],
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 25,
              userId:
                typeof argumentsObject.userId === "string"
                  ? argumentsObject.userId.trim()
                  : "",
            }),
            execute: executeLinearUserListCreatedIssues,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                limit: LIMIT_ARGUMENT_SCHEMA,
                userId: USER_ID_ARGUMENT_SCHEMA,
              },
              required: ["userId"],
            },
            commandKey: "user.list_team_memberships",
            commandPath: ["user", "list_team_memberships"],
            description: "List team memberships for one Linear user.",
            exampleArguments: {
              limit: 25,
              userId: "user-id",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "user",
              "team memberships",
              "teams",
              "member of",
            ],
            label: "List team memberships",
            resultMode: "json",
            usageNotes: [
              "Use this when you need the team footprint and team-owner state for one Linear user.",
            ],
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 25,
              userId:
                typeof argumentsObject.userId === "string"
                  ? argumentsObject.userId.trim()
                  : "",
            }),
            execute: executeLinearUserListTeamMemberships,
          },
        ],
        description: "User profile reads for the connected Linear workspace.",
        groupKey: "user",
        groupPath: ["user"],
        intentKeywords: ["linear", "user", "people", "members", "assignee"],
        label: "Users",
      },
      {
        commands: [
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                limit: LIMIT_ARGUMENT_SCHEMA,
              },
            },
            commandKey: "document.list",
            commandPath: ["document", "list"],
            description:
              "List recently updated documents from the connected Linear workspace.",
            exampleArguments: {
              limit: 25,
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "document",
              "documents",
              "docs",
              "knowledge",
            ],
            label: "List documents",
            resultMode: "json",
            usageNotes: [
              "Use this to browse recent documents before reading or updating one in detail.",
            ],
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 25,
            }),
            execute: executeLinearDocumentList,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                documentId: DOCUMENT_ID_ARGUMENT_SCHEMA,
              },
              required: ["documentId"],
            },
            commandKey: "document.get",
            commandPath: ["document", "get"],
            description:
              "Read one Linear document by document id and return normalized document context.",
            exampleArguments: {
              documentId: "document-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "document", "doc", "read document"],
            label: "Get document",
            resultMode: "json",
            usageNotes: [
              "Use document ids returned by document.list or project.list_documents before reading one document in detail.",
            ],
            validate: (argumentsObject) => ({
              documentId:
                typeof argumentsObject.documentId === "string"
                  ? argumentsObject.documentId.trim()
                  : "",
            }),
            execute: executeLinearDocumentGet,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                limit: {
                  ...LIMIT_ARGUMENT_SCHEMA,
                  maximum: 25,
                },
                query: DOCUMENT_QUERY_ARGUMENT_SCHEMA,
              },
              required: ["query"],
            },
            commandKey: "document.search",
            commandPath: ["document", "search"],
            description:
              "Search documents across the connected Linear workspace.",
            exampleArguments: {
              limit: 5,
              query: "credit",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "document",
              "docs",
              "search",
              "knowledge",
              "spec",
            ],
            label: "Search documents",
            resultMode: "json",
            usageNotes: [
              "Use free-text search terms that should match document titles or document content.",
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
            execute: executeLinearDocumentSearch,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                documentId: DOCUMENT_ID_ARGUMENT_SCHEMA,
              },
              required: ["documentId"],
            },
            commandKey: "document.delete",
            commandPath: ["document", "delete"],
            description: "Delete one Linear document.",
            exampleArguments: {
              documentId: "document-1",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "document",
              "delete document",
              "remove document",
            ],
            label: "Delete document",
            resultMode: "json",
            usageNotes: [
              "This permanently deletes the document instead of updating or reparenting it.",
            ],
            validate: (argumentsObject) => ({
              documentId:
                typeof argumentsObject.documentId === "string"
                  ? argumentsObject.documentId.trim()
                  : "",
            }),
            execute: executeLinearDocumentDelete,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                color: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                content: {
                  type: "string",
                  minLength: 1,
                  description: "Document body in markdown.",
                },
                cycleId: CYCLE_ID_ARGUMENT_SCHEMA,
                icon: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                initiativeId: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                issueId: IDENTIFIER_OR_ID_ARGUMENT_SCHEMA,
                lastAppliedTemplateId: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                projectId: PROJECT_ID_ARGUMENT_SCHEMA,
                resourceFolderId: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                sortOrder: {
                  type: "integer",
                  description: "Optional document sort order.",
                },
                subscriberIds: {
                  type: "array",
                  items: {
                    type: "string",
                    minLength: 1,
                  },
                  description:
                    "Optional list of Linear user ids subscribed to the document.",
                },
                teamId: {
                  type: "string",
                  minLength: 1,
                  description: "Optional owning Linear team id.",
                },
                title: DOCUMENT_TITLE_ARGUMENT_SCHEMA,
              },
              required: ["title"],
            },
            commandKey: "document.create",
            commandPath: ["document", "create"],
            description: "Create a new Linear document.",
            exampleArguments: {
              projectId: "project-id",
              title: "Credits workflow doc",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "document",
              "create doc",
              "new document",
            ],
            label: "Create document",
            resultMode: "json",
            usageNotes: [
              "Attach the document to a project, issue, team, initiative, or cycle when you want it anchored to work in Linear.",
            ],
            validate: (argumentsObject) => ({
              color:
                typeof argumentsObject.color === "string"
                  ? argumentsObject.color.trim()
                  : null,
              content:
                typeof argumentsObject.content === "string"
                  ? argumentsObject.content.trim()
                  : null,
              cycleId:
                typeof argumentsObject.cycleId === "string"
                  ? argumentsObject.cycleId.trim()
                  : null,
              icon:
                typeof argumentsObject.icon === "string"
                  ? argumentsObject.icon.trim()
                  : null,
              initiativeId:
                typeof argumentsObject.initiativeId === "string"
                  ? argumentsObject.initiativeId.trim()
                  : null,
              issueId:
                typeof argumentsObject.issueId === "string"
                  ? argumentsObject.issueId.trim()
                  : null,
              lastAppliedTemplateId:
                typeof argumentsObject.lastAppliedTemplateId === "string"
                  ? argumentsObject.lastAppliedTemplateId.trim()
                  : null,
              projectId:
                typeof argumentsObject.projectId === "string"
                  ? argumentsObject.projectId.trim()
                  : null,
              resourceFolderId:
                typeof argumentsObject.resourceFolderId === "string"
                  ? argumentsObject.resourceFolderId.trim()
                  : null,
              sortOrder:
                typeof argumentsObject.sortOrder === "number" &&
                Number.isInteger(argumentsObject.sortOrder)
                  ? argumentsObject.sortOrder
                  : null,
              subscriberIds: Array.isArray(argumentsObject.subscriberIds)
                ? argumentsObject.subscriberIds
                : null,
              teamId:
                typeof argumentsObject.teamId === "string"
                  ? argumentsObject.teamId.trim()
                  : null,
              title:
                typeof argumentsObject.title === "string"
                  ? argumentsObject.title.trim()
                  : "",
            }),
            execute: executeLinearDocumentCreate,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                color: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                content: {
                  type: "string",
                  minLength: 1,
                  description: "Updated document body in markdown.",
                },
                cycleId: CYCLE_ID_ARGUMENT_SCHEMA,
                documentId: DOCUMENT_ID_ARGUMENT_SCHEMA,
                hiddenAt: {
                  ...DATETIME_ARGUMENT_SCHEMA,
                  description: "Optional timestamp to hide the document.",
                },
                icon: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                initiativeId: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                issueId: IDENTIFIER_OR_ID_ARGUMENT_SCHEMA,
                lastAppliedTemplateId: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                projectId: PROJECT_ID_ARGUMENT_SCHEMA,
                resourceFolderId: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                sortOrder: {
                  type: "integer",
                  description: "Optional updated document sort order.",
                },
                subscriberIds: {
                  type: "array",
                  items: {
                    type: "string",
                    minLength: 1,
                  },
                  description:
                    "Optional updated list of Linear user ids subscribed to the document.",
                },
                teamId: {
                  type: "string",
                  minLength: 1,
                  description: "Optional updated owning Linear team id.",
                },
                title: DOCUMENT_TITLE_ARGUMENT_SCHEMA,
                trashed: {
                  type: "boolean",
                  description: "Whether the document should be marked trashed.",
                },
              },
              required: ["documentId"],
            },
            commandKey: "document.update",
            commandPath: ["document", "update"],
            description: "Update one Linear document.",
            exampleArguments: {
              documentId: "document-id",
              title: "Updated credits workflow doc",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "document",
              "update doc",
              "edit document",
            ],
            label: "Update document",
            resultMode: "json",
            usageNotes: [
              "This requires at least one update field besides documentId.",
            ],
            validate: (argumentsObject) => ({
              color:
                typeof argumentsObject.color === "string"
                  ? argumentsObject.color.trim()
                  : null,
              content:
                typeof argumentsObject.content === "string"
                  ? argumentsObject.content.trim()
                  : null,
              cycleId:
                typeof argumentsObject.cycleId === "string"
                  ? argumentsObject.cycleId.trim()
                  : null,
              documentId:
                typeof argumentsObject.documentId === "string"
                  ? argumentsObject.documentId.trim()
                  : "",
              hiddenAt:
                typeof argumentsObject.hiddenAt === "string"
                  ? argumentsObject.hiddenAt.trim()
                  : null,
              icon:
                typeof argumentsObject.icon === "string"
                  ? argumentsObject.icon.trim()
                  : null,
              initiativeId:
                typeof argumentsObject.initiativeId === "string"
                  ? argumentsObject.initiativeId.trim()
                  : null,
              issueId:
                typeof argumentsObject.issueId === "string"
                  ? argumentsObject.issueId.trim()
                  : null,
              lastAppliedTemplateId:
                typeof argumentsObject.lastAppliedTemplateId === "string"
                  ? argumentsObject.lastAppliedTemplateId.trim()
                  : null,
              projectId:
                typeof argumentsObject.projectId === "string"
                  ? argumentsObject.projectId.trim()
                  : null,
              resourceFolderId:
                typeof argumentsObject.resourceFolderId === "string"
                  ? argumentsObject.resourceFolderId.trim()
                  : null,
              sortOrder:
                typeof argumentsObject.sortOrder === "number" &&
                Number.isInteger(argumentsObject.sortOrder)
                  ? argumentsObject.sortOrder
                  : null,
              subscriberIds: Array.isArray(argumentsObject.subscriberIds)
                ? argumentsObject.subscriberIds
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
            execute: executeLinearDocumentUpdate,
          },
        ],
        description:
          "Document reads and writes for the connected Linear workspace.",
        groupKey: "document",
        groupPath: ["document"],
        intentKeywords: [
          "linear",
          "document",
          "documents",
          "docs",
          "knowledge",
        ],
        label: "Documents",
      },
      {
        commands: [
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                limit: LIMIT_ARGUMENT_SCHEMA,
              },
            },
            commandKey: "label.list_issue_labels",
            commandPath: ["label", "list_issue_labels"],
            description: "List issue labels in the connected Linear workspace.",
            exampleArguments: {
              limit: 25,
            },
            inputMode: "json",
            intentKeywords: ["linear", "labels", "issue labels", "taxonomy"],
            label: "List issue labels",
            resultMode: "json",
            usageNotes: [
              "Use this to browse issue taxonomy before applying or changing issue labels.",
            ],
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 25,
            }),
            execute: executeLinearLabelListIssueLabels,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                labelId: LABEL_ID_ARGUMENT_SCHEMA,
              },
              required: ["labelId"],
            },
            commandKey: "label.get_issue_label",
            commandPath: ["label", "get_issue_label"],
            description: "Read one issue label by id.",
            exampleArguments: {
              labelId: "issue-label-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "issue label", "label details"],
            label: "Get issue label",
            resultMode: "json",
            usageNotes: [
              "Use ids returned by label.list_issue_labels before reading one label in detail.",
            ],
            validate: (argumentsObject) => ({
              labelId:
                typeof argumentsObject.labelId === "string"
                  ? argumentsObject.labelId.trim()
                  : "",
            }),
            execute: executeLinearLabelGetIssueLabel,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                color: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                description: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                isGroup: {
                  type: "boolean",
                  description: "Whether the label is a group label.",
                },
                name: LABEL_NAME_ARGUMENT_SCHEMA,
                parentId: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                replaceTeamLabels: {
                  type: "boolean",
                  description:
                    "Whether matching team labels should be replaced by this workspace label.",
                },
                retiredAt: DATETIME_ARGUMENT_SCHEMA,
                teamId: {
                  type: "string",
                  minLength: 1,
                  description:
                    "Optional team id for a team-scoped issue label.",
                },
              },
              required: ["name"],
            },
            commandKey: "label.create_issue_label",
            commandPath: ["label", "create_issue_label"],
            description: "Create a new issue label.",
            exampleArguments: {
              name: "Customer",
              teamId: "team-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "create issue label", "new issue label"],
            label: "Create issue label",
            resultMode: "json",
            usageNotes: [
              "Omit teamId to create a workspace-level issue label instead of a team-specific one.",
            ],
            validate: (argumentsObject) => ({
              color:
                typeof argumentsObject.color === "string"
                  ? argumentsObject.color.trim()
                  : null,
              description:
                typeof argumentsObject.description === "string"
                  ? argumentsObject.description.trim()
                  : null,
              isGroup:
                typeof argumentsObject.isGroup === "boolean"
                  ? argumentsObject.isGroup
                  : null,
              name:
                typeof argumentsObject.name === "string"
                  ? argumentsObject.name.trim()
                  : "",
              parentId:
                typeof argumentsObject.parentId === "string"
                  ? argumentsObject.parentId.trim()
                  : null,
              replaceTeamLabels:
                typeof argumentsObject.replaceTeamLabels === "boolean"
                  ? argumentsObject.replaceTeamLabels
                  : null,
              retiredAt:
                typeof argumentsObject.retiredAt === "string"
                  ? argumentsObject.retiredAt.trim()
                  : null,
              teamId:
                typeof argumentsObject.teamId === "string"
                  ? argumentsObject.teamId.trim()
                  : null,
            }),
            execute: executeLinearLabelCreateIssueLabel,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                color: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                description: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                isGroup: {
                  type: "boolean",
                  description: "Whether the label is a group label.",
                },
                labelId: LABEL_ID_ARGUMENT_SCHEMA,
                name: LABEL_NAME_ARGUMENT_SCHEMA,
                parentId: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                replaceTeamLabels: {
                  type: "boolean",
                  description:
                    "Whether matching team labels should be replaced by this updated workspace label.",
                },
                retiredAt: DATETIME_ARGUMENT_SCHEMA,
              },
              required: ["labelId"],
            },
            commandKey: "label.update_issue_label",
            commandPath: ["label", "update_issue_label"],
            description: "Update one issue label.",
            exampleArguments: {
              labelId: "issue-label-id",
              name: "Customer-visible",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "update issue label",
              "edit issue label",
            ],
            label: "Update issue label",
            resultMode: "json",
            usageNotes: [
              "This requires at least one update field besides labelId.",
            ],
            validate: (argumentsObject) => ({
              color:
                typeof argumentsObject.color === "string"
                  ? argumentsObject.color.trim()
                  : null,
              description:
                typeof argumentsObject.description === "string"
                  ? argumentsObject.description.trim()
                  : null,
              isGroup:
                typeof argumentsObject.isGroup === "boolean"
                  ? argumentsObject.isGroup
                  : null,
              labelId:
                typeof argumentsObject.labelId === "string"
                  ? argumentsObject.labelId.trim()
                  : "",
              name:
                typeof argumentsObject.name === "string"
                  ? argumentsObject.name.trim()
                  : null,
              parentId:
                typeof argumentsObject.parentId === "string"
                  ? argumentsObject.parentId.trim()
                  : null,
              replaceTeamLabels:
                typeof argumentsObject.replaceTeamLabels === "boolean"
                  ? argumentsObject.replaceTeamLabels
                  : null,
              retiredAt:
                typeof argumentsObject.retiredAt === "string"
                  ? argumentsObject.retiredAt.trim()
                  : null,
            }),
            execute: executeLinearLabelUpdateIssueLabel,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                labelId: LABEL_ID_ARGUMENT_SCHEMA,
              },
              required: ["labelId"],
            },
            commandKey: "label.delete_issue_label",
            commandPath: ["label", "delete_issue_label"],
            description: "Delete one issue label.",
            exampleArguments: {
              labelId: "issue-label-id",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "delete issue label",
              "remove issue label",
            ],
            label: "Delete issue label",
            resultMode: "json",
            validate: (argumentsObject) => ({
              labelId:
                typeof argumentsObject.labelId === "string"
                  ? argumentsObject.labelId.trim()
                  : "",
            }),
            execute: executeLinearLabelDeleteIssueLabel,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                labelId: LABEL_ID_ARGUMENT_SCHEMA,
              },
              required: ["labelId"],
            },
            commandKey: "label.restore_issue_label",
            commandPath: ["label", "restore_issue_label"],
            description: "Restore one issue label.",
            exampleArguments: {
              labelId: "issue-label-id",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "restore issue label",
              "unarchive issue label",
            ],
            label: "Restore issue label",
            resultMode: "json",
            validate: (argumentsObject) => ({
              labelId:
                typeof argumentsObject.labelId === "string"
                  ? argumentsObject.labelId.trim()
                  : "",
            }),
            execute: executeLinearLabelRestoreIssueLabel,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                labelId: LABEL_ID_ARGUMENT_SCHEMA,
              },
              required: ["labelId"],
            },
            commandKey: "label.retire_issue_label",
            commandPath: ["label", "retire_issue_label"],
            description: "Retire one issue label.",
            exampleArguments: {
              labelId: "issue-label-id",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "retire issue label",
              "deprecate issue label",
            ],
            label: "Retire issue label",
            resultMode: "json",
            validate: (argumentsObject) => ({
              labelId:
                typeof argumentsObject.labelId === "string"
                  ? argumentsObject.labelId.trim()
                  : "",
            }),
            execute: executeLinearLabelRetireIssueLabel,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                limit: LIMIT_ARGUMENT_SCHEMA,
              },
            },
            commandKey: "label.list_project_labels",
            commandPath: ["label", "list_project_labels"],
            description:
              "List project labels in the connected Linear workspace.",
            exampleArguments: {
              limit: 25,
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "project labels",
              "roadmap labels",
              "taxonomy",
            ],
            label: "List project labels",
            resultMode: "json",
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 25,
            }),
            execute: executeLinearLabelListProjectLabels,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                labelId: LABEL_ID_ARGUMENT_SCHEMA,
              },
              required: ["labelId"],
            },
            commandKey: "label.get_project_label",
            commandPath: ["label", "get_project_label"],
            description: "Read one project label by id.",
            exampleArguments: {
              labelId: "project-label-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "project label", "label details"],
            label: "Get project label",
            resultMode: "json",
            validate: (argumentsObject) => ({
              labelId:
                typeof argumentsObject.labelId === "string"
                  ? argumentsObject.labelId.trim()
                  : "",
            }),
            execute: executeLinearLabelGetProjectLabel,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                color: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                description: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                isGroup: {
                  type: "boolean",
                  description: "Whether the label is a group label.",
                },
                name: LABEL_NAME_ARGUMENT_SCHEMA,
                parentId: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                retiredAt: DATETIME_ARGUMENT_SCHEMA,
              },
              required: ["name"],
            },
            commandKey: "label.create_project_label",
            commandPath: ["label", "create_project_label"],
            description: "Create a new project label.",
            exampleArguments: {
              name: "Roadmap",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "create project label",
              "new project label",
            ],
            label: "Create project label",
            resultMode: "json",
            validate: (argumentsObject) => ({
              color:
                typeof argumentsObject.color === "string"
                  ? argumentsObject.color.trim()
                  : null,
              description:
                typeof argumentsObject.description === "string"
                  ? argumentsObject.description.trim()
                  : null,
              isGroup:
                typeof argumentsObject.isGroup === "boolean"
                  ? argumentsObject.isGroup
                  : null,
              name:
                typeof argumentsObject.name === "string"
                  ? argumentsObject.name.trim()
                  : "",
              parentId:
                typeof argumentsObject.parentId === "string"
                  ? argumentsObject.parentId.trim()
                  : null,
              retiredAt:
                typeof argumentsObject.retiredAt === "string"
                  ? argumentsObject.retiredAt.trim()
                  : null,
            }),
            execute: executeLinearLabelCreateProjectLabel,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                color: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                description: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                isGroup: {
                  type: "boolean",
                  description: "Whether the label is a group label.",
                },
                labelId: LABEL_ID_ARGUMENT_SCHEMA,
                name: LABEL_NAME_ARGUMENT_SCHEMA,
                parentId: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                retiredAt: DATETIME_ARGUMENT_SCHEMA,
              },
              required: ["labelId"],
            },
            commandKey: "label.update_project_label",
            commandPath: ["label", "update_project_label"],
            description: "Update one project label.",
            exampleArguments: {
              labelId: "project-label-id",
              name: "Roadmap critical",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "update project label",
              "edit project label",
            ],
            label: "Update project label",
            resultMode: "json",
            validate: (argumentsObject) => ({
              color:
                typeof argumentsObject.color === "string"
                  ? argumentsObject.color.trim()
                  : null,
              description:
                typeof argumentsObject.description === "string"
                  ? argumentsObject.description.trim()
                  : null,
              isGroup:
                typeof argumentsObject.isGroup === "boolean"
                  ? argumentsObject.isGroup
                  : null,
              labelId:
                typeof argumentsObject.labelId === "string"
                  ? argumentsObject.labelId.trim()
                  : "",
              name:
                typeof argumentsObject.name === "string"
                  ? argumentsObject.name.trim()
                  : null,
              parentId:
                typeof argumentsObject.parentId === "string"
                  ? argumentsObject.parentId.trim()
                  : null,
              retiredAt:
                typeof argumentsObject.retiredAt === "string"
                  ? argumentsObject.retiredAt.trim()
                  : null,
            }),
            execute: executeLinearLabelUpdateProjectLabel,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                labelId: LABEL_ID_ARGUMENT_SCHEMA,
              },
              required: ["labelId"],
            },
            commandKey: "label.delete_project_label",
            commandPath: ["label", "delete_project_label"],
            description: "Delete one project label.",
            exampleArguments: {
              labelId: "project-label-id",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "delete project label",
              "remove project label",
            ],
            label: "Delete project label",
            resultMode: "json",
            validate: (argumentsObject) => ({
              labelId:
                typeof argumentsObject.labelId === "string"
                  ? argumentsObject.labelId.trim()
                  : "",
            }),
            execute: executeLinearLabelDeleteProjectLabel,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                labelId: LABEL_ID_ARGUMENT_SCHEMA,
              },
              required: ["labelId"],
            },
            commandKey: "label.restore_project_label",
            commandPath: ["label", "restore_project_label"],
            description: "Restore one project label.",
            exampleArguments: {
              labelId: "project-label-id",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "restore project label",
              "unarchive project label",
            ],
            label: "Restore project label",
            resultMode: "json",
            validate: (argumentsObject) => ({
              labelId:
                typeof argumentsObject.labelId === "string"
                  ? argumentsObject.labelId.trim()
                  : "",
            }),
            execute: executeLinearLabelRestoreProjectLabel,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                labelId: LABEL_ID_ARGUMENT_SCHEMA,
              },
              required: ["labelId"],
            },
            commandKey: "label.retire_project_label",
            commandPath: ["label", "retire_project_label"],
            description: "Retire one project label.",
            exampleArguments: {
              labelId: "project-label-id",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "retire project label",
              "deprecate project label",
            ],
            label: "Retire project label",
            resultMode: "json",
            validate: (argumentsObject) => ({
              labelId:
                typeof argumentsObject.labelId === "string"
                  ? argumentsObject.labelId.trim()
                  : "",
            }),
            execute: executeLinearLabelRetireProjectLabel,
          },
        ],
        description: "Issue-label and project-label taxonomy reads and writes.",
        groupKey: "label",
        groupPath: ["label"],
        intentKeywords: ["linear", "labels", "taxonomy", "categorization"],
        label: "Labels",
      },
      {
        commands: [
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                limit: LIMIT_ARGUMENT_SCHEMA,
              },
            },
            commandKey: "project_milestone.list",
            commandPath: ["project_milestone", "list"],
            description:
              "List project milestones in the connected Linear workspace.",
            exampleArguments: {
              limit: 25,
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "project milestone",
              "milestones",
              "roadmap",
            ],
            label: "List project milestones",
            resultMode: "json",
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 25,
            }),
            execute: executeLinearProjectMilestoneList,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                milestoneId: MILESTONE_ID_ARGUMENT_SCHEMA,
              },
              required: ["milestoneId"],
            },
            commandKey: "project_milestone.get",
            commandPath: ["project_milestone", "get"],
            description: "Read one project milestone by id.",
            exampleArguments: {
              milestoneId: "milestone-id",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "project milestone",
              "milestone details",
            ],
            label: "Get project milestone",
            resultMode: "json",
            validate: (argumentsObject) => ({
              milestoneId:
                typeof argumentsObject.milestoneId === "string"
                  ? argumentsObject.milestoneId.trim()
                  : "",
            }),
            execute: executeLinearProjectMilestoneGet,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                description: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                name: {
                  type: "string",
                  minLength: 1,
                  description: "Project milestone name.",
                },
                projectId: PROJECT_ID_ARGUMENT_SCHEMA,
                sortOrder: {
                  type: "integer",
                  description:
                    "Optional milestone sort order within the project.",
                },
                targetDate: DATE_ARGUMENT_SCHEMA,
              },
              required: ["name", "projectId"],
            },
            commandKey: "project_milestone.create",
            commandPath: ["project_milestone", "create"],
            description: "Create a new project milestone.",
            exampleArguments: {
              name: "GA",
              projectId: "project-id",
              targetDate: "2026-05-01",
            },
            inputMode: "json",
            intentKeywords: ["linear", "create milestone", "roadmap milestone"],
            label: "Create project milestone",
            resultMode: "json",
            validate: (argumentsObject) => ({
              description:
                typeof argumentsObject.description === "string"
                  ? argumentsObject.description.trim()
                  : null,
              name:
                typeof argumentsObject.name === "string"
                  ? argumentsObject.name.trim()
                  : "",
              projectId:
                typeof argumentsObject.projectId === "string"
                  ? argumentsObject.projectId.trim()
                  : "",
              sortOrder:
                typeof argumentsObject.sortOrder === "number" &&
                Number.isFinite(argumentsObject.sortOrder)
                  ? argumentsObject.sortOrder
                  : null,
              targetDate:
                typeof argumentsObject.targetDate === "string"
                  ? argumentsObject.targetDate.trim()
                  : null,
            }),
            execute: executeLinearProjectMilestoneCreate,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                description: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                milestoneId: MILESTONE_ID_ARGUMENT_SCHEMA,
                name: {
                  type: "string",
                  minLength: 1,
                  description: "Updated milestone name.",
                },
                projectId: PROJECT_ID_ARGUMENT_SCHEMA,
                sortOrder: {
                  type: "integer",
                  description: "Optional updated milestone sort order.",
                },
                targetDate: DATE_ARGUMENT_SCHEMA,
              },
              required: ["milestoneId"],
            },
            commandKey: "project_milestone.update",
            commandPath: ["project_milestone", "update"],
            description: "Update one project milestone.",
            exampleArguments: {
              milestoneId: "milestone-id",
              targetDate: "2026-05-15",
            },
            inputMode: "json",
            intentKeywords: ["linear", "update milestone", "edit milestone"],
            label: "Update project milestone",
            resultMode: "json",
            validate: (argumentsObject) => ({
              description:
                typeof argumentsObject.description === "string"
                  ? argumentsObject.description.trim()
                  : null,
              milestoneId:
                typeof argumentsObject.milestoneId === "string"
                  ? argumentsObject.milestoneId.trim()
                  : "",
              name:
                typeof argumentsObject.name === "string"
                  ? argumentsObject.name.trim()
                  : null,
              projectId:
                typeof argumentsObject.projectId === "string"
                  ? argumentsObject.projectId.trim()
                  : null,
              sortOrder:
                typeof argumentsObject.sortOrder === "number" &&
                Number.isFinite(argumentsObject.sortOrder)
                  ? argumentsObject.sortOrder
                  : null,
              targetDate:
                typeof argumentsObject.targetDate === "string"
                  ? argumentsObject.targetDate.trim()
                  : null,
            }),
            execute: executeLinearProjectMilestoneUpdate,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                milestoneId: MILESTONE_ID_ARGUMENT_SCHEMA,
              },
              required: ["milestoneId"],
            },
            commandKey: "project_milestone.delete",
            commandPath: ["project_milestone", "delete"],
            description: "Delete one project milestone.",
            exampleArguments: {
              milestoneId: "milestone-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "delete milestone", "remove milestone"],
            label: "Delete project milestone",
            resultMode: "json",
            validate: (argumentsObject) => ({
              milestoneId:
                typeof argumentsObject.milestoneId === "string"
                  ? argumentsObject.milestoneId.trim()
                  : "",
            }),
            execute: executeLinearProjectMilestoneDelete,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                addIssueTeamToProject: {
                  type: "boolean",
                  description:
                    "Whether issue teams should be added to the destination project when required.",
                },
                milestoneId: MILESTONE_ID_ARGUMENT_SCHEMA,
                newIssueTeamId: {
                  type: "string",
                  minLength: 1,
                  description:
                    "Optional team id to move attached issues onto when resolving team mismatches.",
                },
                projectId: PROJECT_ID_ARGUMENT_SCHEMA,
              },
              required: ["milestoneId", "projectId"],
            },
            commandKey: "project_milestone.move",
            commandPath: ["project_milestone", "move"],
            description: "Move a project milestone to another project.",
            exampleArguments: {
              milestoneId: "milestone-id",
              projectId: "project-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "move milestone", "rehome milestone"],
            label: "Move project milestone",
            resultMode: "json",
            usageNotes: [
              "Use addIssueTeamToProject or newIssueTeamId when the destination project needs help reconciling issue-team constraints.",
            ],
            validate: (argumentsObject) => ({
              addIssueTeamToProject:
                typeof argumentsObject.addIssueTeamToProject === "boolean"
                  ? argumentsObject.addIssueTeamToProject
                  : null,
              milestoneId:
                typeof argumentsObject.milestoneId === "string"
                  ? argumentsObject.milestoneId.trim()
                  : "",
              newIssueTeamId:
                typeof argumentsObject.newIssueTeamId === "string"
                  ? argumentsObject.newIssueTeamId.trim()
                  : null,
              projectId:
                typeof argumentsObject.projectId === "string"
                  ? argumentsObject.projectId.trim()
                  : "",
            }),
            execute: executeLinearProjectMilestoneMove,
          },
        ],
        description:
          "Project milestone reads and writes for planning milestones.",
        groupKey: "project_milestone",
        groupPath: ["project_milestone"],
        intentKeywords: ["linear", "milestone", "project milestone", "roadmap"],
        label: "Project Milestones",
      },
      {
        commands: [
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                limit: LIMIT_ARGUMENT_SCHEMA,
              },
            },
            commandKey: "project_status.list",
            commandPath: ["project_status", "list"],
            description:
              "List project statuses in the connected Linear workspace.",
            exampleArguments: {
              limit: 25,
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "project statuses",
              "project flow",
              "roadmap",
            ],
            label: "List project statuses",
            resultMode: "json",
            validate: (argumentsObject) => ({
              limit:
                typeof argumentsObject.limit === "number" &&
                Number.isInteger(argumentsObject.limit)
                  ? argumentsObject.limit
                  : 25,
            }),
            execute: executeLinearProjectStatusList,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                statusId: PROJECT_STATUS_ID_ARGUMENT_SCHEMA,
              },
              required: ["statusId"],
            },
            commandKey: "project_status.get",
            commandPath: ["project_status", "get"],
            description: "Read one project status by id.",
            exampleArguments: {
              statusId: "project-status-id",
            },
            inputMode: "json",
            intentKeywords: ["linear", "project status", "status details"],
            label: "Get project status",
            resultMode: "json",
            validate: (argumentsObject) => ({
              statusId:
                typeof argumentsObject.statusId === "string"
                  ? argumentsObject.statusId.trim()
                  : "",
            }),
            execute: executeLinearProjectStatusGet,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                color: {
                  type: "string",
                  minLength: 1,
                  description: "Status color as a HEX string.",
                },
                description: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                indefinite: {
                  type: "boolean",
                  description:
                    "Whether the project can remain in this status indefinitely.",
                },
                name: {
                  type: "string",
                  minLength: 1,
                  description: "Project status name.",
                },
                position: {
                  type: "integer",
                  description:
                    "Status position within the workspace project flow.",
                },
                type: PROJECT_STATUS_TYPE_ARGUMENT_SCHEMA,
              },
              required: ["name", "color", "position", "type"],
            },
            commandKey: "project_status.create",
            commandPath: ["project_status", "create"],
            description: "Create a new project status.",
            exampleArguments: {
              color: "#4F46E5",
              name: "Started",
              position: 2,
              type: "started",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "create project status",
              "roadmap status",
            ],
            label: "Create project status",
            resultMode: "json",
            validate: (argumentsObject) => ({
              color:
                typeof argumentsObject.color === "string"
                  ? argumentsObject.color.trim()
                  : "",
              description:
                typeof argumentsObject.description === "string"
                  ? argumentsObject.description.trim()
                  : null,
              indefinite:
                typeof argumentsObject.indefinite === "boolean"
                  ? argumentsObject.indefinite
                  : false,
              name:
                typeof argumentsObject.name === "string"
                  ? argumentsObject.name.trim()
                  : "",
              position:
                typeof argumentsObject.position === "number" &&
                Number.isFinite(argumentsObject.position)
                  ? argumentsObject.position
                  : 0,
              type:
                typeof argumentsObject.type === "string"
                  ? argumentsObject.type.trim()
                  : "",
            }),
            execute: executeLinearProjectStatusCreate,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                color: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                description: OPTIONAL_STRING_ARGUMENT_SCHEMA,
                indefinite: {
                  type: "boolean",
                  description:
                    "Whether the project can remain in this status indefinitely.",
                },
                name: {
                  type: "string",
                  minLength: 1,
                  description: "Updated project status name.",
                },
                position: {
                  type: "integer",
                  description:
                    "Updated status position within the workspace project flow.",
                },
                statusId: PROJECT_STATUS_ID_ARGUMENT_SCHEMA,
                type: PROJECT_STATUS_TYPE_ARGUMENT_SCHEMA,
              },
              required: ["statusId"],
            },
            commandKey: "project_status.update",
            commandPath: ["project_status", "update"],
            description: "Update one project status.",
            exampleArguments: {
              statusId: "project-status-id",
              type: "paused",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "update project status",
              "edit project status",
            ],
            label: "Update project status",
            resultMode: "json",
            validate: (argumentsObject) => ({
              color:
                typeof argumentsObject.color === "string"
                  ? argumentsObject.color.trim()
                  : null,
              description:
                typeof argumentsObject.description === "string"
                  ? argumentsObject.description.trim()
                  : null,
              indefinite:
                typeof argumentsObject.indefinite === "boolean"
                  ? argumentsObject.indefinite
                  : null,
              name:
                typeof argumentsObject.name === "string"
                  ? argumentsObject.name.trim()
                  : null,
              position:
                typeof argumentsObject.position === "number" &&
                Number.isFinite(argumentsObject.position)
                  ? argumentsObject.position
                  : null,
              statusId:
                typeof argumentsObject.statusId === "string"
                  ? argumentsObject.statusId.trim()
                  : "",
              type:
                typeof argumentsObject.type === "string"
                  ? argumentsObject.type.trim()
                  : null,
            }),
            execute: executeLinearProjectStatusUpdate,
          },
        ],
        description:
          "Project-status reads and writes for the workspace project flow.",
        groupKey: "project_status",
        groupPath: ["project_status"],
        intentKeywords: [
          "linear",
          "project status",
          "project flow",
          "roadmap status",
        ],
        label: "Project Statuses",
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
              "Inline images are supported in the description via Markdown image syntax like ![alt](assetUrl).",
              "Use issue.insert_inline_image or issue.upload_inline_image when you want Otto to manage the markdown insertion for you.",
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
                altText: {
                  type: "string",
                  minLength: 1,
                  description: "Alt text to use in the Markdown image tag.",
                },
                anchorText: {
                  type: "string",
                  minLength: 1,
                  description:
                    "Required when position is after_text, before_text, or replace_text. Otto inserts relative to the first exact match.",
                },
                assetUrl: {
                  type: "string",
                  minLength: 1,
                  description:
                    "Uploaded Linear asset URL to embed inline in the issue description.",
                },
                fallbackPosition: {
                  type: "string",
                  enum: ["append", "fail", "prepend"],
                  description:
                    "What to do if anchorText is not found. Defaults to fail.",
                },
                identifierOrId: IDENTIFIER_OR_ID_ARGUMENT_SCHEMA,
                position: {
                  type: "string",
                  enum: [
                    "append",
                    "prepend",
                    "after_text",
                    "before_text",
                    "replace_text",
                  ],
                  description:
                    "How to place the Markdown image within the description. Defaults to append.",
                },
              },
              required: ["altText", "assetUrl", "identifierOrId"],
            },
            commandKey: "issue.insert_inline_image",
            commandPath: ["issue", "insert_inline_image"],
            description:
              "Insert a Markdown image into an issue description using an existing uploaded Linear asset URL.",
            exampleArguments: {
              altText: "OpenClaw logo",
              assetUrl: "https://uploads.linear.app/assets/openclaw-logo.png",
              identifierOrId: "INT-15",
              position: "append",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "issue",
              "inline image",
              "embed image",
              "markdown image",
            ],
            label: "Insert inline image",
            resultMode: "json",
            usageNotes: [
              "Use this when you already have an uploaded Linear asset URL.",
              "For anchor-based placement, provide anchorText and choose after_text, before_text, or replace_text.",
              "When fallbackPosition is fail, Otto will error instead of silently appending if the anchor is missing.",
            ],
            validate: (argumentsObject) => ({
              altText:
                typeof argumentsObject.altText === "string"
                  ? argumentsObject.altText.trim()
                  : "",
              anchorText:
                typeof argumentsObject.anchorText === "string"
                  ? argumentsObject.anchorText.trim()
                  : null,
              assetUrl:
                typeof argumentsObject.assetUrl === "string"
                  ? argumentsObject.assetUrl.trim()
                  : "",
              fallbackPosition:
                argumentsObject.fallbackPosition === "append" ||
                argumentsObject.fallbackPosition === "prepend" ||
                argumentsObject.fallbackPosition === "fail"
                  ? argumentsObject.fallbackPosition
                  : "fail",
              identifierOrId:
                typeof argumentsObject.identifierOrId === "string"
                  ? argumentsObject.identifierOrId.trim()
                  : "",
              position:
                argumentsObject.position === "after_text" ||
                argumentsObject.position === "before_text" ||
                argumentsObject.position === "prepend" ||
                argumentsObject.position === "replace_text"
                  ? argumentsObject.position
                  : "append",
            }),
            execute: executeLinearIssueInsertInlineImage,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                altText: {
                  type: "string",
                  minLength: 1,
                  description: "Alt text to use in the Markdown image tag.",
                },
                anchorText: {
                  type: "string",
                  minLength: 1,
                  description:
                    "Required when position is after_text, before_text, or replace_text. Otto inserts relative to the first exact match.",
                },
                contentBase64: {
                  type: "string",
                  minLength: 1,
                  description:
                    "Base64-encoded file bytes. Data URLs are also accepted.",
                },
                contentType: {
                  type: "string",
                  minLength: 1,
                  description: "MIME type of the inline image.",
                },
                fallbackPosition: {
                  type: "string",
                  enum: ["append", "fail", "prepend"],
                  description:
                    "What to do if anchorText is not found. Defaults to fail.",
                },
                filename: {
                  type: "string",
                  minLength: 1,
                  description: "Filename for the uploaded image asset.",
                },
                identifierOrId: IDENTIFIER_OR_ID_ARGUMENT_SCHEMA,
                makePublic: {
                  type: "boolean",
                  description:
                    "Whether the uploaded file should be publicly accessible.",
                },
                metaData: {
                  type: "object",
                  additionalProperties: true,
                  description:
                    "Optional metadata object forwarded to Linear's signed upload request.",
                },
                position: {
                  type: "string",
                  enum: [
                    "append",
                    "prepend",
                    "after_text",
                    "before_text",
                    "replace_text",
                  ],
                  description:
                    "How to place the Markdown image within the description. Defaults to append.",
                },
              },
              required: [
                "altText",
                "contentBase64",
                "contentType",
                "filename",
                "identifierOrId",
              ],
            },
            commandKey: "issue.upload_inline_image",
            commandPath: ["issue", "upload_inline_image"],
            description:
              "Upload image bytes to Linear storage on the server, then insert the uploaded image inline into the issue description.",
            exampleArguments: {
              altText: "OpenClaw logo",
              contentBase64: "<base64-image-bytes>",
              contentType: "image/png",
              filename: "openclaw-logo.png",
              identifierOrId: "INT-15",
              position: "append",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "issue",
              "upload inline image",
              "embed uploaded image",
              "description image",
            ],
            label: "Upload inline image",
            resultMode: "json",
            usageNotes: [
              "This command performs the full server-side upload flow and then updates the issue description with Markdown image syntax.",
              "Provide contentBase64 with the raw image bytes. Data URL prefixes are accepted.",
              "For anchor-based placement, provide anchorText and choose after_text, before_text, or replace_text.",
            ],
            validate: (argumentsObject) => ({
              altText:
                typeof argumentsObject.altText === "string"
                  ? argumentsObject.altText.trim()
                  : "",
              anchorText:
                typeof argumentsObject.anchorText === "string"
                  ? argumentsObject.anchorText.trim()
                  : null,
              contentBase64:
                typeof argumentsObject.contentBase64 === "string"
                  ? argumentsObject.contentBase64.trim()
                  : "",
              contentType:
                typeof argumentsObject.contentType === "string"
                  ? argumentsObject.contentType.trim()
                  : "",
              fallbackPosition:
                argumentsObject.fallbackPosition === "append" ||
                argumentsObject.fallbackPosition === "prepend" ||
                argumentsObject.fallbackPosition === "fail"
                  ? argumentsObject.fallbackPosition
                  : "fail",
              filename:
                typeof argumentsObject.filename === "string"
                  ? argumentsObject.filename.trim()
                  : "",
              identifierOrId:
                typeof argumentsObject.identifierOrId === "string"
                  ? argumentsObject.identifierOrId.trim()
                  : "",
              makePublic:
                typeof argumentsObject.makePublic === "boolean"
                  ? argumentsObject.makePublic
                  : null,
              metaData:
                argumentsObject.metaData &&
                typeof argumentsObject.metaData === "object" &&
                !Array.isArray(argumentsObject.metaData)
                  ? argumentsObject.metaData
                  : null,
              position:
                argumentsObject.position === "after_text" ||
                argumentsObject.position === "before_text" ||
                argumentsObject.position === "prepend" ||
                argumentsObject.position === "replace_text"
                  ? argumentsObject.position
                  : "append",
            }),
            execute: executeLinearIssueUploadInlineImage,
          },
          {
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                identifierOrId: IDENTIFIER_OR_ID_ARGUMENT_SCHEMA,
              },
              required: ["identifierOrId"],
            },
            commandKey: "issue.delete",
            commandPath: ["issue", "delete"],
            description: "Delete one Linear issue.",
            exampleArguments: {
              identifierOrId: "INT-6",
            },
            inputMode: "json",
            intentKeywords: ["linear", "issue", "delete issue", "remove issue"],
            label: "Delete issue",
            resultMode: "json",
            usageNotes: [
              "Use the issue identifier like INT-6 or the canonical issue id.",
              "This permanently deletes the issue instead of archiving it.",
            ],
            validate: (argumentsObject) => ({
              identifierOrId:
                typeof argumentsObject.identifierOrId === "string"
                  ? argumentsObject.identifierOrId.trim()
                  : "",
            }),
            execute: executeLinearIssueDelete,
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
              },
              required: ["projectId"],
            },
            commandKey: "project.delete",
            commandPath: ["project", "delete"],
            description: "Delete one Linear project.",
            exampleArguments: {
              projectId: "project-1",
            },
            inputMode: "json",
            intentKeywords: [
              "linear",
              "project",
              "delete project",
              "remove project",
            ],
            label: "Delete project",
            resultMode: "json",
            usageNotes: [
              "Use project.archive when you want a softer archive flow instead of hard deletion.",
            ],
            validate: (argumentsObject) => ({
              projectId:
                typeof argumentsObject.projectId === "string"
                  ? argumentsObject.projectId.trim()
                  : "",
            }),
            execute: executeLinearProjectDelete,
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
      "Read Linear workspace, team, issue, comment, project, document, initiative, and customer context through Otto's managed integration runtime surface.",
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
