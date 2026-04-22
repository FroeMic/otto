import type { IntegrationCommandExecute } from "../../../../framework"

import {
  executeLinearGraphql,
  getLinearIssueFields,
  type LinearIssueNode,
  mapLinearIssue,
  normalizeLimit,
} from "../../client"

const SEARCH_ISSUES_QUERY = `
  query OttoLinearIssueSearch($limit: Int!, $term: String!) {
    searchIssues(term: $term, first: $limit) {
      totalCount
      nodes {
        ${getLinearIssueFields()}
      }
    }
  }
`

export const executeLinearIssueSearch: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.")
  }

  return searchLinearIssues({
    accessToken: context.auth.accessToken,
    limit: args.limit,
    query: args.query,
  })
}

export async function searchLinearIssues(input: {
  accessToken: string
  limit?: unknown
  query?: unknown
}) {
  const query = typeof input.query === "string" ? input.query.trim() : ""

  if (!query) {
    throw new Error("linear issue.search requires a non-empty query.")
  }

  const limit = normalizeLimit({
    defaultLimit: 10,
    max: 25,
    value: input.limit,
  })
  const data = await executeLinearGraphql<{
    searchIssues?: {
      nodes?: LinearIssueNode[] | null
      totalCount?: number | null
    } | null
  }>({
    accessToken: input.accessToken,
    query: SEARCH_ISSUES_QUERY,
    variables: {
      limit,
      term: query,
    },
  })
  const items = (data.searchIssues?.nodes ?? []).map(mapLinearIssue)

  return {
    commandKey: "issue.search",
    integrationKey: "linear",
    items,
    limit,
    query,
    source: "linear",
    totalMatched:
      typeof data.searchIssues?.totalCount === "number"
        ? data.searchIssues.totalCount
        : items.length,
  }
}
