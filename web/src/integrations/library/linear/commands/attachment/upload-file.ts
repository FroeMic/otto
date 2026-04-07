import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  executeLinearGraphql,
  normalizeOptionalBoolean,
  normalizeOptionalInteger,
} from "../../client";

const UPLOAD_FILE_MUTATION = `
  mutation OttoLinearAttachmentUploadFile(
    $contentType: String!
    $filename: String!
    $makePublic: Boolean
    $metaData: JSON
    $size: Int!
  ) {
    fileUpload(
      contentType: $contentType
      filename: $filename
      makePublic: $makePublic
      metaData: $metaData
      size: $size
    ) {
      lastSyncId
      success
      uploadFile {
        assetUrl
        contentType
        filename
        headers {
          key
          value
        }
        metaData
        size
        uploadUrl
      }
    }
  }
`;

export const executeLinearAttachmentUploadFile: IntegrationCommandExecute =
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
        "attachment.upload_file requires filename, contentType, and size.",
      );
    }

    const data = await executeLinearGraphql<{
      fileUpload?: {
        lastSyncId?: number | null;
        success?: boolean | null;
        uploadFile?: {
          assetUrl?: string | null;
          contentType?: string | null;
          filename?: string | null;
          headers?: Array<{
            key?: string | null;
            value?: string | null;
          }> | null;
          metaData?: Record<string, unknown> | null;
          size?: number | null;
          uploadUrl?: string | null;
        } | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: UPLOAD_FILE_MUTATION,
      variables: {
        contentType,
        filename,
        makePublic: normalizeOptionalBoolean(args.makePublic),
        metaData:
          args.metaData &&
          typeof args.metaData === "object" &&
          !Array.isArray(args.metaData)
            ? args.metaData
            : null,
        size,
      },
    });

    return {
      commandKey: "attachment.upload_file",
      integrationKey: "linear",
      lastSyncId:
        typeof data.fileUpload?.lastSyncId === "number"
          ? data.fileUpload.lastSyncId
          : null,
      source: "linear",
      success: data.fileUpload?.success ?? true,
      uploadFile: data.fileUpload?.uploadFile
        ? {
            assetUrl: data.fileUpload.uploadFile.assetUrl ?? null,
            contentType: data.fileUpload.uploadFile.contentType?.trim() || null,
            filename: data.fileUpload.uploadFile.filename?.trim() || null,
            headers: (data.fileUpload.uploadFile.headers ?? []).map(
              (header) => ({
                key: header.key?.trim() || "",
                value: header.value?.trim() || "",
              }),
            ),
            metadata: data.fileUpload.uploadFile.metaData ?? null,
            size:
              typeof data.fileUpload.uploadFile.size === "number"
                ? data.fileUpload.uploadFile.size
                : null,
            uploadUrl: data.fileUpload.uploadFile.uploadUrl ?? null,
          }
        : null,
    };
  };
