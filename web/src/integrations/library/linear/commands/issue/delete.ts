import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  buildLinearDeleteCommandResult,
  executeLinearGraphql,
  resolveLinearIssueId,
} from "../../client";

const DELETE_ISSUE_MUTATION = `
  mutation OttoLinearIssueDelete($id: String!) {
    issueDelete(id: $id) {
      entityId
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
      entityId?: string | null;
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
      entityId: data.issueDelete?.entityId,
      entityKey: "IssueId",
      lastSyncId: data.issueDelete?.lastSyncId,
      success: data.issueDelete?.success,
    }),
    lookup: identifierOrId,
  };
};
