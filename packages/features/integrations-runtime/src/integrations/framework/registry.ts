import { braveIntegrationDefinition } from "../library/brave/definition";
import { gandiIntegrationDefinition } from "../library/gandi/definition";
import { linearIntegrationDefinition } from "../library/linear/definition";
import { slackIntegrationDefinition } from "../library/slack/definition";
import type { OAuthProviderDefinition } from "../../lib/oauth/providers/types";

import type { IntegrationDefinition } from "./types";

const registry = [
  braveIntegrationDefinition,
  gandiIntegrationDefinition,
  linearIntegrationDefinition,
  slackIntegrationDefinition,
] as const satisfies readonly IntegrationDefinition[];

const integrationKeys = new Set<string>();

for (const definition of registry) {
  const key = definition.key.trim().toLowerCase();

  if (integrationKeys.has(key)) {
    throw new Error(`Duplicate integration definition key: ${definition.key}`);
  }

  integrationKeys.add(key);
}

export function getIntegrationDefinition(key: string) {
  const normalizedKey = key.trim().toLowerCase();
  return (
    registry.find((definition) => definition.key === normalizedKey) ?? null
  );
}

export function listIntegrationDefinitions() {
  return [...registry].sort((left, right) => left.key.localeCompare(right.key));
}

export function listWorkspaceIntegrationDefinitions() {
  return listIntegrationDefinitions().filter(
    (definition) => definition.showInWorkspaceCatalog,
  );
}

export function listRuntimeIntegrationDefinitions() {
  return listIntegrationDefinitions().filter(
    (
      definition,
    ): definition is IntegrationDefinition & {
      runtimeSurface: NonNullable<IntegrationDefinition["runtimeSurface"]>;
    } => definition.runtimeSurface !== null,
  );
}

export function listSupportedRuntimeIntegrationKeys() {
  return listRuntimeIntegrationDefinitions().map(
    (definition) => definition.key,
  );
}

export function listIntegrationOauthProviders() {
  const providers = new Map<string, OAuthProviderDefinition>();

  for (const definition of listIntegrationDefinitions()) {
    const provider = definition.oauth?.provider;

    if (!provider) {
      continue;
    }

    providers.set(provider.key, provider);
  }

  return [...providers.values()].sort((left, right) =>
    left.key.localeCompare(right.key),
  );
}
