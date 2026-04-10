import type { IntegrationCommandExecute } from "../../../../framework";

import {
  executeLinearGraphql,
  getLinearIssueFields,
  type LinearIssueNode,
  mapLinearIssue,
  normalizeLimit,
} from "../../client";

const LIST_ISSUES_QUERY = `
  query OttoLinearIssueList($limit: Int!) {
    issues(first: $limit, orderBy: updatedAt) {
      nodes {
        ${getLinearIssueFields()}
      }
    }
  }
`;

export const executeLinearIssueList: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const limit = normalizeLimit({
    defaultLimit: 10,
    max: 50,
    value: args.limit,
  });
  const data = await executeLinearGraphql<{
    issues?: {
      nodes?: LinearIssueNode[] | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: LIST_ISSUES_QUERY,
    variables: {
      limit,
    },
  });

  return {
    commandKey: "issue.list",
    integrationKey: "linear",
    items: (data.issues?.nodes ?? []).map(mapLinearIssue),
    limit,
    source: "linear",
  };
};
