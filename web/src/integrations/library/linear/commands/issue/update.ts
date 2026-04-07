import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  buildLinearIssueCommandResult,
  executeLinearGraphql,
  getLinearIssueFields,
  type LinearIssueNode,
  resolveLinearIssueId,
} from "../../client";
import { buildLinearIssueUpdateInput } from "./input";

const UPDATE_ISSUE_MUTATION = `
  mutation OttoLinearIssueUpdate($id: String!, $input: IssueUpdateInput!) {
    issueUpdate(id: $id, input: $input) {
      issue {
        ${getLinearIssueFields()}
      }
      lastSyncId
      success
    }
  }
`;

export const executeLinearIssueUpdate: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const identifierOrId =
    typeof args.identifierOrId === "string" ? args.identifierOrId.trim() : "";

  if (!identifierOrId) {
    throw new Error("linear issue.update requires identifierOrId.");
  }

  const [id, input] = await Promise.all([
    resolveLinearIssueId({
      accessToken: context.auth.accessToken,
      identifierOrId,
    }),
    Promise.resolve(buildLinearIssueUpdateInput(args)),
  ]);

  const data = await executeLinearGraphql<{
    issueUpdate?: {
      issue?: LinearIssueNode | null;
      lastSyncId?: number | null;
      success?: boolean | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: UPDATE_ISSUE_MUTATION,
    variables: {
      id,
      input,
    },
  });

  return {
    ...buildLinearIssueCommandResult({
      commandKey: "issue.update",
      issue: data.issueUpdate?.issue,
      lastSyncId: data.issueUpdate?.lastSyncId,
      success: data.issueUpdate?.success,
    }),
    lookup: identifierOrId,
  };
};
