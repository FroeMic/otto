import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  buildLinearCommentCollectionCommandResult,
  executeLinearGraphql,
  getLinearCommentFields,
  type LinearCommentNode,
  normalizeLimit,
  resolveLinearIssueId,
} from "../../client";

const LIST_COMMENTS_QUERY = `
  query OttoLinearCommentList($limit: Int!) {
    comments(first: $limit, orderBy: updatedAt) {
      nodes {
        ${getLinearCommentFields()}
      }
    }
  }
`;

const LIST_COMMENTS_FOR_ISSUE_QUERY = `
  query OttoLinearCommentListForIssue($issueId: ID!, $limit: Int!) {
    comments(
      first: $limit
      orderBy: updatedAt
      filter: { issue: { id: { eq: $issueId } } }
    ) {
      nodes {
        ${getLinearCommentFields()}
      }
    }
  }
`;

export const executeLinearCommentList: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const issueIdentifierOrId =
    typeof args.issueIdentifierOrId === "string"
      ? args.issueIdentifierOrId.trim()
      : "";
  const limit = normalizeLimit({
    defaultLimit: 25,
    max: 100,
    value: args.limit,
  });

  if (issueIdentifierOrId) {
    const issueId = await resolveLinearIssueId({
      accessToken: context.auth.accessToken,
      identifierOrId: issueIdentifierOrId,
    });
    const data = await executeLinearGraphql<{
      comments?: {
        nodes?: LinearCommentNode[] | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: LIST_COMMENTS_FOR_ISSUE_QUERY,
      variables: {
        issueId,
        limit,
      },
    });

    return {
      ...buildLinearCommentCollectionCommandResult({
        commandKey: "comment.list",
        items: data.comments?.nodes ?? [],
        limit,
      }),
      issueLookup: issueIdentifierOrId,
    };
  }

  const data = await executeLinearGraphql<{
    comments?: {
      nodes?: LinearCommentNode[] | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: LIST_COMMENTS_QUERY,
    variables: {
      limit,
    },
  });

  return buildLinearCommentCollectionCommandResult({
    commandKey: "comment.list",
    items: data.comments?.nodes ?? [],
    limit,
  });
};
