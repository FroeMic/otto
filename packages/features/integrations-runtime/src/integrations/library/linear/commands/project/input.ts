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

export function buildLinearProjectCreateInput(
  argumentsObject: Record<string, unknown>,
) {
  const input: Record<string, unknown> = {
    name: normalizeOptionalString(argumentsObject.name),
    teamIds: normalizeStringArray(argumentsObject.teamIds),
  }

  assignIfPresent(
    input,
    "color",
    normalizeOptionalString(argumentsObject.color),
  )
  assignIfPresent(
    input,
    "content",
    normalizeOptionalString(argumentsObject.content),
  )
  assignIfPresent(
    input,
    "description",
    normalizeOptionalString(argumentsObject.description),
  )
  assignIfPresent(input, "icon", normalizeOptionalString(argumentsObject.icon))
  assignIfPresent(
    input,
    "labelIds",
    normalizeOptionalStringArray(argumentsObject.labelIds),
  )
  assignIfPresent(
    input,
    "leadId",
    normalizeOptionalString(argumentsObject.leadId),
  )
  assignIfPresent(
    input,
    "memberIds",
    normalizeOptionalStringArray(argumentsObject.memberIds),
  )
  assignIfPresent(
    input,
    "priority",
    normalizeOptionalInteger(argumentsObject.priority),
  )
  assignIfPresent(
    input,
    "startDate",
    normalizeOptionalString(argumentsObject.startDate),
  )
  assignIfPresent(
    input,
    "statusId",
    normalizeOptionalString(argumentsObject.statusId),
  )
  assignIfPresent(
    input,
    "targetDate",
    normalizeOptionalString(argumentsObject.targetDate),
  )

  if (
    !input.name ||
    !Array.isArray(input.teamIds) ||
    input.teamIds.length === 0
  ) {
    throw new Error(
      "project.create requires both name and at least one teamId.",
    )
  }

  return input
}

export function buildLinearProjectUpdateInput(
  argumentsObject: Record<string, unknown>,
) {
  const input: Record<string, unknown> = {}

  assignIfPresent(
    input,
    "color",
    normalizeOptionalString(argumentsObject.color),
  )
  assignIfPresent(
    input,
    "content",
    normalizeOptionalString(argumentsObject.content),
  )
  assignIfPresent(
    input,
    "description",
    normalizeOptionalString(argumentsObject.description),
  )
  assignIfPresent(input, "icon", normalizeOptionalString(argumentsObject.icon))
  assignIfPresent(
    input,
    "labelIds",
    normalizeOptionalStringArray(argumentsObject.labelIds),
  )
  assignIfPresent(
    input,
    "leadId",
    normalizeOptionalString(argumentsObject.leadId),
  )
  assignIfPresent(
    input,
    "memberIds",
    normalizeOptionalStringArray(argumentsObject.memberIds),
  )
  assignIfPresent(input, "name", normalizeOptionalString(argumentsObject.name))
  assignIfPresent(
    input,
    "priority",
    normalizeOptionalInteger(argumentsObject.priority),
  )
  assignIfPresent(
    input,
    "startDate",
    normalizeOptionalString(argumentsObject.startDate),
  )
  assignIfPresent(
    input,
    "statusId",
    normalizeOptionalString(argumentsObject.statusId),
  )
  assignIfPresent(
    input,
    "targetDate",
    normalizeOptionalString(argumentsObject.targetDate),
  )
  assignIfPresent(
    input,
    "teamIds",
    normalizeOptionalStringArray(argumentsObject.teamIds),
  )
  assignIfPresent(
    input,
    "trashed",
    normalizeOptionalBoolean(argumentsObject.trashed),
  )

  if (Object.keys(input).length === 0) {
    throw new Error("project.update requires at least one field to update.")
  }

  return input
}

export function buildLinearProjectUpdateCreateInput(
  argumentsObject: Record<string, unknown>,
) {
  const projectId = normalizeOptionalString(argumentsObject.projectId)
  const input: Record<string, unknown> = {}

  assignIfPresent(input, "body", normalizeOptionalString(argumentsObject.body))
  assignIfPresent(
    input,
    "health",
    normalizeOptionalString(argumentsObject.health),
  )
  assignIfPresent(
    input,
    "isDiffHidden",
    normalizeOptionalBoolean(argumentsObject.isDiffHidden),
  )
  assignIfPresent(input, "projectId", projectId)

  if (!projectId) {
    throw new Error("project.create_update requires projectId.")
  }

  if (Object.keys(input).length === 1) {
    throw new Error(
      "project.create_update requires at least one of body, health, or isDiffHidden.",
    )
  }

  return input
}
