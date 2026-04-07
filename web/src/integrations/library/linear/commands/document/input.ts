import {
  normalizeOptionalInteger,
  normalizeOptionalString,
  normalizeOptionalStringArray,
} from "../../client";

export function buildLinearDocumentCreateInput(argumentsObject: Record<string, unknown>) {
  return {
    color: normalizeOptionalString(argumentsObject.color),
    content: normalizeOptionalString(argumentsObject.content),
    cycleId: normalizeOptionalString(argumentsObject.cycleId),
    icon: normalizeOptionalString(argumentsObject.icon),
    initiativeId: normalizeOptionalString(argumentsObject.initiativeId),
    issueId: normalizeOptionalString(argumentsObject.issueId),
    lastAppliedTemplateId: normalizeOptionalString(
      argumentsObject.lastAppliedTemplateId,
    ),
    projectId: normalizeOptionalString(argumentsObject.projectId),
    resourceFolderId: normalizeOptionalString(argumentsObject.resourceFolderId),
    sortOrder: normalizeOptionalInteger(argumentsObject.sortOrder),
    subscriberIds: normalizeOptionalStringArray(argumentsObject.subscriberIds),
    teamId: normalizeOptionalString(argumentsObject.teamId),
    title:
      typeof argumentsObject.title === "string"
        ? argumentsObject.title.trim()
        : "",
  };
}

export function buildLinearDocumentUpdateInput(argumentsObject: Record<string, unknown>) {
  return {
    color: normalizeOptionalString(argumentsObject.color),
    content: normalizeOptionalString(argumentsObject.content),
    cycleId: normalizeOptionalString(argumentsObject.cycleId),
    hiddenAt: normalizeOptionalString(argumentsObject.hiddenAt),
    icon: normalizeOptionalString(argumentsObject.icon),
    initiativeId: normalizeOptionalString(argumentsObject.initiativeId),
    issueId: normalizeOptionalString(argumentsObject.issueId),
    lastAppliedTemplateId: normalizeOptionalString(
      argumentsObject.lastAppliedTemplateId,
    ),
    projectId: normalizeOptionalString(argumentsObject.projectId),
    resourceFolderId: normalizeOptionalString(argumentsObject.resourceFolderId),
    sortOrder: normalizeOptionalInteger(argumentsObject.sortOrder),
    subscriberIds: normalizeOptionalStringArray(argumentsObject.subscriberIds),
    teamId: normalizeOptionalString(argumentsObject.teamId),
    title: normalizeOptionalString(argumentsObject.title),
    trashed:
      typeof argumentsObject.trashed === "boolean"
        ? argumentsObject.trashed
        : null,
  };
}
