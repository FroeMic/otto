import { buildRuntimeIntegrationFunctionMatch } from "./runtime-response";
import type {
  IntegrationDefinition,
  RuntimeIntegrationFunctionMatch,
} from "./types";

type RuntimeDefinitionWithStatus = IntegrationDefinition & {
  runtimeTool: NonNullable<IntegrationDefinition["runtimeTool"]>;
  status: {
    connected: boolean;
    connectionStatus: string | null;
    enabled: boolean;
    integrationStatus: string | null;
    needsAttention: boolean;
  };
};

type ScoredOperationMatch = {
  definition: RuntimeDefinitionWithStatus;
  operation: RuntimeDefinitionWithStatus["runtimeTool"]["operations"][number];
  reason: string;
  score: number;
};

export function findIntegrationFunctionMatches(input: {
  definitions: RuntimeDefinitionWithStatus[];
  query: string;
}): RuntimeIntegrationFunctionMatch[] {
  const normalizedQuery = input.query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  const queryTokens = tokenize(normalizedQuery);
  const matches: ScoredOperationMatch[] = [];

  for (const definition of input.definitions) {
    for (const operation of definition.runtimeTool.operations) {
      const scored = scoreOperationMatch({
        definition,
        operation,
        query: normalizedQuery,
        tokens: queryTokens,
      });

      if (scored.score <= 0) {
        continue;
      }

      matches.push(scored);
    }
  }

  return matches
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (left.definition.key !== right.definition.key) {
        return left.definition.key.localeCompare(right.definition.key);
      }

      return left.operation.key.localeCompare(right.operation.key);
    })
    .map((match) =>
      buildRuntimeIntegrationFunctionMatch({
        definition: match.definition,
        operation: match.operation,
        reason: match.reason,
        status: match.definition.status,
      }),
    );
}

function scoreOperationMatch(input: {
  definition: RuntimeDefinitionWithStatus;
  operation: RuntimeDefinitionWithStatus["runtimeTool"]["operations"][number];
  query: string;
  tokens: string[];
}): ScoredOperationMatch {
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
      text: input.operation.key,
      weight: 16,
      reason: `${input.operation.key} matches the requested function.`,
    },
    {
      text: input.operation.label,
      weight: 18,
      reason: `${input.operation.label} is the best matching function.`,
    },
    {
      text: input.operation.description,
      weight: 14,
      reason: input.operation.description,
    },
  ];

  const keywordTexts = [
    ...(input.operation.intentKeywords ?? []),
    ...(input.operation.usageNotes ?? []),
  ];

  let score = 0;
  let bestReason = `${input.definition.label} ${input.operation.label} matches the request.`;

  for (const field of searchableFields) {
    const normalizedField = field.text.trim().toLowerCase();

    if (!normalizedField) {
      continue;
    }

    if (normalizedField === input.query) {
      score += field.weight * 3;
      bestReason = field.reason;
      continue;
    }

    if (
      normalizedField.includes(input.query) ||
      input.query.includes(normalizedField)
    ) {
      score += field.weight * 2;
      bestReason = field.reason;
      continue;
    }

    const tokenHits = input.tokens.filter((token) =>
      normalizedField.includes(token),
    ).length;

    if (tokenHits > 0) {
      score += tokenHits * field.weight;
      bestReason = field.reason;
    }
  }

  for (const keyword of keywordTexts) {
    const normalizedKeyword = keyword.trim().toLowerCase();

    if (!normalizedKeyword) {
      continue;
    }

    if (normalizedKeyword === input.query) {
      score += 18;
      bestReason = `${input.operation.label} is tagged for this kind of request.`;
      continue;
    }

    if (
      input.tokens.some(
        (token) =>
          normalizedKeyword.includes(token) ||
          token.includes(normalizedKeyword),
      )
    ) {
      score += 10;
      bestReason = `${input.operation.label} is tagged for this kind of request.`;
    }
  }

  return {
    definition: input.definition,
    operation: input.operation,
    reason: bestReason,
    score,
  };
}

function tokenize(value: string) {
  return value
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length >= 2);
}
