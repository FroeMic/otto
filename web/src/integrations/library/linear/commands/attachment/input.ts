import {
  normalizeOptionalBoolean,
  normalizeOptionalString,
  pruneGraphqlInput,
} from "../../client";

function normalizeOptionalObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function buildLinearAttachmentCreateInput(
  argumentsObject: Record<string, unknown>,
) {
  const input = pruneGraphqlInput({
    commentBody: normalizeOptionalString(argumentsObject.commentBody),
    createAsUser: normalizeOptionalString(argumentsObject.createAsUser),
    groupBySource: normalizeOptionalBoolean(argumentsObject.groupBySource),
    iconUrl: normalizeOptionalString(argumentsObject.iconUrl),
    id: normalizeOptionalString(argumentsObject.id),
    issueId: normalizeOptionalString(argumentsObject.issueId),
    metadata: normalizeOptionalObject(argumentsObject.metadata),
    subtitle: normalizeOptionalString(argumentsObject.subtitle),
    title: normalizeOptionalString(argumentsObject.title),
    url: normalizeOptionalString(argumentsObject.url),
  });

  if (!input.issueId || !input.title || !input.url) {
    throw new Error("attachment.create requires issueId, title, and url.");
  }

  return input;
}

export function buildLinearAttachmentCreateFromUploadedFileInput(
  argumentsObject: Record<string, unknown>,
) {
  const input = buildLinearAttachmentCreateInput({
    ...argumentsObject,
    url:
      typeof argumentsObject.assetUrl === "string"
        ? argumentsObject.assetUrl
        : argumentsObject.url,
  });

  return input;
}
