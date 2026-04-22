import {
  normalizeOptionalInteger,
  normalizeOptionalString,
  normalizeOptionalStringArray,
  pruneGraphqlInput,
} from "../../client"

export function buildLinearCustomerCreateInput(
  argumentsObject: Record<string, unknown>,
) {
  return pruneGraphqlInput({
    domains: normalizeOptionalStringArray(argumentsObject.domains) ?? [],
    externalIds:
      normalizeOptionalStringArray(argumentsObject.externalIds) ?? [],
    logoUrl: normalizeOptionalString(argumentsObject.logoUrl),
    mainSourceId: normalizeOptionalString(argumentsObject.mainSourceId),
    name:
      typeof argumentsObject.name === "string"
        ? argumentsObject.name.trim()
        : "",
    ownerId: normalizeOptionalString(argumentsObject.ownerId),
    revenue: normalizeOptionalInteger(argumentsObject.revenue),
    size: normalizeOptionalInteger(argumentsObject.size),
    slackChannelId: normalizeOptionalString(argumentsObject.slackChannelId),
    statusId: normalizeOptionalString(argumentsObject.statusId),
    tierId: normalizeOptionalString(argumentsObject.tierId),
  })
}

export function buildLinearCustomerUpdateInput(
  argumentsObject: Record<string, unknown>,
) {
  return pruneGraphqlInput({
    domains: normalizeOptionalStringArray(argumentsObject.domains),
    externalIds: normalizeOptionalStringArray(argumentsObject.externalIds),
    logoUrl: normalizeOptionalString(argumentsObject.logoUrl),
    mainSourceId: normalizeOptionalString(argumentsObject.mainSourceId),
    name: normalizeOptionalString(argumentsObject.name),
    ownerId: normalizeOptionalString(argumentsObject.ownerId),
    revenue: normalizeOptionalInteger(argumentsObject.revenue),
    size: normalizeOptionalInteger(argumentsObject.size),
    slackChannelId: normalizeOptionalString(argumentsObject.slackChannelId),
    statusId: normalizeOptionalString(argumentsObject.statusId),
    tierId: normalizeOptionalString(argumentsObject.tierId),
  })
}
