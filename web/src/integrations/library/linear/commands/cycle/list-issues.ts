import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  buildLinearCycleChildCollectionCommandResult,
  executeLinearGraphql,
  getLinearCycleFields,
  getLinearIssueFields,
  type LinearCycleNode,
  type LinearIssueNode,
  mapLinearIssue,
  normalizeLimit,
} from "../../client";

const LIST_CYCLE_ISSUES_QUERY = `
  query OttoLinearCycleListIssues($id: String!, $limit: Int!) {
    cycle(id: $id) {
      ${getLinearCycleFields()}
      issues(first: $limit, orderBy: updatedAt) {
        nodes {
          ${getLinearIssueFields()}
        }
      }
    }
  }
`;

export const executeLinearCycleListIssues: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const cycleId = typeof args.cycleId === "string" ? args.cycleId.trim() : "";

  if (!cycleId) {
    throw new Error("linear cycle.list_issues requires cycleId.");
  }

  const limit = normalizeLimit({
    defaultLimit: 25,
    max: 100,
    value: args.limit,
  });
  const data = await executeLinearGraphql<{
    cycle?:
      | (LinearCycleNode & {
          issues?: {
            nodes?: LinearIssueNode[] | null;
          } | null;
        })
      | null;
  }>({
    accessToken: context.auth.accessToken,
    query: LIST_CYCLE_ISSUES_QUERY,
    variables: {
      id: cycleId,
      limit,
    },
  });

  if (!data.cycle) {
    throw new Error(`Linear could not find cycle ${cycleId}.`);
  }

  return {
    ...buildLinearCycleChildCollectionCommandResult({
      commandKey: "cycle.list_issues",
      cycle: data.cycle,
      items: (data.cycle.issues?.nodes ?? []).map(mapLinearIssue),
      limit,
    }),
    lookup: cycleId,
  };
};
