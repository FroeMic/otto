import { normalizeOptionalString } from "../../client";

export function buildLinearProjectMilestoneCreateInput(
  argumentsObject: Record<string, unknown>,
) {
  return {
    description: normalizeOptionalString(argumentsObject.description),
    name:
      typeof argumentsObject.name === "string"
        ? argumentsObject.name.trim()
        : "",
    projectId:
      typeof argumentsObject.projectId === "string"
        ? argumentsObject.projectId.trim()
        : "",
    sortOrder:
      typeof argumentsObject.sortOrder === "number" &&
      Number.isFinite(argumentsObject.sortOrder)
        ? argumentsObject.sortOrder
        : null,
    targetDate: normalizeOptionalString(argumentsObject.targetDate),
  };
}

export function buildLinearProjectMilestoneUpdateInput(
  argumentsObject: Record<string, unknown>,
) {
  return {
    description: normalizeOptionalString(argumentsObject.description),
    name: normalizeOptionalString(argumentsObject.name),
    projectId: normalizeOptionalString(argumentsObject.projectId),
    sortOrder:
      typeof argumentsObject.sortOrder === "number" &&
      Number.isFinite(argumentsObject.sortOrder)
        ? argumentsObject.sortOrder
        : null,
    targetDate: normalizeOptionalString(argumentsObject.targetDate),
  };
}

export function buildLinearProjectMilestoneMoveInput(
  argumentsObject: Record<string, unknown>,
) {
  return {
    addIssueTeamToProject:
      typeof argumentsObject.addIssueTeamToProject === "boolean"
        ? argumentsObject.addIssueTeamToProject
        : null,
    newIssueTeamId: normalizeOptionalString(argumentsObject.newIssueTeamId),
    projectId:
      typeof argumentsObject.projectId === "string"
        ? argumentsObject.projectId.trim()
        : "",
  };
}
