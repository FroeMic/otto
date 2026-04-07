import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  buildLinearIssueBatchCommandResult,
  executeLinearGraphql,
  getLinearIssueFields,
  type LinearIssueNode,
  resolveLinearIssueIds,
} from "../../client";
import {
  buildLinearIssueUpdateInput,
  normalizeIssueIdentifierList,
} from "./input";

const ISSUE_BATCH_UPDATE_MUTATION = `
  mutation OttoLinearIssueBatchUpdate($ids: [UUID!]!, $input: IssueUpdateInput!) {
    issueBatchUpdate(ids: $ids, input: $input) {
      issues {
        ${getLinearIssueFields()}
      }
      lastSyncId
      success
    }
  }
`;

export const executeLinearIssueBatchUpdate: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const identifiersOrIds = normalizeIssueIdentifierList(args.identifiersOrIds);

  if (identifiersOrIds.length === 0) {
    throw new Error("linear issue.batch_update requires identifiersOrIds.");
  }

  const [ids, input] = await Promise.all([
    resolveLinearIssueIds({
      accessToken: context.auth.accessToken,
      identifiersOrIds,
    }),
    Promise.resolve(buildLinearIssueUpdateInput(args)),
  ]);
  const data = await executeLinearGraphql<{
    issueBatchUpdate?: {
      issues?: LinearIssueNode[] | null;
      lastSyncId?: number | null;
      success?: boolean | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: ISSUE_BATCH_UPDATE_MUTATION,
    variables: {
      ids,
      input,
    },
  });

  return {
    ...buildLinearIssueBatchCommandResult({
      commandKey: "issue.batch_update",
      issues: data.issueBatchUpdate?.issues ?? [],
      lastSyncId: data.issueBatchUpdate?.lastSyncId,
      success: data.issueBatchUpdate?.success,
    }),
    lookups: identifiersOrIds,
  };
};
