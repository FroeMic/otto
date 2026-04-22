import type { IntegrationCommandExecute } from "../../../../framework"

import {
  buildLinearAttachmentCommandResult,
  executeLinearGraphql,
  getLinearAttachmentFields,
  type LinearAttachmentNode,
} from "../../client"
import { buildLinearAttachmentCreateFromUploadedFileInput } from "./input"

const CREATE_ATTACHMENT_FROM_UPLOADED_FILE_MUTATION = `
  mutation OttoLinearAttachmentCreateFromUploadedFile($input: AttachmentCreateInput!) {
    attachmentCreate(input: $input) {
      attachment {
        ${getLinearAttachmentFields()}
      }
      lastSyncId
      success
    }
  }
`

export const executeLinearAttachmentCreateFromUploadedFile: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.")
    }

    const input = buildLinearAttachmentCreateFromUploadedFileInput(args)
    const data = await executeLinearGraphql<{
      attachmentCreate?: {
        attachment?: LinearAttachmentNode | null
        lastSyncId?: number | null
        success?: boolean | null
      } | null
    }>({
      accessToken: context.auth.accessToken,
      query: CREATE_ATTACHMENT_FROM_UPLOADED_FILE_MUTATION,
      variables: {
        input,
      },
    })

    return buildLinearAttachmentCommandResult({
      attachment: data.attachmentCreate?.attachment,
      commandKey: "attachment.create_from_uploaded_file",
      lastSyncId: data.attachmentCreate?.lastSyncId,
      success: data.attachmentCreate?.success,
    })
  }
