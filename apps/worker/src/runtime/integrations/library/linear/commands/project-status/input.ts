import {
  normalizeOptionalBoolean,
  normalizeOptionalString,
} from "../../client";

export function buildLinearProjectStatusCreateInput(
  argumentsObject: Record<string, unknown>,
) {
  return {
    color:
      typeof argumentsObject.color === "string"
        ? argumentsObject.color.trim()
        : "",
    description: normalizeOptionalString(argumentsObject.description),
    indefinite: normalizeOptionalBoolean(argumentsObject.indefinite) ?? false,
    name:
      typeof argumentsObject.name === "string"
        ? argumentsObject.name.trim()
        : "",
    position:
      typeof argumentsObject.position === "number" &&
      Number.isFinite(argumentsObject.position)
        ? argumentsObject.position
        : 0,
    type:
      typeof argumentsObject.type === "string"
        ? argumentsObject.type.trim()
        : "",
  };
}

export function buildLinearProjectStatusUpdateInput(
  argumentsObject: Record<string, unknown>,
) {
  return {
    color: normalizeOptionalString(argumentsObject.color),
    description: normalizeOptionalString(argumentsObject.description),
    indefinite: normalizeOptionalBoolean(argumentsObject.indefinite),
    name: normalizeOptionalString(argumentsObject.name),
    position:
      typeof argumentsObject.position === "number" &&
      Number.isFinite(argumentsObject.position)
        ? argumentsObject.position
        : null,
    type: normalizeOptionalString(argumentsObject.type),
  };
}
