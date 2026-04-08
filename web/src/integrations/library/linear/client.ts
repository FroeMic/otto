const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";

const USER_FIELDS = `
  id
  name
  email
  displayName
  active
  admin
  guest
  owner
  isAssignable
  isMentionable
  lastSeen
  statusEmoji
  statusLabel
  statusUntilAt
`;

const ISSUE_REFERENCE_FIELDS = `
  id
  identifier
  title
`;

const TEAM_REFERENCE_FIELDS = `
  id
  key
  name
  displayName
`;

const ISSUE_FIELDS = `
  id
  identifier
  labelIds
  title
  description
  priority
  url
  updatedAt
  createdAt
  project {
    id
    name
  }
  state {
    id
    name
    type
  }
  team {
    id
    key
    name
  }
  assignee {
    ${USER_FIELDS}
  }
`;

const COMMENT_FIELDS = `
  id
  body
  createdAt
  updatedAt
  url
  issueId
  parentId
  quotedText
  resolvedAt
  issue {
    ${ISSUE_REFERENCE_FIELDS}
  }
  user {
    ${USER_FIELDS}
  }
`;

const ATTACHMENT_FIELDS = `
  id
  title
  subtitle
  url
  sourceType
  archivedAt
  bodyData
  createdAt
  creator {
    ${USER_FIELDS}
  }
  issue {
    ${ISSUE_REFERENCE_FIELDS}
  }
  metadata
  originalIssue {
    ${ISSUE_REFERENCE_FIELDS}
  }
  source
  updatedAt
`;

const DOCUMENT_FIELDS = `
  id
  title
  slugId
  url
  createdAt
  updatedAt
  color
  icon
  content
  summary
  sortOrder
  trashed
  creator {
    ${USER_FIELDS}
  }
  updatedBy {
    ${USER_FIELDS}
  }
  issue {
    ${ISSUE_REFERENCE_FIELDS}
  }
  project {
    id
    name
  }
  team {
    ${TEAM_REFERENCE_FIELDS}
  }
  initiative {
    id
    name
  }
  cycle {
    id
    name
    number
  }
`;

const ISSUE_RELATION_FIELDS = `
  id
  type
  createdAt
  updatedAt
  issue {
    ${ISSUE_REFERENCE_FIELDS}
  }
  relatedIssue {
    ${ISSUE_REFERENCE_FIELDS}
  }
`;

const ISSUE_LABEL_FIELDS = `
  id
  name
  color
  description
  isGroup
  createdAt
  updatedAt
  lastAppliedAt
  retiredAt
  parent {
    id
    name
  }
  creator {
    ${USER_FIELDS}
  }
  team {
    ${TEAM_REFERENCE_FIELDS}
  }
`;

const PROJECT_STATUS_FIELDS = `
  id
  name
  type
  color
  description
`;

const PROJECT_LABEL_FIELDS = `
  id
  name
  color
  description
  isGroup
  createdAt
  updatedAt
  lastAppliedAt
  retiredAt
  parent {
    id
    name
  }
  creator {
    ${USER_FIELDS}
  }
`;

const PROJECT_FIELDS = `
  id
  name
  description
  content
  color
  icon
  priority
  url
  slugId
  startDate
  targetDate
  createdAt
  updatedAt
  labelIds
  lead {
    ${USER_FIELDS}
  }
  status {
    ${PROJECT_STATUS_FIELDS}
  }
  teams(first: 50) {
    nodes {
      id
      key
      name
    }
  }
`;

const PROJECT_UPDATE_FIELDS = `
  id
  body
  health
  isDiffHidden
  slugId
  url
  createdAt
  updatedAt
  project {
    id
    name
  }
  user {
    ${USER_FIELDS}
  }
`;

const PROJECT_MILESTONE_FIELDS = `
  id
  name
  description
  progress
  status
  targetDate
  createdAt
  updatedAt
  project {
    id
    name
  }
`;

const CYCLE_FIELDS = `
  id
  name
  number
  description
  startsAt
  endsAt
  createdAt
  completedAt
  progress
  isActive
  isFuture
  isPast
  team {
    id
    key
    name
  }
`;

const INITIATIVE_FIELDS = `
  id
  name
  description
  content
  color
  icon
  status
  health
  healthUpdatedAt
  slugId
  url
  targetDate
  startedAt
  completedAt
  trashed
  createdAt
  updatedAt
  owner {
    ${USER_FIELDS}
  }
  creator {
    ${USER_FIELDS}
  }
`;

const INITIATIVE_UPDATE_FIELDS = `
  id
  body
  health
  isDiffHidden
  slugId
  url
  createdAt
  updatedAt
  initiative {
    id
    name
  }
  user {
    ${USER_FIELDS}
  }
`;

const CUSTOMER_STATUS_FIELDS = `
  id
  name
  displayName
  color
  description
  position
  updatedAt
  createdAt
`;

const CUSTOMER_TIER_FIELDS = `
  id
  name
  displayName
  color
  description
  position
  updatedAt
  createdAt
`;

const CUSTOMER_FIELDS = `
  id
  name
  slugId
  url
  createdAt
  updatedAt
  domains
  externalIds
  logoUrl
  mainSourceId
  revenue
  size
  slackChannelId
  owner {
    ${USER_FIELDS}
  }
  status {
    ${CUSTOMER_STATUS_FIELDS}
  }
  tier {
    ${CUSTOMER_TIER_FIELDS}
  }
`;

const CUSTOMER_NEED_FIELDS = `
  id
  body
  createdAt
  updatedAt
  priority
  url
  customer {
    id
    name
  }
  issue {
    ${ISSUE_REFERENCE_FIELDS}
  }
  project {
    id
    name
  }
  attachment {
    ${ATTACHMENT_FIELDS}
  }
  creator {
    ${USER_FIELDS}
  }
`;

const GET_ISSUE_BY_ID_QUERY = `
  query OttoLinearIssueById($id: String!) {
    issue(id: $id) {
      ${ISSUE_FIELDS}
    }
  }
`;

const SEARCH_ISSUE_BY_LOOKUP_QUERY = `
  query OttoLinearIssueByLookup($term: String!) {
    searchIssues(term: $term, first: 10) {
      nodes {
        ${ISSUE_FIELDS}
      }
    }
  }
`;

export class LinearGraphqlError extends Error {
  code?: string;
  operationName?: string;
  rawResponseSnippet?: string;
  status?: number;
  variableSummary?: string;

  constructor(
    message: string,
    options?: {
      code?: string;
      operationName?: string;
      rawResponseSnippet?: string;
      status?: number;
      variableSummary?: string;
    },
  ) {
    super(message);
    this.name = "LinearGraphqlError";
    this.code = options?.code;
    this.operationName = options?.operationName;
    this.rawResponseSnippet = options?.rawResponseSnippet;
    this.status = options?.status;
    this.variableSummary = options?.variableSummary;
  }
}

function clipForLog(value: string, max = 1000) {
  const trimmed = value.trim();

  if (trimmed.length <= max) {
    return trimmed;
  }

  return `${trimmed.slice(0, max)}…`;
}

function summarizeVariables(variables: Record<string, unknown>) {
  try {
    return clipForLog(JSON.stringify(variables), 500);
  } catch {
    return "[unserializable variables]";
  }
}

function extractOperationName(query: string) {
  const match = query.match(
    /\b(query|mutation|subscription)\s+([A-Za-z0-9_]+)/,
  );

  return match?.[2] ?? "anonymous";
}

export type LinearUserNode = {
  active?: boolean | null;
  admin?: boolean | null;
  displayName?: string | null;
  email?: string | null;
  guest?: boolean | null;
  id?: string | null;
  isAssignable?: boolean | null;
  isMentionable?: boolean | null;
  lastSeen?: string | null;
  name?: string | null;
  owner?: boolean | null;
  statusEmoji?: string | null;
  statusLabel?: string | null;
  statusUntilAt?: string | null;
};

export type LinearTeamReferenceNode = {
  displayName?: string | null;
  id?: string | null;
  key?: string | null;
  name?: string | null;
};

export type LinearTeamMembershipNode = {
  createdAt?: string | null;
  id?: string | null;
  owner?: boolean | null;
  sortOrder?: number | null;
  team?: LinearTeamReferenceNode | null;
  updatedAt?: string | null;
  user?: LinearUserNode | null;
};

export type LinearIssueReferenceNode = {
  id?: string | null;
  identifier?: string | null;
  title?: string | null;
};

export type LinearIssueNode = {
  assignee?: LinearUserNode | null;
  createdAt?: string | null;
  description?: string | null;
  id?: string | null;
  identifier?: string | null;
  labelIds?: string[] | null;
  priority?: number | null;
  project?: {
    id?: string | null;
    name?: string | null;
  } | null;
  state?: {
    id?: string | null;
    name?: string | null;
    type?: string | null;
  } | null;
  team?: {
    id?: string | null;
    key?: string | null;
    name?: string | null;
  } | null;
  title?: string | null;
  updatedAt?: string | null;
  url?: string | null;
};

export type LinearCommentNode = {
  body?: string | null;
  createdAt?: string | null;
  id?: string | null;
  issue?: LinearIssueReferenceNode | null;
  issueId?: string | null;
  parentId?: string | null;
  quotedText?: string | null;
  resolvedAt?: string | null;
  updatedAt?: string | null;
  url?: string | null;
  user?: LinearUserNode | null;
};

export type LinearAttachmentNode = {
  archivedAt?: string | null;
  bodyData?: string | null;
  createdAt?: string | null;
  creator?: LinearUserNode | null;
  id?: string | null;
  issue?: LinearIssueReferenceNode | null;
  metadata?: Record<string, unknown> | null;
  originalIssue?: LinearIssueReferenceNode | null;
  source?: Record<string, unknown> | null;
  sourceType?: string | null;
  subtitle?: string | null;
  title?: string | null;
  updatedAt?: string | null;
  url?: string | null;
};

export type LinearDocumentNode = {
  color?: string | null;
  content?: string | null;
  createdAt?: string | null;
  creator?: LinearUserNode | null;
  cycle?: {
    id?: string | null;
    name?: string | null;
    number?: number | null;
  } | null;
  id?: string | null;
  icon?: string | null;
  initiative?: {
    id?: string | null;
    name?: string | null;
  } | null;
  issue?: LinearIssueReferenceNode | null;
  project?: {
    id?: string | null;
    name?: string | null;
  } | null;
  sortOrder?: number | null;
  slugId?: string | null;
  summary?: string | null;
  team?: LinearTeamReferenceNode | null;
  title?: string | null;
  trashed?: boolean | null;
  updatedAt?: string | null;
  updatedBy?: LinearUserNode | null;
  url?: string | null;
};

export type LinearIssueRelationNode = {
  createdAt?: string | null;
  id?: string | null;
  issue?: LinearIssueReferenceNode | null;
  relatedIssue?: LinearIssueReferenceNode | null;
  type?: string | null;
  updatedAt?: string | null;
};

export type LinearIssueLabelNode = {
  color?: string | null;
  createdAt?: string | null;
  creator?: LinearUserNode | null;
  description?: string | null;
  id?: string | null;
  isGroup?: boolean | null;
  lastAppliedAt?: string | null;
  name?: string | null;
  parent?: {
    id?: string | null;
    name?: string | null;
  } | null;
  retiredAt?: string | null;
  team?: LinearTeamReferenceNode | null;
  updatedAt?: string | null;
};

export type LinearProjectStatusNode = {
  color?: string | null;
  description?: string | null;
  id?: string | null;
  name?: string | null;
  type?: string | null;
};

export type LinearProjectLabelNode = {
  color?: string | null;
  createdAt?: string | null;
  creator?: LinearUserNode | null;
  description?: string | null;
  id?: string | null;
  isGroup?: boolean | null;
  lastAppliedAt?: string | null;
  name?: string | null;
  parent?: {
    id?: string | null;
    name?: string | null;
  } | null;
  retiredAt?: string | null;
  updatedAt?: string | null;
};

export type LinearProjectNode = {
  color?: string | null;
  content?: string | null;
  createdAt?: string | null;
  description?: string | null;
  icon?: string | null;
  id?: string | null;
  labelIds?: string[] | null;
  lead?: LinearUserNode | null;
  name?: string | null;
  priority?: number | null;
  slugId?: string | null;
  startDate?: string | null;
  status?: LinearProjectStatusNode | null;
  targetDate?: string | null;
  teams?: {
    nodes?: Array<{
      id?: string | null;
      key?: string | null;
      name?: string | null;
    }> | null;
  } | null;
  updatedAt?: string | null;
  url?: string | null;
};

export type LinearProjectUpdateNode = {
  body?: string | null;
  createdAt?: string | null;
  health?: string | null;
  id?: string | null;
  isDiffHidden?: boolean | null;
  project?: {
    id?: string | null;
    name?: string | null;
  } | null;
  slugId?: string | null;
  updatedAt?: string | null;
  url?: string | null;
  user?: LinearUserNode | null;
};

export type LinearProjectMilestoneNode = {
  createdAt?: string | null;
  description?: string | null;
  id?: string | null;
  name?: string | null;
  progress?: number | null;
  project?: {
    id?: string | null;
    name?: string | null;
  } | null;
  status?: string | null;
  targetDate?: string | null;
  updatedAt?: string | null;
};

export type LinearCycleNode = {
  completedAt?: string | null;
  createdAt?: string | null;
  description?: string | null;
  endsAt?: string | null;
  id?: string | null;
  isActive?: boolean | null;
  isFuture?: boolean | null;
  isPast?: boolean | null;
  name?: string | null;
  number?: number | null;
  progress?: number | null;
  startsAt?: string | null;
  team?: {
    id?: string | null;
    key?: string | null;
    name?: string | null;
  } | null;
};

export type LinearInitiativeNode = {
  color?: string | null;
  completedAt?: string | null;
  content?: string | null;
  createdAt?: string | null;
  creator?: LinearUserNode | null;
  description?: string | null;
  health?: string | null;
  healthUpdatedAt?: string | null;
  icon?: string | null;
  id?: string | null;
  name?: string | null;
  owner?: LinearUserNode | null;
  slugId?: string | null;
  startedAt?: string | null;
  status?: string | null;
  targetDate?: string | null;
  trashed?: boolean | null;
  updatedAt?: string | null;
  url?: string | null;
};

export type LinearInitiativeUpdateNode = {
  body?: string | null;
  createdAt?: string | null;
  health?: string | null;
  id?: string | null;
  initiative?: {
    id?: string | null;
    name?: string | null;
  } | null;
  isDiffHidden?: boolean | null;
  slugId?: string | null;
  updatedAt?: string | null;
  url?: string | null;
  user?: LinearUserNode | null;
};

export type LinearCustomerStatusNode = {
  color?: string | null;
  createdAt?: string | null;
  description?: string | null;
  displayName?: string | null;
  id?: string | null;
  name?: string | null;
  position?: number | null;
  updatedAt?: string | null;
};

export type LinearCustomerTierNode = {
  color?: string | null;
  createdAt?: string | null;
  description?: string | null;
  displayName?: string | null;
  id?: string | null;
  name?: string | null;
  position?: number | null;
  updatedAt?: string | null;
};

export type LinearCustomerNode = {
  createdAt?: string | null;
  domains?: string[] | null;
  externalIds?: string[] | null;
  id?: string | null;
  logoUrl?: string | null;
  mainSourceId?: string | null;
  name?: string | null;
  owner?: LinearUserNode | null;
  revenue?: number | null;
  size?: number | null;
  slackChannelId?: string | null;
  slugId?: string | null;
  status?: LinearCustomerStatusNode | null;
  tier?: LinearCustomerTierNode | null;
  updatedAt?: string | null;
  url?: string | null;
};

export type LinearCustomerNeedNode = {
  attachment?: LinearAttachmentNode | null;
  body?: string | null;
  createdAt?: string | null;
  creator?: LinearUserNode | null;
  customer?: {
    id?: string | null;
    name?: string | null;
  } | null;
  id?: string | null;
  issue?: LinearIssueReferenceNode | null;
  priority?: number | null;
  project?: {
    id?: string | null;
    name?: string | null;
  } | null;
  updatedAt?: string | null;
  url?: string | null;
};

export async function executeLinearGraphql<T>(input: {
  accessToken: string;
  query: string;
  variables?: Record<string, unknown>;
}): Promise<T> {
  const variables = input.variables ?? {};
  const operationName = extractOperationName(input.query);
  const response = await fetch(LINEAR_GRAPHQL_URL, {
    body: JSON.stringify({
      query: input.query,
      variables,
    }),
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const rawResponseText = await response.text();
  let payload: {
    data?: T | null;
    errors?: Array<{
      extensions?: {
        code?: string;
      } | null;
      message?: string;
    }>;
  };

  try {
    payload = JSON.parse(rawResponseText) as typeof payload;
  } catch {
    const rawResponseSnippet = clipForLog(rawResponseText);

    console.error(
      `[linear] non-json response operation=${operationName} status=${response.status} variables=${summarizeVariables(variables)} response=${rawResponseSnippet}`,
    );

    throw new LinearGraphqlError("Linear returned a non-JSON response.", {
      operationName,
      rawResponseSnippet,
      status: response.status,
      variableSummary: summarizeVariables(variables),
    });
  }

  const firstError = payload.errors?.find((error) => Boolean(error.message));

  if (!response.ok || firstError || !payload.data) {
    const rawResponseSnippet = clipForLog(rawResponseText);
    const variableSummary = summarizeVariables(variables);

    console.error(
      `[linear] graphql request failed operation=${operationName} status=${response.status} code=${firstError?.extensions?.code ?? "none"} message=${firstError?.message ?? "missing data"} variables=${variableSummary} response=${rawResponseSnippet}`,
    );

    throw new LinearGraphqlError(
      firstError?.message ?? "Linear request failed.",
      {
        code: firstError?.extensions?.code,
        operationName,
        rawResponseSnippet,
        status: response.status,
        variableSummary,
      },
    );
  }

  return payload.data;
}

export type LinearUploadHeader = {
  key: string;
  value: string;
};

export type LinearUploadPlan = {
  assetUrl: string | null;
  contentType: string | null;
  filename: string | null;
  headers: LinearUploadHeader[];
  metadata: Record<string, unknown> | null;
  size: number | null;
  uploadUrl: string | null;
};

const FILE_UPLOAD_MUTATION = `
  mutation OttoLinearFileUpload(
    $contentType: String!
    $filename: String!
    $makePublic: Boolean
    $metaData: JSON
    $size: Int!
  ) {
    fileUpload(
      contentType: $contentType
      filename: $filename
      makePublic: $makePublic
      metaData: $metaData
      size: $size
    ) {
      lastSyncId
      success
      uploadFile {
        assetUrl
        contentType
        filename
        headers {
          key
          value
        }
        metaData
        size
        uploadUrl
      }
    }
  }
`;

function normalizeLinearUploadPlan(
  uploadFile:
    | {
        assetUrl?: string | null;
        contentType?: string | null;
        filename?: string | null;
        headers?: Array<{
          key?: string | null;
          value?: string | null;
        }> | null;
        metaData?: Record<string, unknown> | null;
        size?: number | null;
        uploadUrl?: string | null;
      }
    | null
    | undefined,
): LinearUploadPlan | null {
  if (!uploadFile) {
    return null;
  }

  return {
    assetUrl: uploadFile.assetUrl ?? null,
    contentType: uploadFile.contentType?.trim() || null,
    filename: uploadFile.filename?.trim() || null,
    headers: (uploadFile.headers ?? [])
      .map((header) => ({
        key: header.key?.trim() || "",
        value: header.value?.trim() || "",
      }))
      .filter((header) => header.key.length > 0),
    metadata: uploadFile.metaData ?? null,
    size:
      typeof uploadFile.size === "number" ? uploadFile.size : null,
    uploadUrl: uploadFile.uploadUrl ?? null,
  };
}

export async function requestLinearUploadUrl(input: {
  accessToken: string;
  contentType: string;
  filename: string;
  makePublic?: boolean | null;
  metaData?: Record<string, unknown> | null;
  size: number;
}): Promise<{
  lastSyncId: number | null;
  success: boolean;
  uploadFile: LinearUploadPlan | null;
}> {
  const data = await executeLinearGraphql<{
    fileUpload?: {
      lastSyncId?: number | null;
      success?: boolean | null;
      uploadFile?: {
        assetUrl?: string | null;
        contentType?: string | null;
        filename?: string | null;
        headers?: Array<{
          key?: string | null;
          value?: string | null;
        }> | null;
        metaData?: Record<string, unknown> | null;
        size?: number | null;
        uploadUrl?: string | null;
      } | null;
    } | null;
  }>({
    accessToken: input.accessToken,
    query: FILE_UPLOAD_MUTATION,
    variables: {
      contentType: input.contentType,
      filename: input.filename,
      makePublic: input.makePublic ?? null,
      metaData: input.metaData ?? null,
      size: input.size,
    },
  });

  return {
    lastSyncId:
      typeof data.fileUpload?.lastSyncId === "number"
        ? data.fileUpload.lastSyncId
        : null,
    success: data.fileUpload?.success ?? true,
    uploadFile: normalizeLinearUploadPlan(data.fileUpload?.uploadFile),
  };
}

export function decodeLinearFileContentBase64(input: {
  contentBase64: string;
  filename: string;
}) {
  const trimmed = input.contentBase64.trim();
  const payload = trimmed.includes(",")
    ? trimmed.slice(trimmed.indexOf(",") + 1)
    : trimmed;

  if (!payload) {
    throw new Error(
      `Missing file bytes for ${input.filename}. Provide contentBase64.`,
    );
  }

  try {
    return Buffer.from(payload, "base64");
  } catch {
    throw new Error(
      `Invalid base64 file bytes for ${input.filename}. Provide contentBase64.`,
    );
  }
}

export async function uploadLinearFileBytes(input: {
  bytes: Buffer;
  contentType: string;
  uploadFile: LinearUploadPlan;
}) {
  if (!input.uploadFile.uploadUrl) {
    throw new Error("Linear did not return an uploadUrl.");
  }

  const headers = new Headers();
  headers.set("Content-Type", input.contentType);

  if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", "public, max-age=31536000");
  }

  for (const header of input.uploadFile.headers) {
    if (header.key) {
      headers.set(header.key, header.value);
    }
  }

  const response = await fetch(input.uploadFile.uploadUrl, {
    body: new Blob([Uint8Array.from(input.bytes)], {
      type: input.contentType,
    }),
    headers,
    method: "PUT",
  });

  if (response.ok) {
    return;
  }

  const rawResponseText = await response.text();
  const rawResponseSnippet = clipForLog(rawResponseText);

  console.error(
    `[linear] upload put failed status=${response.status} filename=${input.uploadFile.filename ?? "unknown"} contentType=${input.contentType} response=${rawResponseSnippet}`,
  );

  throw new Error(
    `Linear upload PUT failed with status ${response.status}.`,
  );
}

export function getLinearIssueFields() {
  return ISSUE_FIELDS;
}

export function getLinearUserFields() {
  return USER_FIELDS;
}

export function getLinearTeamReferenceFields() {
  return TEAM_REFERENCE_FIELDS;
}

export function getLinearCommentFields() {
  return COMMENT_FIELDS;
}

export function getLinearAttachmentFields() {
  return ATTACHMENT_FIELDS;
}

export function getLinearDocumentFields() {
  return DOCUMENT_FIELDS;
}

export function getLinearIssueRelationFields() {
  return ISSUE_RELATION_FIELDS;
}

export function getLinearIssueLabelFields() {
  return ISSUE_LABEL_FIELDS;
}

export function getLinearProjectFields() {
  return PROJECT_FIELDS;
}

export function getLinearProjectStatusFields() {
  return PROJECT_STATUS_FIELDS;
}

export function getLinearProjectLabelFields() {
  return PROJECT_LABEL_FIELDS;
}

export function getLinearProjectUpdateFields() {
  return PROJECT_UPDATE_FIELDS;
}

export function getLinearProjectMilestoneFields() {
  return PROJECT_MILESTONE_FIELDS;
}

export function getLinearCycleFields() {
  return CYCLE_FIELDS;
}

export function getLinearInitiativeFields() {
  return INITIATIVE_FIELDS;
}

export function getLinearInitiativeUpdateFields() {
  return INITIATIVE_UPDATE_FIELDS;
}

export function getLinearCustomerFields() {
  return CUSTOMER_FIELDS;
}

export function getLinearCustomerNeedFields() {
  return CUSTOMER_NEED_FIELDS;
}

export function getLinearCustomerStatusFields() {
  return CUSTOMER_STATUS_FIELDS;
}

export function getLinearCustomerTierFields() {
  return CUSTOMER_TIER_FIELDS;
}

export function mapLinearIssueReference(
  issue: LinearIssueReferenceNode | null,
) {
  if (!issue) {
    return null;
  }

  return {
    id: issue.id?.trim() || null,
    identifier: issue.identifier?.trim() || null,
    title: issue.title?.trim() || "Untitled issue",
  };
}

export function mapLinearUser(user: LinearUserNode | null) {
  if (!user) {
    return null;
  }

  return {
    active: user.active ?? false,
    admin: user.admin ?? false,
    displayName: user.displayName?.trim() || null,
    email: user.email?.trim() || null,
    guest: user.guest ?? false,
    id: user.id?.trim() || null,
    isAssignable: user.isAssignable ?? false,
    isMentionable: user.isMentionable ?? false,
    lastSeen: user.lastSeen ?? null,
    name:
      user.name?.trim() ||
      user.displayName?.trim() ||
      user.email?.trim() ||
      "Unknown user",
    owner: user.owner ?? false,
    statusEmoji: user.statusEmoji?.trim() || null,
    statusLabel: user.statusLabel?.trim() || null,
    statusUntilAt: user.statusUntilAt ?? null,
  };
}

export function mapLinearTeamReference(team: LinearTeamReferenceNode | null) {
  if (!team) {
    return null;
  }

  return {
    displayName: team.displayName?.trim() || null,
    id: team.id?.trim() || null,
    key: team.key?.trim() || null,
    name: team.name?.trim() || team.displayName?.trim() || null,
  };
}

export function mapLinearTeamMembership(membership: LinearTeamMembershipNode) {
  return {
    createdAt: membership.createdAt ?? null,
    id: membership.id?.trim() || null,
    owner: membership.owner ?? false,
    sortOrder:
      typeof membership.sortOrder === "number" &&
      Number.isFinite(membership.sortOrder)
        ? membership.sortOrder
        : 0,
    team: mapLinearTeamReference(membership.team ?? null),
    updatedAt: membership.updatedAt ?? null,
    user: mapLinearUser(membership.user ?? null),
  };
}

export function mapLinearIssue(issue: LinearIssueNode) {
  return {
    assignee:
      issue.assignee?.name?.trim() ||
      issue.assignee?.displayName?.trim() ||
      null,
    assigneeEmail: issue.assignee?.email?.trim() || null,
    createdAt: issue.createdAt ?? null,
    description: issue.description?.trim() || null,
    id: issue.id?.trim() || null,
    identifier: issue.identifier?.trim() || null,
    labelIds: normalizeStringArray(issue.labelIds),
    priority:
      typeof issue.priority === "number" && Number.isFinite(issue.priority)
        ? issue.priority
        : 0,
    project: issue.project?.name?.trim() || null,
    projectId: issue.project?.id?.trim() || null,
    state: issue.state?.name?.trim() || issue.state?.type?.trim() || null,
    stateId: issue.state?.id?.trim() || null,
    team: issue.team?.key?.trim() || issue.team?.name?.trim() || null,
    teamId: issue.team?.id?.trim() || null,
    title: issue.title?.trim() || "Untitled issue",
    updatedAt: issue.updatedAt ?? null,
    url: issue.url ?? null,
  };
}

export function mapLinearComment(comment: LinearCommentNode) {
  return {
    body: comment.body?.trim() || "",
    createdAt: comment.createdAt ?? null,
    id: comment.id?.trim() || null,
    issue: mapLinearIssueReference(comment.issue ?? null),
    issueId: comment.issueId?.trim() || null,
    parentId: comment.parentId?.trim() || null,
    quotedText: comment.quotedText?.trim() || null,
    resolvedAt: comment.resolvedAt ?? null,
    updatedAt: comment.updatedAt ?? null,
    url: comment.url ?? null,
    user:
      comment.user?.name?.trim() || comment.user?.displayName?.trim() || null,
    userEmail: comment.user?.email?.trim() || null,
    userId: comment.user?.id?.trim() || null,
  };
}

export function mapLinearAttachment(attachment: LinearAttachmentNode) {
  return {
    archivedAt: attachment.archivedAt ?? null,
    bodyData: attachment.bodyData?.trim() || null,
    createdAt: attachment.createdAt ?? null,
    creator:
      attachment.creator?.name?.trim() ||
      attachment.creator?.displayName?.trim() ||
      null,
    creatorEmail: attachment.creator?.email?.trim() || null,
    creatorId: attachment.creator?.id?.trim() || null,
    id: attachment.id?.trim() || null,
    issue: mapLinearIssueReference(attachment.issue ?? null),
    issueId: attachment.issue?.id?.trim() || null,
    metadata: attachment.metadata ?? null,
    originalIssue: mapLinearIssueReference(attachment.originalIssue ?? null),
    originalIssueId: attachment.originalIssue?.id?.trim() || null,
    source: attachment.source ?? null,
    sourceType: attachment.sourceType?.trim() || null,
    subtitle: attachment.subtitle?.trim() || null,
    title: attachment.title?.trim() || "Untitled attachment",
    updatedAt: attachment.updatedAt ?? null,
    url: attachment.url ?? null,
  };
}

export function buildLinearAttachmentCommandResult(input: {
  attachment: LinearAttachmentNode | null | undefined;
  commandKey: string;
  lastSyncId?: number | null;
  success?: boolean | null;
}) {
  return {
    attachment: input.attachment ? mapLinearAttachment(input.attachment) : null,
    commandKey: input.commandKey,
    integrationKey: "linear",
    lastSyncId: typeof input.lastSyncId === "number" ? input.lastSyncId : null,
    source: "linear",
    success: input.success ?? true,
  };
}

export function buildLinearAttachmentCollectionCommandResult(input: {
  commandKey: string;
  items: LinearAttachmentNode[];
  limit: number;
}) {
  return {
    commandKey: input.commandKey,
    integrationKey: "linear",
    items: input.items.map(mapLinearAttachment),
    limit: input.limit,
    source: "linear",
    totalMatched: input.items.length,
  };
}

export function buildLinearCommentCommandResult(input: {
  commandKey: string;
  comment: LinearCommentNode | null | undefined;
  lastSyncId?: number | null;
  success?: boolean | null;
}) {
  return {
    commandKey: input.commandKey,
    comment: input.comment ? mapLinearComment(input.comment) : null,
    integrationKey: "linear",
    lastSyncId: typeof input.lastSyncId === "number" ? input.lastSyncId : null,
    source: "linear",
    success: input.success ?? true,
  };
}

export function buildLinearCommentCollectionCommandResult(input: {
  commandKey: string;
  items: LinearCommentNode[];
  limit: number;
}) {
  return {
    commandKey: input.commandKey,
    integrationKey: "linear",
    items: input.items.map(mapLinearComment),
    limit: input.limit,
    source: "linear",
    totalMatched: input.items.length,
  };
}

export function buildLinearDocumentCommandResult(input: {
  commandKey: string;
  document: LinearDocumentNode | null | undefined;
  lastSyncId?: number | null;
  success?: boolean | null;
}) {
  return {
    commandKey: input.commandKey,
    document: input.document ? mapLinearDocument(input.document) : null,
    integrationKey: "linear",
    lastSyncId: typeof input.lastSyncId === "number" ? input.lastSyncId : null,
    source: "linear",
    success: input.success ?? true,
  };
}

export function buildLinearDocumentCollectionCommandResult(input: {
  commandKey: string;
  items: LinearDocumentNode[];
  limit: number;
}) {
  return {
    commandKey: input.commandKey,
    integrationKey: "linear",
    items: input.items.map(mapLinearDocument),
    limit: input.limit,
    source: "linear",
    totalMatched: input.items.length,
  };
}

export function buildLinearIssueLabelCommandResult(input: {
  commandKey: string;
  issueLabel: LinearIssueLabelNode | null | undefined;
  lastSyncId?: number | null;
  success?: boolean | null;
}) {
  return {
    commandKey: input.commandKey,
    integrationKey: "linear",
    issueLabel: input.issueLabel ? mapLinearIssueLabel(input.issueLabel) : null,
    lastSyncId: typeof input.lastSyncId === "number" ? input.lastSyncId : null,
    source: "linear",
    success: input.success ?? true,
  };
}

export function buildLinearIssueLabelCollectionCommandResult(input: {
  commandKey: string;
  items: LinearIssueLabelNode[];
  limit: number;
}) {
  return {
    commandKey: input.commandKey,
    integrationKey: "linear",
    items: input.items.map(mapLinearIssueLabel),
    limit: input.limit,
    source: "linear",
    totalMatched: input.items.length,
  };
}

export function buildLinearProjectLabelCommandResult(input: {
  commandKey: string;
  lastSyncId?: number | null;
  projectLabel: LinearProjectLabelNode | null | undefined;
  success?: boolean | null;
}) {
  return {
    commandKey: input.commandKey,
    integrationKey: "linear",
    lastSyncId: typeof input.lastSyncId === "number" ? input.lastSyncId : null,
    projectLabel: input.projectLabel
      ? mapLinearProjectLabel(input.projectLabel)
      : null,
    source: "linear",
    success: input.success ?? true,
  };
}

export function buildLinearProjectLabelCollectionCommandResult(input: {
  commandKey: string;
  items: LinearProjectLabelNode[];
  limit: number;
}) {
  return {
    commandKey: input.commandKey,
    integrationKey: "linear",
    items: input.items.map(mapLinearProjectLabel),
    limit: input.limit,
    source: "linear",
    totalMatched: input.items.length,
  };
}

export function buildLinearDeleteCommandResult(input: {
  commandKey: string;
  entityId: string | null | undefined;
  entityKey: string;
  lastSyncId?: number | null;
  success?: boolean | null;
}) {
  return {
    commandKey: input.commandKey,
    [`deleted${input.entityKey}`]: input.entityId?.trim() || null,
    integrationKey: "linear",
    lastSyncId: typeof input.lastSyncId === "number" ? input.lastSyncId : null,
    source: "linear",
    success: input.success ?? true,
  };
}

export function buildLinearUserCommandResult(input: {
  commandKey: string;
  lastSyncId?: number | null;
  success?: boolean | null;
  user: LinearUserNode | null | undefined;
}) {
  return {
    commandKey: input.commandKey,
    integrationKey: "linear",
    lastSyncId: typeof input.lastSyncId === "number" ? input.lastSyncId : null,
    source: "linear",
    success: input.success ?? true,
    user: mapLinearUser(input.user ?? null),
  };
}

export function buildLinearUserCollectionCommandResult(input: {
  commandKey: string;
  items: LinearUserNode[];
  limit: number;
}) {
  return {
    commandKey: input.commandKey,
    integrationKey: "linear",
    items: input.items.map((user) => mapLinearUser(user)),
    limit: input.limit,
    source: "linear",
    totalMatched: input.items.length,
  };
}

export function buildLinearUserIssueCollectionCommandResult(input: {
  commandKey: string;
  items: LinearIssueNode[];
  limit: number;
  user: LinearUserNode;
}) {
  return {
    commandKey: input.commandKey,
    integrationKey: "linear",
    items: input.items.map(mapLinearIssue),
    limit: input.limit,
    source: "linear",
    totalMatched: input.items.length,
    user: mapLinearUser(input.user),
  };
}

export function buildLinearUserTeamMembershipCollectionCommandResult(input: {
  commandKey: string;
  items: LinearTeamMembershipNode[];
  limit: number;
  user: LinearUserNode;
}) {
  return {
    commandKey: input.commandKey,
    integrationKey: "linear",
    items: input.items.map(mapLinearTeamMembership),
    limit: input.limit,
    source: "linear",
    totalMatched: input.items.length,
    user: mapLinearUser(input.user),
  };
}

export function mapLinearDocument(document: LinearDocumentNode) {
  return {
    color: document.color?.trim() || null,
    content: document.content?.trim() || null,
    createdAt: document.createdAt ?? null,
    creator:
      document.creator?.name?.trim() ||
      document.creator?.displayName?.trim() ||
      null,
    creatorEmail: document.creator?.email?.trim() || null,
    creatorId: document.creator?.id?.trim() || null,
    cycleId: document.cycle?.id?.trim() || null,
    cycleName:
      document.cycle?.name?.trim() ||
      (typeof document.cycle?.number === "number"
        ? `Cycle ${document.cycle.number}`
        : null),
    id: document.id?.trim() || null,
    icon: document.icon?.trim() || null,
    initiativeId: document.initiative?.id?.trim() || null,
    initiativeName: document.initiative?.name?.trim() || null,
    issue: mapLinearIssueReference(document.issue ?? null),
    issueId: document.issue?.id?.trim() || null,
    projectId: document.project?.id?.trim() || null,
    projectName: document.project?.name?.trim() || null,
    sortOrder:
      typeof document.sortOrder === "number" &&
      Number.isFinite(document.sortOrder)
        ? document.sortOrder
        : 0,
    slugId: document.slugId?.trim() || null,
    summary: document.summary?.trim() || null,
    team: mapLinearTeamReference(document.team ?? null),
    title: document.title?.trim() || "Untitled document",
    trashed: document.trashed ?? false,
    updatedAt: document.updatedAt ?? null,
    updatedBy:
      document.updatedBy?.name?.trim() ||
      document.updatedBy?.displayName?.trim() ||
      null,
    updatedByEmail: document.updatedBy?.email?.trim() || null,
    updatedById: document.updatedBy?.id?.trim() || null,
    url: document.url ?? null,
  };
}

export function mapLinearIssueRelation(relation: LinearIssueRelationNode) {
  return {
    createdAt: relation.createdAt ?? null,
    id: relation.id?.trim() || null,
    issue: mapLinearIssueReference(relation.issue ?? null),
    relatedIssue: mapLinearIssueReference(relation.relatedIssue ?? null),
    type: relation.type?.trim() || null,
    updatedAt: relation.updatedAt ?? null,
  };
}

export function mapLinearIssueLabel(label: LinearIssueLabelNode) {
  return {
    color: label.color?.trim() || null,
    createdAt: label.createdAt ?? null,
    creator:
      label.creator?.name?.trim() || label.creator?.displayName?.trim() || null,
    creatorEmail: label.creator?.email?.trim() || null,
    creatorId: label.creator?.id?.trim() || null,
    description: label.description?.trim() || null,
    id: label.id?.trim() || null,
    isGroup: label.isGroup ?? false,
    lastAppliedAt: label.lastAppliedAt ?? null,
    name: label.name?.trim() || "Untitled label",
    parentId: label.parent?.id?.trim() || null,
    parentName: label.parent?.name?.trim() || null,
    retiredAt: label.retiredAt ?? null,
    team: mapLinearTeamReference(label.team ?? null),
    updatedAt: label.updatedAt ?? null,
  };
}

export function mapLinearProjectStatus(status: LinearProjectStatusNode | null) {
  if (!status) {
    return null;
  }

  return {
    color: status.color?.trim() || null,
    description: status.description?.trim() || null,
    id: status.id?.trim() || null,
    name: status.name?.trim() || null,
    type: status.type?.trim() || null,
  };
}

export function mapLinearProjectLabel(label: LinearProjectLabelNode) {
  return {
    color: label.color?.trim() || null,
    createdAt: label.createdAt ?? null,
    creator:
      label.creator?.name?.trim() || label.creator?.displayName?.trim() || null,
    creatorEmail: label.creator?.email?.trim() || null,
    creatorId: label.creator?.id?.trim() || null,
    description: label.description?.trim() || null,
    id: label.id?.trim() || null,
    isGroup: label.isGroup ?? false,
    lastAppliedAt: label.lastAppliedAt ?? null,
    name: label.name?.trim() || "Untitled label",
    parentId: label.parent?.id?.trim() || null,
    parentName: label.parent?.name?.trim() || null,
    retiredAt: label.retiredAt ?? null,
    updatedAt: label.updatedAt ?? null,
  };
}

export function mapLinearProject(project: LinearProjectNode) {
  return {
    color: project.color?.trim() || null,
    content: project.content?.trim() || null,
    createdAt: project.createdAt ?? null,
    description: project.description?.trim() || null,
    icon: project.icon?.trim() || null,
    id: project.id?.trim() || null,
    labelIds: normalizeStringArray(project.labelIds),
    lead:
      project.lead?.name?.trim() || project.lead?.displayName?.trim() || null,
    leadEmail: project.lead?.email?.trim() || null,
    leadId: project.lead?.id?.trim() || null,
    name: project.name?.trim() || "Untitled project",
    priority:
      typeof project.priority === "number" && Number.isFinite(project.priority)
        ? project.priority
        : 0,
    slugId: project.slugId?.trim() || null,
    startDate: project.startDate ?? null,
    status: mapLinearProjectStatus(project.status ?? null),
    targetDate: project.targetDate ?? null,
    teamIds: (project.teams?.nodes ?? [])
      .map((team) => team.id?.trim() || null)
      .filter((value): value is string => Boolean(value)),
    teams: (project.teams?.nodes ?? [])
      .map((team) => team.key?.trim() || team.name?.trim() || "")
      .filter(Boolean),
    updatedAt: project.updatedAt ?? null,
    url: project.url ?? null,
  };
}

export function mapLinearProjectUpdate(update: LinearProjectUpdateNode) {
  return {
    body: update.body?.trim() || "",
    createdAt: update.createdAt ?? null,
    health: update.health?.trim() || null,
    id: update.id?.trim() || null,
    isDiffHidden: update.isDiffHidden ?? false,
    projectId: update.project?.id?.trim() || null,
    projectName: update.project?.name?.trim() || null,
    slugId: update.slugId?.trim() || null,
    updatedAt: update.updatedAt ?? null,
    url: update.url ?? null,
    user: update.user?.name?.trim() || update.user?.displayName?.trim() || null,
    userEmail: update.user?.email?.trim() || null,
    userId: update.user?.id?.trim() || null,
  };
}

export function mapLinearProjectMilestone(
  milestone: LinearProjectMilestoneNode,
) {
  return {
    createdAt: milestone.createdAt ?? null,
    description: milestone.description?.trim() || null,
    id: milestone.id?.trim() || null,
    name: milestone.name?.trim() || "Untitled milestone",
    progress:
      typeof milestone.progress === "number" &&
      Number.isFinite(milestone.progress)
        ? milestone.progress
        : 0,
    projectId: milestone.project?.id?.trim() || null,
    projectName: milestone.project?.name?.trim() || null,
    status: milestone.status?.trim() || null,
    targetDate: milestone.targetDate ?? null,
    updatedAt: milestone.updatedAt ?? null,
  };
}

export function mapLinearCycle(cycle: LinearCycleNode) {
  const cycleName = cycle.name?.trim();
  const cycleNumber =
    typeof cycle.number === "number" && Number.isFinite(cycle.number)
      ? cycle.number
      : null;

  return {
    completedAt: cycle.completedAt ?? null,
    createdAt: cycle.createdAt ?? null,
    description: cycle.description?.trim() || null,
    endsAt: cycle.endsAt ?? null,
    id: cycle.id?.trim() || null,
    isActive: cycle.isActive ?? false,
    isFuture: cycle.isFuture ?? false,
    isPast: cycle.isPast ?? false,
    name:
      cycleName ||
      (cycleNumber !== null ? `Cycle ${cycleNumber}` : "Untitled cycle"),
    number: cycleNumber,
    progress:
      typeof cycle.progress === "number" && Number.isFinite(cycle.progress)
        ? cycle.progress
        : 0,
    startsAt: cycle.startsAt ?? null,
    team: cycle.team?.key?.trim() || cycle.team?.name?.trim() || null,
    teamId: cycle.team?.id?.trim() || null,
  };
}

export function mapLinearInitiative(initiative: LinearInitiativeNode) {
  return {
    color: initiative.color?.trim() || null,
    completedAt: initiative.completedAt ?? null,
    content: initiative.content?.trim() || null,
    createdAt: initiative.createdAt ?? null,
    creator:
      initiative.creator?.name?.trim() ||
      initiative.creator?.displayName?.trim() ||
      null,
    creatorEmail: initiative.creator?.email?.trim() || null,
    creatorId: initiative.creator?.id?.trim() || null,
    description: initiative.description?.trim() || null,
    health: initiative.health?.trim() || null,
    healthUpdatedAt: initiative.healthUpdatedAt ?? null,
    icon: initiative.icon?.trim() || null,
    id: initiative.id?.trim() || null,
    name: initiative.name?.trim() || "Untitled initiative",
    owner:
      initiative.owner?.name?.trim() ||
      initiative.owner?.displayName?.trim() ||
      null,
    ownerEmail: initiative.owner?.email?.trim() || null,
    ownerId: initiative.owner?.id?.trim() || null,
    slugId: initiative.slugId?.trim() || null,
    startedAt: initiative.startedAt ?? null,
    status: initiative.status?.trim() || null,
    targetDate: initiative.targetDate ?? null,
    trashed: initiative.trashed ?? false,
    updatedAt: initiative.updatedAt ?? null,
    url: initiative.url ?? null,
  };
}

export function mapLinearInitiativeUpdate(
  initiativeUpdate: LinearInitiativeUpdateNode,
) {
  return {
    body: initiativeUpdate.body?.trim() || "",
    createdAt: initiativeUpdate.createdAt ?? null,
    health: initiativeUpdate.health?.trim() || null,
    id: initiativeUpdate.id?.trim() || null,
    initiativeId: initiativeUpdate.initiative?.id?.trim() || null,
    initiativeName: initiativeUpdate.initiative?.name?.trim() || null,
    isDiffHidden: initiativeUpdate.isDiffHidden ?? false,
    slugId: initiativeUpdate.slugId?.trim() || null,
    updatedAt: initiativeUpdate.updatedAt ?? null,
    url: initiativeUpdate.url ?? null,
    user:
      initiativeUpdate.user?.name?.trim() ||
      initiativeUpdate.user?.displayName?.trim() ||
      null,
    userEmail: initiativeUpdate.user?.email?.trim() || null,
    userId: initiativeUpdate.user?.id?.trim() || null,
  };
}

export function mapLinearCustomerStatus(
  status: LinearCustomerStatusNode | null,
) {
  if (!status) {
    return null;
  }

  return {
    color: status.color?.trim() || null,
    createdAt: status.createdAt ?? null,
    description: status.description?.trim() || null,
    displayName: status.displayName?.trim() || null,
    id: status.id?.trim() || null,
    name: status.name?.trim() || null,
    position:
      typeof status.position === "number" && Number.isFinite(status.position)
        ? status.position
        : 0,
    updatedAt: status.updatedAt ?? null,
  };
}

export function mapLinearCustomerTier(tier: LinearCustomerTierNode | null) {
  if (!tier) {
    return null;
  }

  return {
    color: tier.color?.trim() || null,
    createdAt: tier.createdAt ?? null,
    description: tier.description?.trim() || null,
    displayName: tier.displayName?.trim() || null,
    id: tier.id?.trim() || null,
    name: tier.name?.trim() || null,
    position:
      typeof tier.position === "number" && Number.isFinite(tier.position)
        ? tier.position
        : 0,
    updatedAt: tier.updatedAt ?? null,
  };
}

export function mapLinearCustomer(customer: LinearCustomerNode) {
  return {
    createdAt: customer.createdAt ?? null,
    domains: normalizeStringArray(customer.domains),
    externalIds: normalizeStringArray(customer.externalIds),
    id: customer.id?.trim() || null,
    logoUrl: customer.logoUrl?.trim() || null,
    mainSourceId: customer.mainSourceId?.trim() || null,
    name: customer.name?.trim() || "Untitled customer",
    owner:
      customer.owner?.name?.trim() ||
      customer.owner?.displayName?.trim() ||
      null,
    ownerEmail: customer.owner?.email?.trim() || null,
    ownerId: customer.owner?.id?.trim() || null,
    revenue:
      typeof customer.revenue === "number" && Number.isFinite(customer.revenue)
        ? customer.revenue
        : null,
    size:
      typeof customer.size === "number" && Number.isFinite(customer.size)
        ? customer.size
        : null,
    slackChannelId: customer.slackChannelId?.trim() || null,
    slugId: customer.slugId?.trim() || null,
    status: mapLinearCustomerStatus(customer.status ?? null),
    tier: mapLinearCustomerTier(customer.tier ?? null),
    updatedAt: customer.updatedAt ?? null,
    url: customer.url ?? null,
  };
}

export function mapLinearCustomerNeed(need: LinearCustomerNeedNode) {
  return {
    attachment: need.attachment ? mapLinearAttachment(need.attachment) : null,
    body: need.body?.trim() || null,
    createdAt: need.createdAt ?? null,
    creator:
      need.creator?.name?.trim() || need.creator?.displayName?.trim() || null,
    creatorEmail: need.creator?.email?.trim() || null,
    creatorId: need.creator?.id?.trim() || null,
    customerId: need.customer?.id?.trim() || null,
    customerName: need.customer?.name?.trim() || null,
    id: need.id?.trim() || null,
    issue: mapLinearIssueReference(need.issue ?? null),
    priority:
      typeof need.priority === "number" && Number.isFinite(need.priority)
        ? need.priority
        : 0,
    projectId: need.project?.id?.trim() || null,
    projectName: need.project?.name?.trim() || null,
    updatedAt: need.updatedAt ?? null,
    url: need.url?.trim() || null,
  };
}

export function normalizeLimit(input: {
  defaultLimit?: number;
  max: number;
  value: unknown;
}) {
  const fallback = input.defaultLimit ?? 10;

  return typeof input.value === "number" &&
    Number.isInteger(input.value) &&
    input.value >= 1 &&
    input.value <= input.max
    ? input.value
    : fallback;
}

export function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

export function normalizeOptionalStringArray(value: unknown) {
  return Array.isArray(value) ? normalizeStringArray(value) : null;
}

export function normalizeOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

export function normalizeOptionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

export function normalizeOptionalInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

export function pruneGraphqlInput<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(
      ([, value]) => value !== null && value !== undefined,
    ),
  ) as Partial<T>;
}

export function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function findLinearIssueByIdentifierOrId(input: {
  accessToken: string;
  identifierOrId: string;
}): Promise<LinearIssueNode | null> {
  const lookup = input.identifierOrId.trim();

  if (!lookup) {
    return null;
  }

  if (isUuidLike(lookup)) {
    try {
      const byId = await executeLinearGraphql<{
        issue?: LinearIssueNode | null;
      }>({
        accessToken: input.accessToken,
        query: GET_ISSUE_BY_ID_QUERY,
        variables: {
          id: lookup,
        },
      });

      if (byId.issue?.id) {
        return byId.issue;
      }
    } catch (error) {
      if (!(error instanceof LinearGraphqlError)) {
        throw error;
      }
    }
  }

  const byLookup = await executeLinearGraphql<{
    searchIssues?: {
      nodes?: LinearIssueNode[] | null;
    } | null;
  }>({
    accessToken: input.accessToken,
    query: SEARCH_ISSUE_BY_LOOKUP_QUERY,
    variables: {
      term: lookup,
    },
  });

  const normalizedLookup = lookup.toLowerCase();

  return (
    (byLookup.searchIssues?.nodes ?? []).find((issue) => {
      const id = issue.id?.trim().toLowerCase();
      const identifier = issue.identifier?.trim().toLowerCase();

      return id === normalizedLookup || identifier === normalizedLookup;
    }) ??
    (byLookup.searchIssues?.nodes ?? [])[0] ??
    null
  );
}

export async function resolveLinearIssueId(input: {
  accessToken: string;
  identifierOrId: string;
}) {
  const issue = await findLinearIssueByIdentifierOrId(input);

  if (!issue?.id) {
    throw new Error(`Linear could not find issue ${input.identifierOrId}.`);
  }

  return issue.id;
}

export async function resolveLinearIssueIds(input: {
  accessToken: string;
  identifiersOrIds: string[];
}) {
  const resolved = await Promise.all(
    input.identifiersOrIds.map((identifierOrId) =>
      resolveLinearIssueId({
        accessToken: input.accessToken,
        identifierOrId,
      }),
    ),
  );

  return Array.from(new Set(resolved));
}

export function buildLinearIssueCommandResult(input: {
  commandKey: string;
  issue: LinearIssueNode | null | undefined;
  lastSyncId?: number | null;
  success?: boolean | null;
}) {
  return {
    commandKey: input.commandKey,
    integrationKey: "linear",
    issue: input.issue ? mapLinearIssue(input.issue) : null,
    lastSyncId: typeof input.lastSyncId === "number" ? input.lastSyncId : null,
    source: "linear",
    success: input.success ?? true,
  };
}

export function buildLinearIssueBatchCommandResult(input: {
  commandKey: string;
  issues: LinearIssueNode[];
  lastSyncId?: number | null;
  success?: boolean | null;
}) {
  return {
    commandKey: input.commandKey,
    integrationKey: "linear",
    items: input.issues.map(mapLinearIssue),
    lastSyncId: typeof input.lastSyncId === "number" ? input.lastSyncId : null,
    source: "linear",
    success: input.success ?? true,
    totalChanged: input.issues.length,
  };
}

export function buildLinearIssueCollectionCommandResult<T>(input: {
  commandKey: string;
  issue: LinearIssueNode;
  items: T[];
  limit: number;
}) {
  return {
    commandKey: input.commandKey,
    integrationKey: "linear",
    issue: mapLinearIssue(input.issue),
    items: input.items,
    limit: input.limit,
    source: "linear",
    totalMatched: input.items.length,
  };
}

export function buildLinearProjectCommandResult(input: {
  commandKey: string;
  lastSyncId?: number | null;
  project: LinearProjectNode | null | undefined;
  success?: boolean | null;
}) {
  return {
    commandKey: input.commandKey,
    integrationKey: "linear",
    lastSyncId: typeof input.lastSyncId === "number" ? input.lastSyncId : null,
    project: input.project ? mapLinearProject(input.project) : null,
    source: "linear",
    success: input.success ?? true,
  };
}

export function buildLinearProjectCollectionCommandResult(input: {
  commandKey: string;
  items: LinearProjectNode[];
  limit: number;
}) {
  return {
    commandKey: input.commandKey,
    integrationKey: "linear",
    items: input.items.map(mapLinearProject),
    limit: input.limit,
    source: "linear",
    totalMatched: input.items.length,
  };
}

export function buildLinearProjectChildCollectionCommandResult<T>(input: {
  commandKey: string;
  items: T[];
  limit: number;
  project: LinearProjectNode;
}) {
  return {
    commandKey: input.commandKey,
    integrationKey: "linear",
    items: input.items,
    limit: input.limit,
    project: mapLinearProject(input.project),
    source: "linear",
    totalMatched: input.items.length,
  };
}

export function buildLinearProjectMilestoneCommandResult(input: {
  commandKey: string;
  lastSyncId?: number | null;
  milestone: LinearProjectMilestoneNode | null | undefined;
  success?: boolean | null;
}) {
  return {
    commandKey: input.commandKey,
    integrationKey: "linear",
    lastSyncId: typeof input.lastSyncId === "number" ? input.lastSyncId : null,
    milestone: input.milestone
      ? mapLinearProjectMilestone(input.milestone)
      : null,
    source: "linear",
    success: input.success ?? true,
  };
}

export function buildLinearProjectMilestoneCollectionCommandResult(input: {
  commandKey: string;
  items: LinearProjectMilestoneNode[];
  limit: number;
}) {
  return {
    commandKey: input.commandKey,
    integrationKey: "linear",
    items: input.items.map(mapLinearProjectMilestone),
    limit: input.limit,
    source: "linear",
    totalMatched: input.items.length,
  };
}

export function buildLinearProjectStatusCommandResult(input: {
  commandKey: string;
  lastSyncId?: number | null;
  status: LinearProjectStatusNode | null | undefined;
  success?: boolean | null;
}) {
  return {
    commandKey: input.commandKey,
    integrationKey: "linear",
    lastSyncId: typeof input.lastSyncId === "number" ? input.lastSyncId : null,
    source: "linear",
    status: mapLinearProjectStatus(input.status ?? null),
    success: input.success ?? true,
  };
}

export function buildLinearProjectStatusCollectionCommandResult(input: {
  commandKey: string;
  items: LinearProjectStatusNode[];
  limit: number;
}) {
  return {
    commandKey: input.commandKey,
    integrationKey: "linear",
    items: input.items.map((status) => mapLinearProjectStatus(status)),
    limit: input.limit,
    source: "linear",
    totalMatched: input.items.length,
  };
}

export function buildLinearInitiativeCommandResult(input: {
  commandKey: string;
  initiative: LinearInitiativeNode | null | undefined;
  lastSyncId?: number | null;
  success?: boolean | null;
}) {
  return {
    commandKey: input.commandKey,
    initiative: input.initiative ? mapLinearInitiative(input.initiative) : null,
    integrationKey: "linear",
    lastSyncId: typeof input.lastSyncId === "number" ? input.lastSyncId : null,
    source: "linear",
    success: input.success ?? true,
  };
}

export function buildLinearInitiativeCollectionCommandResult(input: {
  commandKey: string;
  items: LinearInitiativeNode[];
  limit: number;
}) {
  return {
    commandKey: input.commandKey,
    integrationKey: "linear",
    items: input.items.map(mapLinearInitiative),
    limit: input.limit,
    source: "linear",
    totalMatched: input.items.length,
  };
}

export function buildLinearInitiativeUpdateCollectionCommandResult(input: {
  commandKey: string;
  initiative: LinearInitiativeNode;
  items: LinearInitiativeUpdateNode[];
  limit: number;
}) {
  return {
    commandKey: input.commandKey,
    initiative: mapLinearInitiative(input.initiative),
    integrationKey: "linear",
    items: input.items.map(mapLinearInitiativeUpdate),
    limit: input.limit,
    source: "linear",
    totalMatched: input.items.length,
  };
}

export function buildLinearCustomerCommandResult(input: {
  commandKey: string;
  customer: LinearCustomerNode | null | undefined;
  lastSyncId?: number | null;
  success?: boolean | null;
}) {
  return {
    commandKey: input.commandKey,
    customer: input.customer ? mapLinearCustomer(input.customer) : null,
    integrationKey: "linear",
    lastSyncId: typeof input.lastSyncId === "number" ? input.lastSyncId : null,
    source: "linear",
    success: input.success ?? true,
  };
}

export function buildLinearCustomerCollectionCommandResult(input: {
  commandKey: string;
  items: LinearCustomerNode[];
  limit: number;
}) {
  return {
    commandKey: input.commandKey,
    integrationKey: "linear",
    items: input.items.map(mapLinearCustomer),
    limit: input.limit,
    source: "linear",
    totalMatched: input.items.length,
  };
}

export function buildLinearCustomerNeedCommandResult(input: {
  commandKey: string;
  lastSyncId?: number | null;
  need: LinearCustomerNeedNode | null | undefined;
  success?: boolean | null;
  updatedRelatedNeeds?: LinearCustomerNeedNode[] | null;
}) {
  return {
    commandKey: input.commandKey,
    integrationKey: "linear",
    lastSyncId: typeof input.lastSyncId === "number" ? input.lastSyncId : null,
    need: input.need ? mapLinearCustomerNeed(input.need) : null,
    source: "linear",
    success: input.success ?? true,
    updatedRelatedNeeds:
      input.updatedRelatedNeeds?.map(mapLinearCustomerNeed) ?? [],
  };
}

export function buildLinearCustomerNeedCollectionCommandResult(input: {
  commandKey: string;
  items: LinearCustomerNeedNode[];
  limit: number;
}) {
  return {
    commandKey: input.commandKey,
    integrationKey: "linear",
    items: input.items.map(mapLinearCustomerNeed),
    limit: input.limit,
    source: "linear",
    totalMatched: input.items.length,
  };
}

export function buildLinearCustomerNeedChildCollectionCommandResult(input: {
  commandKey: string;
  customer: LinearCustomerNode;
  items: LinearCustomerNeedNode[];
  limit: number;
}) {
  return {
    commandKey: input.commandKey,
    customer: mapLinearCustomer(input.customer),
    integrationKey: "linear",
    items: input.items.map(mapLinearCustomerNeed),
    limit: input.limit,
    source: "linear",
    totalMatched: input.items.length,
  };
}

export function buildLinearCustomerStatusCommandResult(input: {
  commandKey: string;
  lastSyncId?: number | null;
  status: LinearCustomerStatusNode | null | undefined;
  success?: boolean | null;
}) {
  return {
    commandKey: input.commandKey,
    integrationKey: "linear",
    lastSyncId: typeof input.lastSyncId === "number" ? input.lastSyncId : null,
    source: "linear",
    status: mapLinearCustomerStatus(input.status ?? null),
    success: input.success ?? true,
  };
}

export function buildLinearCustomerStatusCollectionCommandResult(input: {
  commandKey: string;
  items: LinearCustomerStatusNode[];
  limit: number;
}) {
  return {
    commandKey: input.commandKey,
    integrationKey: "linear",
    items: input.items.map((status) => mapLinearCustomerStatus(status)),
    limit: input.limit,
    source: "linear",
    totalMatched: input.items.length,
  };
}

export function buildLinearCustomerTierCommandResult(input: {
  commandKey: string;
  lastSyncId?: number | null;
  success?: boolean | null;
  tier: LinearCustomerTierNode | null | undefined;
}) {
  return {
    commandKey: input.commandKey,
    integrationKey: "linear",
    lastSyncId: typeof input.lastSyncId === "number" ? input.lastSyncId : null,
    source: "linear",
    success: input.success ?? true,
    tier: mapLinearCustomerTier(input.tier ?? null),
  };
}

export function buildLinearCustomerTierCollectionCommandResult(input: {
  commandKey: string;
  items: LinearCustomerTierNode[];
  limit: number;
}) {
  return {
    commandKey: input.commandKey,
    integrationKey: "linear",
    items: input.items.map((tier) => mapLinearCustomerTier(tier)),
    limit: input.limit,
    source: "linear",
    totalMatched: input.items.length,
  };
}

export function buildLinearCycleCollectionCommandResult(input: {
  commandKey: string;
  items: LinearCycleNode[];
  limit: number;
}) {
  return {
    commandKey: input.commandKey,
    integrationKey: "linear",
    items: input.items.map(mapLinearCycle),
    limit: input.limit,
    source: "linear",
    totalMatched: input.items.length,
  };
}

export function buildLinearCycleCommandResult(input: {
  commandKey: string;
  cycle: LinearCycleNode | null | undefined;
  lastSyncId?: number | null;
  success?: boolean | null;
}) {
  return {
    commandKey: input.commandKey,
    cycle: input.cycle ? mapLinearCycle(input.cycle) : null,
    integrationKey: "linear",
    lastSyncId: typeof input.lastSyncId === "number" ? input.lastSyncId : null,
    source: "linear",
    success: input.success ?? true,
  };
}

export function buildLinearCycleChildCollectionCommandResult<T>(input: {
  commandKey: string;
  cycle: LinearCycleNode;
  items: T[];
  limit: number;
}) {
  return {
    commandKey: input.commandKey,
    cycle: mapLinearCycle(input.cycle),
    integrationKey: "linear",
    items: input.items,
    limit: input.limit,
    source: "linear",
    totalMatched: input.items.length,
  };
}
