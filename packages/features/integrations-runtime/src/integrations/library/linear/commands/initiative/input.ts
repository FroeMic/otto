import { normalizeOptionalString, pruneGraphqlInput } from "../../client";

export function buildLinearInitiativeCreateInput(
  argumentsObject: Record<string, unknown>,
) {
  return pruneGraphqlInput({
    color: normalizeOptionalString(argumentsObject.color),
    content: normalizeOptionalString(argumentsObject.content),
    description: normalizeOptionalString(argumentsObject.description),
    icon: normalizeOptionalString(argumentsObject.icon),
    name:
      typeof argumentsObject.name === "string"
        ? argumentsObject.name.trim()
        : "",
    ownerId: normalizeOptionalString(argumentsObject.ownerId),
    sortOrder:
      typeof argumentsObject.sortOrder === "number" &&
      Number.isFinite(argumentsObject.sortOrder)
        ? argumentsObject.sortOrder
        : null,
    status: normalizeOptionalString(argumentsObject.status),
    targetDate: normalizeOptionalString(argumentsObject.targetDate),
    targetDateResolution: normalizeOptionalString(
      argumentsObject.targetDateResolution,
    ),
  });
}

export function buildLinearInitiativeUpdateInput(
  argumentsObject: Record<string, unknown>,
) {
  return pruneGraphqlInput({
    color: normalizeOptionalString(argumentsObject.color),
    content: normalizeOptionalString(argumentsObject.content),
    description: normalizeOptionalString(argumentsObject.description),
    icon: normalizeOptionalString(argumentsObject.icon),
    name: normalizeOptionalString(argumentsObject.name),
    ownerId: normalizeOptionalString(argumentsObject.ownerId),
    sortOrder:
      typeof argumentsObject.sortOrder === "number" &&
      Number.isFinite(argumentsObject.sortOrder)
        ? argumentsObject.sortOrder
        : null,
    status: normalizeOptionalString(argumentsObject.status),
    targetDate: normalizeOptionalString(argumentsObject.targetDate),
    targetDateResolution: normalizeOptionalString(
      argumentsObject.targetDateResolution,
    ),
    trashed:
      typeof argumentsObject.trashed === "boolean"
        ? argumentsObject.trashed
        : null,
  });
}
