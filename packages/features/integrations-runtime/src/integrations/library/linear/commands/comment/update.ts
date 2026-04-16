import type { IntegrationCommandExecute } from "../../../../framework"

import {
  buildLinearCommentCommandResult,
  executeLinearGraphql,
  getLinearCommentFields,
  type LinearCommentNode,
} from "../../client"
import { buildLinearCommentUpdateInput } from "./input"

const UPDATE_COMMENT_MUTATION = `
  mutation OttoLinearCommentUpdate($id: String!, $input: CommentUpdateInput!) {
    commentUpdate(id: $id, input: $input) {
      comment {
        ${getLinearCommentFields()}
      }
      lastSyncId
      success
    }
  }
`

export const executeLinearCommentUpdate: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.")
  }

  const commentId =
    typeof args.commentId === "string" ? args.commentId.trim() : ""

  if (!commentId) {
    throw new Error("linear comment.update requires commentId.")
  }

  const input = buildLinearCommentUpdateInput(args)
  const data = await executeLinearGraphql<{
    commentUpdate?: {
      comment?: LinearCommentNode | null
      lastSyncId?: number | null
      success?: boolean | null
    } | null
  }>({
    accessToken: context.auth.accessToken,
    query: UPDATE_COMMENT_MUTATION,
    variables: {
      id: commentId,
      input,
    },
  })

  return {
    ...buildLinearCommentCommandResult({
      commandKey: "comment.update",
      comment: data.commentUpdate?.comment,
      lastSyncId: data.commentUpdate?.lastSyncId,
      success: data.commentUpdate?.success,
    }),
    lookup: commentId,
  }
}
