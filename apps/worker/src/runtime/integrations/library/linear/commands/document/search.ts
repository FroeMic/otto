import type { IntegrationCommandExecute } from "../../../../framework";

import {
  buildLinearDocumentCollectionCommandResult,
  executeLinearGraphql,
  getLinearDocumentFields,
  type LinearDocumentNode,
  normalizeLimit,
} from "../../client";

const SEARCH_DOCUMENTS_QUERY = `
  query OttoLinearDocumentSearch($limit: Int!, $term: String!) {
    searchDocuments(first: $limit, term: $term) {
      nodes {
        ${getLinearDocumentFields()}
      }
    }
  }
`;

export const executeLinearDocumentSearch: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const query = typeof args.query === "string" ? args.query.trim() : "";

  if (!query) {
    throw new Error("linear document.search requires query.");
  }

  const limit = normalizeLimit({
    defaultLimit: 10,
    max: 25,
    value: args.limit,
  });
  const data = await executeLinearGraphql<{
    searchDocuments?: {
      nodes?: LinearDocumentNode[] | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: SEARCH_DOCUMENTS_QUERY,
    variables: {
      limit,
      term: query,
    },
  });

  return {
    ...buildLinearDocumentCollectionCommandResult({
      commandKey: "document.search",
      items: data.searchDocuments?.nodes ?? [],
      limit,
    }),
    query,
  };
};
