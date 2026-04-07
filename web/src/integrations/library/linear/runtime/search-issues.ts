type LinearIssueNode = {
  assignee?: {
    name?: string | null;
  } | null;
  identifier?: string | null;
  priority?: number | null;
  project?: {
    name?: string | null;
  } | null;
  state?: {
    name?: string | null;
    type?: string | null;
  } | null;
  team?: {
    key?: string | null;
    name?: string | null;
  } | null;
  title?: string | null;
  updatedAt?: string | null;
  url?: string | null;
};

type LinearSearchIssuesPayload = {
  data?: {
    searchIssues?: {
      nodes?: LinearIssueNode[] | null;
      totalCount?: number | null;
    } | null;
  } | null;
  errors?: Array<{
    extensions?: {
      code?: string;
    } | null;
    message?: string;
  }>;
};

type SearchLinearIssuesInput = {
  accessToken: string;
  limit?: number;
  query: string;
};

const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";

const SEARCH_LINEAR_ISSUES_QUERY = `
  query OttoSearchLinearIssues($limit: Int!, $term: String!) {
    searchIssues(term: $term, first: $limit) {
      totalCount
      nodes {
        identifier
        title
        priority
        url
        updatedAt
        project {
          name
        }
        state {
          name
          type
        }
        team {
          key
          name
        }
        assignee {
          name
        }
      }
    }
  }
`;

class LinearGraphqlError extends Error {
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

export async function searchLinearIssues(input: SearchLinearIssuesInput) {
  const query = input.query.trim();

  if (!query) {
    throw new Error("linear search_issues requires a non-empty query.");
  }

  const limit =
    typeof input.limit === "number" &&
    Number.isInteger(input.limit) &&
    input.limit >= 1 &&
    input.limit <= 25
      ? input.limit
      : 10;

  const response = await fetch(LINEAR_GRAPHQL_URL, {
    body: JSON.stringify({
      query: SEARCH_LINEAR_ISSUES_QUERY,
      variables: {
        limit,
        term: query,
      },
    }),
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const payload = (await response.json()) as LinearSearchIssuesPayload;
  const firstError = payload.errors?.find((error) => Boolean(error.message));

  if (!response.ok || firstError) {
    throw new LinearGraphqlError(
      firstError?.message ?? "Linear issue search failed.",
      {
        code: firstError?.extensions?.code,
        status: response.status,
      },
    );
  }

  const items = (payload.data?.searchIssues?.nodes ?? []).map((issue) => ({
    assignee: issue.assignee?.name?.trim() || null,
    id: issue.identifier?.trim() || "Unknown",
    priority:
      typeof issue.priority === "number" && Number.isFinite(issue.priority)
        ? issue.priority
        : 0,
    project: issue.project?.name?.trim() || null,
    state: issue.state?.name?.trim() || issue.state?.type?.trim() || null,
    team: issue.team?.key?.trim() || issue.team?.name?.trim() || null,
    title: issue.title?.trim() || "Untitled issue",
    updatedAt: issue.updatedAt ?? null,
    url: issue.url ?? null,
  }));

  return {
    integrationKey: "linear",
    items,
    limit,
    operation: "search_issues",
    query,
    source: "linear",
    totalMatched:
      typeof payload.data?.searchIssues?.totalCount === "number"
        ? payload.data.searchIssues.totalCount
        : items.length,
  };
}
