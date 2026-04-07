import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  buildLinearCommentCommandResult,
  executeLinearGraphql,
  getLinearCommentFields,
  type LinearCommentNode,
} from "../../client";
import { buildLinearCommentCreateInput } from "./input";

const CREATE_COMMENT_MUTATION = `
  mutation OttoLinearCommentCreate($input: CommentCreateInput!) {
    commentCreate(input: $input) {
      comment {
        ${getLinearCommentFields()}
      }
      lastSyncId
      success
    }
  }
`;

export const executeLinearCommentCreate: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const input = buildLinearCommentCreateInput(args);
  const data = await executeLinearGraphql<{
    commentCreate?: {
      comment?: LinearCommentNode | null;
      lastSyncId?: number | null;
      success?: boolean | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: CREATE_COMMENT_MUTATION,
    variables: {
      input,
    },
  });

  return buildLinearCommentCommandResult({
    commandKey: "comment.create",
    comment: data.commentCreate?.comment,
    lastSyncId: data.commentCreate?.lastSyncId,
    success: data.commentCreate?.success,
  });
};
