export type SlackConnectionProfile = {
  grantedScopes: string[];
  installerUserId: string | null;
  slackBotUserId: string | null;
  teamId: string;
  teamName: string | null;
  tenantIntegrationId: string;
};

export function buildSlackConnectionProfile(input: {
  externalAccountId: string | null;
  externalAccountLabel: string | null;
  grantedScopesCsv: string | null;
  providerMetadataJson: Record<string, unknown> | null;
  tenantIntegrationId: string;
}): SlackConnectionProfile | null {
  const teamId = normalizeNonEmptyString(input.externalAccountId);

  if (!teamId) {
    return null;
  }

  const providerMetadata = input.providerMetadataJson ?? {};

  return {
    grantedScopes: splitScopeCsv(input.grantedScopesCsv),
    installerUserId: getNullableStringMetadataValue(
      providerMetadata,
      "installerUserId",
    ),
    slackBotUserId: getNullableStringMetadataValue(
      providerMetadata,
      "slackBotUserId",
    ),
    teamId,
    teamName: normalizeNullableString(input.externalAccountLabel),
    tenantIntegrationId: input.tenantIntegrationId,
  };
}

function splitScopeCsv(csv: string | null) {
  return (csv ?? "")
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function normalizeNonEmptyString(value: string | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNullableString(value: string | null) {
  return typeof value === "string" ? value : null;
}

function getNullableStringMetadataValue(
  metadata: Record<string, unknown>,
  key: string,
) {
  const value = metadata[key];
  return typeof value === "string" ? value : null;
}
