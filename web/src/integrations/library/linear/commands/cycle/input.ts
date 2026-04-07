import { normalizeOptionalString } from "../../client";

function assignIfPresent(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
) {
  if (value !== null && value !== undefined) {
    target[key] = value;
  }
}

export function buildLinearCycleCreateInput(
  argumentsObject: Record<string, unknown>,
) {
  const input: Record<string, unknown> = {
    endsAt: normalizeOptionalString(argumentsObject.endsAt),
    startsAt: normalizeOptionalString(argumentsObject.startsAt),
    teamId: normalizeOptionalString(argumentsObject.teamId),
  };

  assignIfPresent(
    input,
    "completedAt",
    normalizeOptionalString(argumentsObject.completedAt),
  );
  assignIfPresent(
    input,
    "description",
    normalizeOptionalString(argumentsObject.description),
  );
  assignIfPresent(input, "name", normalizeOptionalString(argumentsObject.name));

  if (!input.teamId || !input.startsAt || !input.endsAt) {
    throw new Error("cycle.create requires teamId, startsAt, and endsAt.");
  }

  return input;
}
