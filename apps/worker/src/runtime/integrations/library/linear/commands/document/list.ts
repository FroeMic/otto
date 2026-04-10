import type { IntegrationCommandExecute } from "../../../../framework";

import {
  buildLinearDocumentCollectionCommandResult,
  executeLinearGraphql,
  getLinearDocumentFields,
  type LinearDocumentNode,
  normalizeLimit,
} from "../../client";

const LIST_DOCUMENTS_QUERY = `
  query OttoLinearDocumentList($limit: Int!) {
    documents(first: $limit, orderBy: updatedAt) {
      nodes {
        ${getLinearDocumentFields()}
      }
    }
  }
`;

export const executeLinearDocumentList: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const limit = normalizeLimit({
    defaultLimit: 25,
    max: 100,
    value: args.limit,
  });
  const data = await executeLinearGraphql<{
    documents?: {
      nodes?: LinearDocumentNode[] | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: LIST_DOCUMENTS_QUERY,
    variables: {
      limit,
    },
  });

  return buildLinearDocumentCollectionCommandResult({
    commandKey: "document.list",
    items: data.documents?.nodes ?? [],
    limit,
  });
};
