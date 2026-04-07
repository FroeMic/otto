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
  status?: number;

  constructor(
    message: string,
    options?: {
      code?: string;
      status?: number;
    },
  ) {
    super(message);
    this.name = "LinearGraphqlError";
    this.code = options?.code;
    this.status = options?.status;
  }
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

export async function executeLinearGraphql<T>(input: {
  accessToken: string;
  query: string;
  variables?: Record<string, unknown>;
}): Promise<T> {
  const response = await fetch(LINEAR_GRAPHQL_URL, {
    body: JSON.stringify({
      query: input.query,
      variables: input.variables ?? {},
    }),
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const payload = (await response.json()) as {
    data?: T | null;
    errors?: Array<{
      extensions?: {
        code?: string;
      } | null;
      message?: string;
    }>;
  };
  const firstError = payload.errors?.find((error) => Boolean(error.message));

  if (!response.ok || firstError || !payload.data) {
    throw new LinearGraphqlError(
      firstError?.message ?? "Linear request failed.",
      {
        code: firstError?.extensions?.code,
        status: response.status,
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
