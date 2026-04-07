import { linearOAuthProvider } from "./linear";
import type { OAuthProviderDefinition } from "./types";

const providers = new Map<string, OAuthProviderDefinition>([
  [linearOAuthProvider.key, linearOAuthProvider],
]);

export function getOAuthProviderDefinition(providerKey: string) {
  return providers.get(providerKey.trim().toLowerCase()) ?? null;
}

export function listOAuthProviderKeys() {
  return [...providers.keys()].sort((left, right) => left.localeCompare(right));
}
