import type { IntegrationCommandExecute } from "../../../../framework"

import {
  buildLinearAttachmentCommandResult,
  executeLinearGraphql,
  getLinearAttachmentFields,
  type LinearAttachmentNode,
} from "../../client"

const GET_ATTACHMENT_QUERY = `
  query OttoLinearAttachmentGet($id: String!) {
    attachment(id: $id) {
      ${getLinearAttachmentFields()}
    }
  }
`

export const executeLinearAttachmentGet: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.")
  }

  const attachmentId =
    typeof args.attachmentId === "string" ? args.attachmentId.trim() : ""

  if (!attachmentId) {
    throw new Error("linear attachment.get requires attachmentId.")
  }

  const data = await executeLinearGraphql<{
    attachment?: LinearAttachmentNode | null
  }>({
    accessToken: context.auth.accessToken,
    query: GET_ATTACHMENT_QUERY,
    variables: {
      id: attachmentId,
    },
  })

  return {
    ...buildLinearAttachmentCommandResult({
      attachment: data.attachment,
      commandKey: "attachment.get",
    }),
    lookup: attachmentId,
  }
}
