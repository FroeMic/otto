import { listIntegrationOauthProviders } from "../../integrations/framework"
import type { OAuthProviderDefinition } from "../../lib/oauth/providers/types"

const providers = new Map<string, OAuthProviderDefinition>(
  listIntegrationOauthProviders().map((provider) => [provider.key, provider]),
)

export function getOAuthProviderDefinition(providerKey: string) {
  return providers.get(providerKey.trim().toLowerCase()) ?? null
}

export function listOAuthProviderKeys() {
  return [...providers.keys()].sort((left, right) => left.localeCompare(right))
}
