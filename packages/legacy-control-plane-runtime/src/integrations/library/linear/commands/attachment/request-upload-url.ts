import type { IntegrationCommandExecute } from "../../../../framework";

import {
  normalizeOptionalBoolean,
  normalizeOptionalInteger,
  requestLinearUploadUrl,
} from "../../client";

export const executeLinearAttachmentRequestUploadUrl: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const filename =
      typeof args.filename === "string" ? args.filename.trim() : "";
    const contentType =
      typeof args.contentType === "string" ? args.contentType.trim() : "";
    const size = normalizeOptionalInteger(args.size);

    if (!filename || !contentType || size === null) {
      throw new Error(
        "attachment.request_upload_url requires filename, contentType, and size.",
      );
    }

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
      size,
    });

    return {
      commandKey: "attachment.request_upload_url",
      integrationKey: "linear",
      lastSyncId: upload.lastSyncId,
      nextStep: upload.uploadFile
        ? {
            contentType: upload.uploadFile.contentType,
            followupCommands: [
              {
                argumentsTemplate: {
                  assetUrl: upload.uploadFile.assetUrl,
                  issueId: "<issue-id-or-identifier>",
                  title: "<attachment-title>",
                },
                commandKey: "attachment.create_from_uploaded_file",
              },
              {
                commandKey: "issue.insert_inline_image",
                argumentsTemplate: {
                  altText: "<inline-image-alt-text>",
                  assetUrl: upload.uploadFile.assetUrl,
                  identifierOrId: "<issue-id-or-identifier>",
                  position: "append",
                },
              },
            ],
            kind: "signed_upload_put",
            requiredHeaders: upload.uploadFile.headers,
            uploadUrl: upload.uploadFile.uploadUrl,
          }
        : null,
      source: "linear",
      success: upload.success,
      uploadFile: upload.uploadFile,
    };
  };
