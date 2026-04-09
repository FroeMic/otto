import type { IntegrationCommandExecute } from "../../../../framework";

import {
  buildLinearDeleteCommandResult,
  executeLinearGraphql,
  resolveLinearIssueId,
} from "../../client";

const DELETE_ISSUE_MUTATION = `
  mutation OttoLinearIssueDelete($id: String!) {
    issueDelete(id: $id) {
      entity {
        id
      }
      lastSyncId
      success
    }
  }
`;

export const executeLinearIssueDelete: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const identifierOrId =
    typeof args.identifierOrId === "string" ? args.identifierOrId.trim() : "";

  if (!identifierOrId) {
    throw new Error("linear issue.delete requires identifierOrId.");
  }

  const id = await resolveLinearIssueId({
    accessToken: context.auth.accessToken,
    identifierOrId,
  });
  const data = await executeLinearGraphql<{
    issueDelete?: {
      entity?: {
        id?: string | null;
      } | null;
      lastSyncId?: number | null;
      success?: boolean | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: DELETE_ISSUE_MUTATION,
    variables: {
      id,
    },
  });

  return {
    ...buildLinearDeleteCommandResult({
      commandKey: "issue.delete",
      entityId: data.issueDelete?.entity?.id,
      entityKey: "IssueId",
      lastSyncId: data.issueDelete?.lastSyncId,
      success: data.issueDelete?.success,
    }),
    lookup: identifierOrId,
  };
};
