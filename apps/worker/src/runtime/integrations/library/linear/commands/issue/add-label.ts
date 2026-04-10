import type { IntegrationCommandExecute } from "../../../../framework";

import {
  buildLinearIssueCommandResult,
  executeLinearGraphql,
  getLinearIssueFields,
  type LinearIssueNode,
  resolveLinearIssueId,
} from "../../client";

const ISSUE_ADD_LABEL_MUTATION = `
  mutation OttoLinearIssueAddLabel($id: String!, $labelId: String!) {
    issueAddLabel(id: $id, labelId: $labelId) {
      issue {
        ${getLinearIssueFields()}
      }
      lastSyncId
      success
    }
  }
`;

export const executeLinearIssueAddLabel: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const identifierOrId =
    typeof args.identifierOrId === "string" ? args.identifierOrId.trim() : "";
  const labelId = typeof args.labelId === "string" ? args.labelId.trim() : "";

  if (!identifierOrId || !labelId) {
    throw new Error(
      "linear issue.add_label requires identifierOrId and labelId.",
    );
  }

  const id = await resolveLinearIssueId({
    accessToken: context.auth.accessToken,
    identifierOrId,
  });
  const data = await executeLinearGraphql<{
    issueAddLabel?: {
      issue?: LinearIssueNode | null;
      lastSyncId?: number | null;
      success?: boolean | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: ISSUE_ADD_LABEL_MUTATION,
    variables: {
      id,
      labelId,
    },
  });

  return {
    ...buildLinearIssueCommandResult({
      commandKey: "issue.add_label",
      issue: data.issueAddLabel?.issue,
      lastSyncId: data.issueAddLabel?.lastSyncId,
      success: data.issueAddLabel?.success,
    }),
    labelId,
    lookup: identifierOrId,
  };
};
