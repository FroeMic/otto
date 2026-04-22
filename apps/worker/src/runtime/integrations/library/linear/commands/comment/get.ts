import type { IntegrationCommandExecute } from "../../../../framework"

import {
  buildLinearCommentCommandResult,
  executeLinearGraphql,
  getLinearCommentFields,
  type LinearCommentNode,
} from "../../client"

const GET_COMMENT_QUERY = `
  query OttoLinearCommentGet($id: String!) {
    comment(id: $id) {
      ${getLinearCommentFields()}
    }
  }
`

export const executeLinearCommentGet: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.")
  }

  const commentId =
    typeof args.commentId === "string" ? args.commentId.trim() : ""

  if (!commentId) {
    throw new Error("linear comment.get requires commentId.")
  }

  const data = await executeLinearGraphql<{
    comment?: LinearCommentNode | null
  }>({
    accessToken: context.auth.accessToken,
    query: GET_COMMENT_QUERY,
    variables: {
      id: commentId,
    },
  })

  return {
    ...buildLinearCommentCommandResult({
      commandKey: "comment.get",
      comment: data.comment,
    }),
    lookup: commentId,
  }
}
