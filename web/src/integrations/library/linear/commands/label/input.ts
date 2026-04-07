import {
  normalizeOptionalBoolean,
  normalizeOptionalString,
  pruneGraphqlInput,
} from "../../client";

const DEFAULT_LINEAR_LABEL_COLOR = "#4F46E5";

export function buildLinearIssueLabelCreateInput(
  argumentsObject: Record<string, unknown>,
) {
  return pruneGraphqlInput({
    color:
      normalizeOptionalString(argumentsObject.color) ??
      DEFAULT_LINEAR_LABEL_COLOR,
    description: normalizeOptionalString(argumentsObject.description),
    isGroup: normalizeOptionalBoolean(argumentsObject.isGroup),
    name:
      typeof argumentsObject.name === "string"
        ? argumentsObject.name.trim()
        : "",
    parentId: normalizeOptionalString(argumentsObject.parentId),
    retiredAt: normalizeOptionalString(argumentsObject.retiredAt),
    teamId: normalizeOptionalString(argumentsObject.teamId),
  });
}

export function buildLinearIssueLabelUpdateInput(
  argumentsObject: Record<string, unknown>,
) {
  return pruneGraphqlInput({
    color: normalizeOptionalString(argumentsObject.color),
    description: normalizeOptionalString(argumentsObject.description),
    isGroup: normalizeOptionalBoolean(argumentsObject.isGroup),
    name: normalizeOptionalString(argumentsObject.name),
    parentId: normalizeOptionalString(argumentsObject.parentId),
    retiredAt: normalizeOptionalString(argumentsObject.retiredAt),
  });
}

export function buildLinearProjectLabelCreateInput(
  argumentsObject: Record<string, unknown>,
) {
  return pruneGraphqlInput({
    color:
      normalizeOptionalString(argumentsObject.color) ??
      DEFAULT_LINEAR_LABEL_COLOR,
    description: normalizeOptionalString(argumentsObject.description),
    isGroup: normalizeOptionalBoolean(argumentsObject.isGroup),
    name:
      typeof argumentsObject.name === "string"
        ? argumentsObject.name.trim()
        : "",
    parentId: normalizeOptionalString(argumentsObject.parentId),
    retiredAt: normalizeOptionalString(argumentsObject.retiredAt),
  });
}

export function buildLinearProjectLabelUpdateInput(
  argumentsObject: Record<string, unknown>,
) {
  return pruneGraphqlInput({
    color: normalizeOptionalString(argumentsObject.color),
    description: normalizeOptionalString(argumentsObject.description),
    isGroup: normalizeOptionalBoolean(argumentsObject.isGroup),
    name: normalizeOptionalString(argumentsObject.name),
    parentId: normalizeOptionalString(argumentsObject.parentId),
    retiredAt: normalizeOptionalString(argumentsObject.retiredAt),
  });
}
