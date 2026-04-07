import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  buildLinearIssueCollectionCommandResult,
  executeLinearGraphql,
  findLinearIssueByIdentifierOrId,
  getLinearAttachmentFields,
  getLinearIssueFields,
  type LinearAttachmentNode,
  type LinearIssueNode,
  mapLinearAttachment,
  normalizeLimit,
} from "../../client";

const LIST_ISSUE_ATTACHMENTS_QUERY = `
  query OttoLinearIssueListAttachments($id: String!, $limit: Int!) {
    issue(id: $id) {
      ${getLinearIssueFields()}
      attachments(first: $limit) {
        nodes {
          ${getLinearAttachmentFields()}
        }
      }
    }
  }
`;

export const executeLinearIssueListAttachments: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const identifierOrId =
      typeof args.identifierOrId === "string" ? args.identifierOrId.trim() : "";

    if (!identifierOrId) {
      throw new Error("linear issue.list_attachments requires identifierOrId.");
    }

    const limit = normalizeLimit({
      defaultLimit: 25,
      max: 100,
      value: args.limit,
    });
    const issue = await findLinearIssueByIdentifierOrId({
      accessToken: context.auth.accessToken,
      identifierOrId,
    });

    if (!issue?.id) {
      throw new Error(`Linear could not find issue ${identifierOrId}.`);
    }

    const data = await executeLinearGraphql<{
      issue?:
        | (LinearIssueNode & {
            attachments?: {
              nodes?: LinearAttachmentNode[] | null;
            } | null;
          })
        | null;
    }>({
      accessToken: context.auth.accessToken,
      query: LIST_ISSUE_ATTACHMENTS_QUERY,
      variables: {
        id: issue.id,
        limit,
      },
    });

    if (!data.issue) {
      throw new Error(
        `Linear could not load attachments for issue ${identifierOrId}.`,
      );
    }

    return {
      ...buildLinearIssueCollectionCommandResult({
        commandKey: "issue.list_attachments",
        issue: data.issue,
        items: (data.issue.attachments?.nodes ?? []).map(mapLinearAttachment),
        limit,
      }),
      lookup: identifierOrId,
    };
  };
