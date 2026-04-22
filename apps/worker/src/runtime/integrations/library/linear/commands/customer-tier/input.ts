import { normalizeOptionalString } from "../../client"

export function buildLinearCustomerTierCreateInput(
  argumentsObject: Record<string, unknown>,
) {
  return {
    color:
      typeof argumentsObject.color === "string"
        ? argumentsObject.color.trim()
        : "",
    description: normalizeOptionalString(argumentsObject.description),
    displayName: normalizeOptionalString(argumentsObject.displayName),
    name: normalizeOptionalString(argumentsObject.name),
    position:
      typeof argumentsObject.position === "number" &&
      Number.isFinite(argumentsObject.position)
        ? argumentsObject.position
        : null,
  }
}

export function buildLinearCustomerTierUpdateInput(
  argumentsObject: Record<string, unknown>,
) {
  return {
    color: normalizeOptionalString(argumentsObject.color),
    description: normalizeOptionalString(argumentsObject.description),
    displayName: normalizeOptionalString(argumentsObject.displayName),
    name: normalizeOptionalString(argumentsObject.name),
    position:
      typeof argumentsObject.position === "number" &&
      Number.isFinite(argumentsObject.position)
        ? argumentsObject.position
        : null,
  }
}
