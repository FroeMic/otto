import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  buildLinearIssueCollectionCommandResult,
  executeLinearGraphql,
  findLinearIssueByIdentifierOrId,
  getLinearDocumentFields,
  getLinearIssueFields,
  type LinearDocumentNode,
  type LinearIssueNode,
  mapLinearDocument,
  normalizeLimit,
} from "../../client";

const LIST_ISSUE_DOCUMENTS_QUERY = `
  query OttoLinearIssueListDocuments($id: String!, $limit: Int!) {
    issue(id: $id) {
      ${getLinearIssueFields()}
      documents(first: $limit) {
        nodes {
          ${getLinearDocumentFields()}
        }
      }
    }
  }
`;

export const executeLinearIssueListDocuments: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const identifierOrId =
      typeof args.identifierOrId === "string" ? args.identifierOrId.trim() : "";

    if (!identifierOrId) {
      throw new Error("linear issue.list_documents requires identifierOrId.");
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
            documents?: {
              nodes?: LinearDocumentNode[] | null;
            } | null;
          })
        | null;
    }>({
      accessToken: context.auth.accessToken,
      query: LIST_ISSUE_DOCUMENTS_QUERY,
      variables: {
        id: issue.id,
        limit,
      },
    });

    if (!data.issue) {
      throw new Error(
        `Linear could not load documents for issue ${identifierOrId}.`,
      );
    }

    return {
      ...buildLinearIssueCollectionCommandResult({
        commandKey: "issue.list_documents",
        issue: data.issue,
        items: (data.issue.documents?.nodes ?? []).map(mapLinearDocument),
        limit,
      }),
      lookup: identifierOrId,
    };
  };
