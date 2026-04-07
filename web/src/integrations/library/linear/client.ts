const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";

const ISSUE_FIELDS = `
  id
  identifier
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
    id
    name
    email
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

export type LinearIssueNode = {
  assignee?: {
    email?: string | null;
    id?: string | null;
    name?: string | null;
  } | null;
  createdAt?: string | null;
  description?: string | null;
  id?: string | null;
  identifier?: string | null;
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

export function mapLinearIssue(issue: LinearIssueNode) {
  return {
    assignee: issue.assignee?.name?.trim() || null,
    assigneeEmail: issue.assignee?.email?.trim() || null,
    createdAt: issue.createdAt ?? null,
    description: issue.description?.trim() || null,
    id: issue.id?.trim() || null,
    identifier: issue.identifier?.trim() || null,
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
