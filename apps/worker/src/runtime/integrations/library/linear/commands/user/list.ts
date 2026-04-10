import type { IntegrationCommandExecute } from "../../../../framework";

import {
  buildLinearUserCollectionCommandResult,
  executeLinearGraphql,
  getLinearUserFields,
  type LinearUserNode,
  normalizeLimit,
} from "../../client";

const LIST_USERS_QUERY = `
  query OttoLinearUserList($limit: Int!) {
    users(first: $limit, orderBy: updatedAt) {
      nodes {
        ${getLinearUserFields()}
      }
    }
  }
`;

export const executeLinearUserList: IntegrationCommandExecute = async ({
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
    users?: {
      nodes?: LinearUserNode[] | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: LIST_USERS_QUERY,
    variables: {
      limit,
    },
  });

  return buildLinearUserCollectionCommandResult({
    commandKey: "user.list",
    items: data.users?.nodes ?? [],
    limit,
  });
};
