import type { IntegrationCommandExecute } from "../../../../framework"
import {
  decodeLinearFileContentBase64,
  normalizeOptionalBoolean,
  requestLinearUploadUrl,
  uploadLinearFileBytes,
} from "../../client"
import {
  type LinearInlineImageFallback,
  type LinearInlineImagePosition,
  updateLinearIssueDescriptionWithInlineImage,
} from "./inline-image"

function normalizeInlineImagePosition(
  value: unknown,
): LinearInlineImagePosition {
  return value === "after_text" ||
    value === "before_text" ||
    value === "prepend" ||
    value === "replace_text"
    ? value
    : "append"
}

function normalizeInlineImageFallback(
  value: unknown,
): LinearInlineImageFallback {
  return value === "append" || value === "prepend" ? value : "fail"
}

export const executeLinearIssueUploadInlineImage: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.")
    }

    const identifierOrId =
      typeof args.identifierOrId === "string" ? args.identifierOrId.trim() : ""
    const filename =
      typeof args.filename === "string" ? args.filename.trim() : ""
    const contentType =
      typeof args.contentType === "string" ? args.contentType.trim() : ""
    const altText = typeof args.altText === "string" ? args.altText.trim() : ""

    if (!identifierOrId || !filename || !contentType || !altText) {
      throw new Error(
        "issue.upload_inline_image requires identifierOrId, filename, contentType, and altText.",
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

    const result = (await updateLinearIssueDescriptionWithInlineImage({
      accessToken: context.auth.accessToken,
      altText,
      anchorText:
        typeof args.anchorText === "string" ? args.anchorText.trim() : null,
      assetUrl: upload.uploadFile.assetUrl,
      commandKey: "issue.upload_inline_image",
      fallbackPosition: normalizeInlineImageFallback(args.fallbackPosition),
      identifierOrId,
      position: normalizeInlineImagePosition(args.position),
    })) as Record<string, unknown>

    return {
      ...result,
      uploadFile: upload.uploadFile,
      uploadedAssetUrl: upload.uploadFile.assetUrl,
      uploadedBytes: bytes.byteLength,
    }
  }
