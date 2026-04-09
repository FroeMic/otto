import type { IntegrationCommandExecute } from "../../../../framework";

import { executeLinearGraphql } from "../../client";

const DELETE_COMMENT_MUTATION = `
  mutation OttoLinearCommentDelete($id: String!) {
    commentDelete(id: $id) {
      entityId
      lastSyncId
      success
    }
  }
`;

export const executeLinearCommentDelete: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const commentId =
    typeof args.commentId === "string" ? args.commentId.trim() : "";

  if (!commentId) {
    throw new Error("linear comment.delete requires commentId.");
  }

  const data = await executeLinearGraphql<{
    commentDelete?: {
      entityId?: string | null;
      lastSyncId?: number | null;
      success?: boolean | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: DELETE_COMMENT_MUTATION,
    variables: {
      id: commentId,
    },
  });

  return {
    commandKey: "comment.delete",
    deletedCommentId: data.commentDelete?.entityId?.trim() || commentId,
    integrationKey: "linear",
    lastSyncId:
      typeof data.commentDelete?.lastSyncId === "number"
        ? data.commentDelete.lastSyncId
        : null,
    source: "linear",
    success: data.commentDelete?.success ?? true,
  };
};
