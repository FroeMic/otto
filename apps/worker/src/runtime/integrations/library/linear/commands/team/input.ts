import {
  normalizeOptionalBoolean,
  normalizeOptionalString,
  pruneGraphqlInput,
} from "../../client";

export function buildLinearTeamCreateInput(
  argumentsObject: Record<string, unknown>,
) {
  const input = pruneGraphqlInput({
    color: normalizeOptionalString(argumentsObject.color),
    cyclesEnabled: normalizeOptionalBoolean(argumentsObject.cyclesEnabled),
    description: normalizeOptionalString(argumentsObject.description),
    icon: normalizeOptionalString(argumentsObject.icon),
    key: normalizeOptionalString(argumentsObject.key),
    name: normalizeOptionalString(argumentsObject.name),
    private: normalizeOptionalBoolean(argumentsObject.private),
    triageEnabled: normalizeOptionalBoolean(argumentsObject.triageEnabled),
  });

  if (!input.name) {
    throw new Error("team.create requires name.");
  }

  return input;
}

export function buildLinearTeamUpdateInput(
  argumentsObject: Record<string, unknown>,
) {
  const input = pruneGraphqlInput({
    color: normalizeOptionalString(argumentsObject.color),
    cyclesEnabled: normalizeOptionalBoolean(argumentsObject.cyclesEnabled),
    description: normalizeOptionalString(argumentsObject.description),
    icon: normalizeOptionalString(argumentsObject.icon),
    key: normalizeOptionalString(argumentsObject.key),
    name: normalizeOptionalString(argumentsObject.name),
    private: normalizeOptionalBoolean(argumentsObject.private),
    triageEnabled: normalizeOptionalBoolean(argumentsObject.triageEnabled),
  });

  if (Object.keys(input).length === 0) {
    throw new Error("team.update requires at least one field to update.");
  }

  return input;
}
