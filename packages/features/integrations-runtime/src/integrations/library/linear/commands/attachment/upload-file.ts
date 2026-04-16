import type { IntegrationCommandExecute } from "../../../../framework"

import {
  decodeLinearFileContentBase64,
  normalizeOptionalBoolean,
  requestLinearUploadUrl,
  uploadLinearFileBytes,
} from "../../client"
import { executeLinearAttachmentCreateFromUploadedFile } from "./create-from-uploaded-file"

export const executeLinearAttachmentUploadFile: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.")
    }

    const filename =
      typeof args.filename === "string" ? args.filename.trim() : ""
    const contentType =
      typeof args.contentType === "string" ? args.contentType.trim() : ""

    if (!filename || !contentType) {
      throw new Error(
        "attachment.upload_file requires filename and contentType.",
      )
    }

    const bytes = decodeLinearFileContentBase64({
      contentBase64:
        typeof args.contentBase64 === "string" ? args.contentBase64 : "",
      filename,
    })

    const upload = await requestLinearUploadUrl({
      accessToken: context.auth.accessToken,
      contentType,
      filename,
      makePublic: normalizeOptionalBoolean(args.makePublic),
      metaData:
        args.metaData &&
        typeof args.metaData === "object" &&
        !Array.isArray(args.metaData)
          ? (args.metaData as Record<string, unknown>)
          : null,
      size: bytes.byteLength,
    })

    if (!upload.uploadFile?.assetUrl) {
      throw new Error("Linear did not return an assetUrl for the upload.")
    }

    await uploadLinearFileBytes({
      bytes,
      contentType,
      uploadFile: upload.uploadFile,
    })

    const attachmentResult =
      (await executeLinearAttachmentCreateFromUploadedFile({
        arguments: {
          assetUrl: upload.uploadFile.assetUrl,
          commentBody: args.commentBody,
          createAsUser: args.createAsUser,
          groupBySource: args.groupBySource,
          iconUrl: args.iconUrl,
          id: args.id,
          issueId:
            typeof args.issueIdentifierOrId === "string" &&
            args.issueIdentifierOrId.trim()
              ? args.issueIdentifierOrId
              : args.issueId,
          metadata: args.metadata,
          subtitle: args.subtitle,
          title: args.title,
        },
        context,
      })) as Record<string, unknown>

    return {
      ...attachmentResult,
      commandKey: "attachment.upload_file",
      uploadFile: upload.uploadFile,
      uploadedBytes: bytes.byteLength,
    }
  }
