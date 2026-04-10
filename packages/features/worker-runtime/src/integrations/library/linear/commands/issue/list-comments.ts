import type { IntegrationCommandExecute } from "../../../../framework";

import {
  buildLinearIssueCollectionCommandResult,
  executeLinearGraphql,
  findLinearIssueByIdentifierOrId,
  getLinearCommentFields,
  getLinearIssueFields,
  type LinearCommentNode,
  type LinearIssueNode,
  mapLinearComment,
  normalizeLimit,
} from "../../client";

const LIST_ISSUE_COMMENTS_QUERY = `
  query OttoLinearIssueListComments($id: String!, $limit: Int!) {
    issue(id: $id) {
      ${getLinearIssueFields()}
      comments(first: $limit) {
        nodes {
          ${getLinearCommentFields()}
        }
      }
    }
  }
`;

export const executeLinearIssueListComments: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const identifierOrId =
      typeof args.identifierOrId === "string" ? args.identifierOrId.trim() : "";

    if (!identifierOrId) {
      throw new Error("linear issue.list_comments requires identifierOrId.");
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
            comments?: {
              nodes?: LinearCommentNode[] | null;
            } | null;
          })
        | null;
    }>({
      accessToken: context.auth.accessToken,
      query: LIST_ISSUE_COMMENTS_QUERY,
      variables: {
        id: issue.id,
        limit,
      },
    });

    if (!data.issue) {
      throw new Error(
        `Linear could not load comments for issue ${identifierOrId}.`,
      );
    }

    return {
      ...buildLinearIssueCollectionCommandResult({
        commandKey: "issue.list_comments",
        issue: data.issue,
        items: (data.issue.comments?.nodes ?? []).map(mapLinearComment),
        limit,
      }),
      lookup: identifierOrId,
    };
  };
