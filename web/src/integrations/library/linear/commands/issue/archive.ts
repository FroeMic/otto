import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  buildLinearIssueCommandResult,
  executeLinearGraphql,
  getLinearIssueFields,
  type LinearIssueNode,
  resolveLinearIssueId,
} from "../../client";

const ARCHIVE_ISSUE_MUTATION = `
  mutation OttoLinearIssueArchive($id: String!, $trash: Boolean) {
    issueArchive(id: $id, trash: $trash) {
      entity {
        ${getLinearIssueFields()}
      }
      lastSyncId
      success
    }
  }
`;

export const executeLinearIssueArchive: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const identifierOrId =
    typeof args.identifierOrId === "string" ? args.identifierOrId.trim() : "";
  const trash = typeof args.trash === "boolean" ? args.trash : false;

  if (!identifierOrId) {
    throw new Error("linear issue.archive requires identifierOrId.");
  }

  const id = await resolveLinearIssueId({
    accessToken: context.auth.accessToken,
    identifierOrId,
  });
  const data = await executeLinearGraphql<{
    issueArchive?: {
      entity?: LinearIssueNode | null;
      lastSyncId?: number | null;
      success?: boolean | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: ARCHIVE_ISSUE_MUTATION,
    variables: {
      id,
      trash,
    },
  });

  return {
    ...buildLinearIssueCommandResult({
      commandKey: "issue.archive",
      issue: data.issueArchive?.entity,
      lastSyncId: data.issueArchive?.lastSyncId,
      success: data.issueArchive?.success,
    }),
    lookup: identifierOrId,
    trash,
  };
};
