import type { IntegrationCommandExecute } from "../../../../framework";

import {
  buildLinearCycleCollectionCommandResult,
  executeLinearGraphql,
  getLinearCycleFields,
  type LinearCycleNode,
  normalizeLimit,
} from "../../client";

const LIST_CYCLES_QUERY = `
  query OttoLinearCycleList($limit: Int!) {
    cycles(first: $limit, orderBy: updatedAt) {
      nodes {
        ${getLinearCycleFields()}
      }
    }
  }
`;

export const executeLinearCycleList: IntegrationCommandExecute = async ({
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
    cycles?: {
      nodes?: LinearCycleNode[] | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: LIST_CYCLES_QUERY,
    variables: {
      limit,
    },
  });

  return buildLinearCycleCollectionCommandResult({
    commandKey: "cycle.list",
    items: data.cycles?.nodes ?? [],
    limit,
  });
};
