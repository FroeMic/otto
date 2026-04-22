import {
  normalizeOptionalBoolean,
  normalizeOptionalInteger,
  normalizeOptionalString,
  normalizeOptionalStringArray,
  normalizeStringArray,
} from "../../client"

function assignIfPresent(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
) {
  if (value !== null && value !== undefined) {
    target[key] = value
  }
}

export function normalizeIssueIdentifierList(value: unknown) {
  return normalizeStringArray(value)
}

export function buildLinearIssueCreateInput(
  argumentsObject: Record<string, unknown>,
) {
  const input: Record<string, unknown> = {
    teamId: normalizeOptionalString(argumentsObject.teamId),
    title: normalizeOptionalString(argumentsObject.title),
  }

  assignIfPresent(
    input,
    "assigneeId",
    normalizeOptionalString(argumentsObject.assigneeId),
  )
  assignIfPresent(
    input,
    "cycleId",
    normalizeOptionalString(argumentsObject.cycleId),
  )
  assignIfPresent(
    input,
    "description",
    normalizeOptionalString(argumentsObject.description),
  )
  assignIfPresent(
    input,
    "labelIds",
    normalizeOptionalStringArray(argumentsObject.labelIds),
  )
  assignIfPresent(
    input,
    "parentId",
    normalizeOptionalString(argumentsObject.parentId),
  )
  assignIfPresent(
    input,
    "priority",
    normalizeOptionalInteger(argumentsObject.priority),
  )
  assignIfPresent(
    input,
    "projectId",
    normalizeOptionalString(argumentsObject.projectId),
  )
  assignIfPresent(
    input,
    "stateId",
    normalizeOptionalString(argumentsObject.stateId),
  )

  if (!input.teamId || !input.title) {
    throw new Error("issue.create requires both teamId and title.")
  }

  return input
}

export function buildLinearIssueUpdateInput(
  argumentsObject: Record<string, unknown>,
) {
  const input: Record<string, unknown> = {}

  assignIfPresent(
    input,
    "addedLabelIds",
    normalizeOptionalStringArray(argumentsObject.addedLabelIds),
  )
  assignIfPresent(
    input,
    "assigneeId",
    normalizeOptionalString(argumentsObject.assigneeId),
  )
  assignIfPresent(
    input,
    "cycleId",
    normalizeOptionalString(argumentsObject.cycleId),
  )
  assignIfPresent(
    input,
    "description",
    normalizeOptionalString(argumentsObject.description),
  )
  assignIfPresent(
    input,
    "labelIds",
    normalizeOptionalStringArray(argumentsObject.labelIds),
  )
  assignIfPresent(
    input,
    "parentId",
    normalizeOptionalString(argumentsObject.parentId),
  )
  assignIfPresent(
    input,
    "priority",
    normalizeOptionalInteger(argumentsObject.priority),
  )
  assignIfPresent(
    input,
    "projectId",
    normalizeOptionalString(argumentsObject.projectId),
  )
  assignIfPresent(
    input,
    "removedLabelIds",
    normalizeOptionalStringArray(argumentsObject.removedLabelIds),
  )
  assignIfPresent(
    input,
    "stateId",
    normalizeOptionalString(argumentsObject.stateId),
  )
  assignIfPresent(
    input,
    "teamId",
    normalizeOptionalString(argumentsObject.teamId),
  )
  assignIfPresent(
    input,
    "title",
    normalizeOptionalString(argumentsObject.title),
  )
  assignIfPresent(
    input,
    "trashed",
    normalizeOptionalBoolean(argumentsObject.trashed),
  )

  if (Object.keys(input).length === 0) {
    throw new Error("issue.update requires at least one field to update.")
  }

  return input
}
