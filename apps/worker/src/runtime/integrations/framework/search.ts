import { buildRuntimeIntegrationCommandMatch } from "./runtime-response"
import type {
  IntegrationDefinition,
  IntegrationRuntimeCommandDefinition,
  IntegrationRuntimeCommandGroupDefinition,
  RuntimeIntegrationCommandMatch,
} from "./types"

type RuntimeDefinitionWithStatus = IntegrationDefinition & {
  runtimeSurface: NonNullable<IntegrationDefinition["runtimeSurface"]>
  status: {
    connected: boolean
    connectionStatus: string | null
    enabled: boolean
    integrationStatus: string | null
    needsAttention: boolean
  }
}

type ScoredCommandMatch = {
  command: IntegrationRuntimeCommandDefinition
  definition: RuntimeDefinitionWithStatus
  reason: string
  score: number
}

export function findIntegrationCommandMatches(input: {
  definitions: RuntimeDefinitionWithStatus[]
  query: string
}): RuntimeIntegrationCommandMatch[] {
  const normalizedQuery = input.query.trim().toLowerCase()

  if (!normalizedQuery) {
    return []
  }

  const queryTokens = tokenize(normalizedQuery)
  const matches: ScoredCommandMatch[] = []

  for (const definition of input.definitions) {
    for (const command of collectCommands(definition.runtimeSurface)) {
      const scored = scoreCommandMatch({
        command,
        definition,
        query: normalizedQuery,
        tokens: queryTokens,
      })

      if (scored.score <= 0) {
        continue
      }

      matches.push(scored)
    }
  }

  return matches
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      if (left.definition.key !== right.definition.key) {
        return left.definition.key.localeCompare(right.definition.key)
      }

      return left.command.commandKey.localeCompare(right.command.commandKey)
    })
    .map((match) =>
      buildRuntimeIntegrationCommandMatch({
        command: match.command,
        definition: match.definition,
        reason: match.reason,
        status: match.definition.status,
      }),
    )
}

export function collectCommands(surface: {
  commandGroups: IntegrationRuntimeCommandGroupDefinition[]
  rootCommands: IntegrationRuntimeCommandDefinition[]
}): IntegrationRuntimeCommandDefinition[] {
  return [
    ...surface.rootCommands,
    ...surface.commandGroups.flatMap(collectCommandsFromGroup),
  ]
}

function collectCommandsFromGroup(
  group: IntegrationRuntimeCommandGroupDefinition,
): IntegrationRuntimeCommandDefinition[] {
  return [
    ...(group.commands ?? []),
    ...((group.childGroups ?? []).flatMap(collectCommandsFromGroup) ?? []),
  ]
}

function scoreCommandMatch(input: {
  command: IntegrationRuntimeCommandDefinition
  definition: RuntimeDefinitionWithStatus
  query: string
  tokens: string[]
}): ScoredCommandMatch {
  const groupPathText = input.command.commandPath.slice(0, -1).join(" ")
  const searchableFields = [
    {
      text: input.definition.key,
      weight: 8,
      reason: `${input.definition.label} integration key matches the request.`,
    },
    {
      text: input.definition.label,
      weight: 14,
      reason: `${input.definition.label} matches the request.`,
    },
    {
      text: input.definition.description,
      weight: 8,
      reason: `${input.definition.label} description matches the request.`,
    },
    {
      text: input.definition.catalogDescription,
      weight: 6,
      reason: `${input.definition.label} catalog description matches the request.`,
    },
    {
      text: input.command.commandKey,
      weight: 18,
      reason: `${input.command.commandKey} matches the requested command.`,
    },
    {
      text: groupPathText,
      weight: 10,
      reason: `${groupPathText || input.definition.label} is the best matching command group.`,
    },
    {
      text: input.command.label,
      weight: 18,
      reason: `${input.command.label} is the best matching command.`,
    },
    {
      text: input.command.description,
      weight: 14,
      reason: input.command.description,
    },
  ]

  const keywordTexts = [
    ...(input.command.intentKeywords ?? []),
    ...(input.command.usageNotes ?? []),
    ...input.command.commandPath,
  ]

  let score = 0
  let bestReason = `${input.definition.label} ${input.command.label} matches the request.`

  for (const field of searchableFields) {
    const normalizedField = field.text.trim().toLowerCase()

    if (!normalizedField) {
      continue
    }

    if (normalizedField === input.query) {
      score += field.weight * 3
      bestReason = field.reason
      continue
    }

    if (
      normalizedField.includes(input.query) ||
      input.query.includes(normalizedField)
    ) {
      score += field.weight * 2
      bestReason = field.reason
      continue
    }

    const tokenHits = input.tokens.filter((token) =>
      normalizedField.includes(token),
    ).length

    if (tokenHits > 0) {
      score += tokenHits * field.weight
      bestReason = field.reason
    }
  }

  for (const keyword of keywordTexts) {
    const normalizedKeyword = keyword.trim().toLowerCase()

    if (!normalizedKeyword) {
      continue
    }

    if (normalizedKeyword === input.query) {
      score += 18
      bestReason = `${input.command.label} is tagged for this kind of request.`
      continue
    }

    if (
      input.tokens.some(
        (token) =>
          normalizedKeyword.includes(token) ||
          token.includes(normalizedKeyword),
      )
    ) {
      score += 10
      bestReason = `${input.command.label} is tagged for this kind of request.`
    }
  }

  return {
    command: input.command,
    definition: input.definition,
    reason: bestReason,
    score,
  }
}

function tokenize(value: string) {
  return value
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length >= 2)
}
