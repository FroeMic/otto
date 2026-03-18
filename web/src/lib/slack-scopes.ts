export const SLACK_VOICE_NOTE_REQUIRED_SCOPES = ["files:read"] as const;

export function parseSlackScopeCsv(scopeCsv: string | null | undefined) {
  if (!scopeCsv) {
    return new Set<string>();
  }

  return new Set(
    scopeCsv
      .split(",")
      .map((scope) => scope.trim())
      .filter(Boolean),
  );
}

export function getMissingSlackScopes(
  scopeCsv: string | null | undefined,
  requiredScopes: readonly string[],
) {
  const scopes = parseSlackScopeCsv(scopeCsv);

  return requiredScopes.filter((scope) => !scopes.has(scope));
}

export function hasRequiredSlackScopes(
  scopeCsv: string | null | undefined,
  requiredScopes: readonly string[],
) {
  return getMissingSlackScopes(scopeCsv, requiredScopes).length === 0;
}
