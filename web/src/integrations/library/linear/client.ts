const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";

const USER_FIELDS = `
  id
  name
  email
`;

const ISSUE_REFERENCE_FIELDS = `
  id
  identifier
  title
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
  createdAt
  updatedAt
`;

const DOCUMENT_FIELDS = `
  id
  title
  slugId
  url
  createdAt
  updatedAt
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
  lastAppliedAt
  parent {
    id
    name
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
  email?: string | null;
  id?: string | null;
  name?: string | null;
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
  createdAt?: string | null;
  id?: string | null;
  sourceType?: string | null;
  subtitle?: string | null;
  title?: string | null;
  updatedAt?: string | null;
  url?: string | null;
};

export type LinearDocumentNode = {
  createdAt?: string | null;
  id?: string | null;
  slugId?: string | null;
  title?: string | null;
  updatedAt?: string | null;
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
  description?: string | null;
  id?: string | null;
  isGroup?: boolean | null;
  lastAppliedAt?: string | null;
  name?: string | null;
  parent?: {
    id?: string | null;
    name?: string | null;
  } | null;
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

export function getLinearIssueFields() {
  return ISSUE_FIELDS;
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

export function mapLinearIssue(issue: LinearIssueNode) {
  return {
    assignee: issue.assignee?.name?.trim() || null,
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
    user: comment.user?.name?.trim() || null,
    userEmail: comment.user?.email?.trim() || null,
    userId: comment.user?.id?.trim() || null,
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

export function mapLinearAttachment(attachment: LinearAttachmentNode) {
  return {
    createdAt: attachment.createdAt ?? null,
    id: attachment.id?.trim() || null,
    sourceType: attachment.sourceType?.trim() || null,
    subtitle: attachment.subtitle?.trim() || null,
    title: attachment.title?.trim() || "Untitled attachment",
    updatedAt: attachment.updatedAt ?? null,
    url: attachment.url ?? null,
  };
}

export function mapLinearDocument(document: LinearDocumentNode) {
  return {
    createdAt: document.createdAt ?? null,
    id: document.id?.trim() || null,
    slugId: document.slugId?.trim() || null,
    title: document.title?.trim() || "Untitled document",
    updatedAt: document.updatedAt ?? null,
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
    description: label.description?.trim() || null,
    id: label.id?.trim() || null,
    isGroup: label.isGroup ?? false,
    lastAppliedAt: label.lastAppliedAt ?? null,
    name: label.name?.trim() || "Untitled label",
    parentId: label.parent?.id?.trim() || null,
    parentName: label.parent?.name?.trim() || null,
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
    lead: project.lead?.name?.trim() || null,
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
    user: update.user?.name?.trim() || null,
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
