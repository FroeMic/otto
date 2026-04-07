import { normalizeOptionalString } from "../../client";

function normalizeOptionalPriority(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function buildLinearCustomerNeedCreateInput(
  argumentsObject: Record<string, unknown>,
) {
  return {
    attachmentId: normalizeOptionalString(argumentsObject.attachmentId),
    attachmentUrl: normalizeOptionalString(argumentsObject.attachmentUrl),
    body:
      typeof argumentsObject.body === "string"
        ? argumentsObject.body
        : null,
    commentId: normalizeOptionalString(argumentsObject.commentId),
    customerExternalId: normalizeOptionalString(
      argumentsObject.customerExternalId,
    ),
    customerId: normalizeOptionalString(argumentsObject.customerId),
    issueId: normalizeOptionalString(argumentsObject.issueId),
    priority: normalizeOptionalPriority(argumentsObject.priority),
    projectId: normalizeOptionalString(argumentsObject.projectId),
  };
}

export function buildLinearCustomerNeedCreateFromAttachmentInput(
  argumentsObject: Record<string, unknown>,
) {
  return {
    attachmentId:
      typeof argumentsObject.attachmentId === "string"
        ? argumentsObject.attachmentId.trim()
        : "",
  };
}

export function buildLinearCustomerNeedUpdateInput(
  argumentsObject: Record<string, unknown>,
) {
  return {
    applyPriorityToRelatedNeeds:
      typeof argumentsObject.applyPriorityToRelatedNeeds === "boolean"
        ? argumentsObject.applyPriorityToRelatedNeeds
        : null,
    attachmentUrl: normalizeOptionalString(argumentsObject.attachmentUrl),
    body:
      typeof argumentsObject.body === "string"
        ? argumentsObject.body
        : null,
    customerExternalId: normalizeOptionalString(
      argumentsObject.customerExternalId,
    ),
    customerId: normalizeOptionalString(argumentsObject.customerId),
    issueId: normalizeOptionalString(argumentsObject.issueId),
    priority: normalizeOptionalPriority(argumentsObject.priority),
    projectId: normalizeOptionalString(argumentsObject.projectId),
  };
}
