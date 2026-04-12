import {
  createIntegrationOauthSession,
  getIntegrationOauthSessionRecord,
} from "../db/oauth";
import { getOAuthProviderDefinition } from "./providers/index";
import {
  createPkcePair,
  createStateNonce,
  signManagedIntegrationOAuthState,
  verifyManagedIntegrationOAuthState,
} from "./state";

export async function createManagedIntegrationOauthAuthorizationUrl(input: {
  mode: "connect" | "reconnect";
  organizationId: string;
  providerKey: string;
  tenantId: string;
  tenantIntegrationId?: string | null;
  userId: string;
}) {
  const provider = getOAuthProviderDefinition(input.providerKey);

  if (!provider) {
    throw new Error(`Unsupported OAuth provider: ${input.providerKey}`);
  }

  const stateNonce = createStateNonce();
  const pkce = provider.usesPkce ? createPkcePair() : null;
  const session = await createIntegrationOauthSession({
    authorizeParams: provider.getAuthorizeParams(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    mode: input.mode,
    organizationId: input.organizationId,
    pkceCodeVerifier: pkce?.verifier ?? null,
    providerKey: provider.key,
    requestedScopes: provider.getRequestedScopes(),
    stateNonce,
    tenantId: input.tenantId,
    tenantIntegrationId: input.tenantIntegrationId ?? null,
    userId: input.userId,
  });
  const state = signManagedIntegrationOAuthState({
    nonce: stateNonce,
    provider: provider.key,
    sessionId: session.id,
  });

  return {
    authorizeUrl: provider.buildAuthorizationUrl({
      codeChallenge: pkce?.challenge ?? null,
      state,
    }),
  };
}

export async function getManagedIntegrationOauthCallbackContext(input: {
  encodedState: string;
  expectedProviderKey: string;
  userId: string;
}) {
  const decodedState = verifyManagedIntegrationOAuthState(input.encodedState);

  if (decodedState.provider !== input.expectedProviderKey) {
    throw new Error("OAuth state does not match the expected provider.");
  }

  const session = await getIntegrationOauthSessionRecord({
    providerKey: input.expectedProviderKey,
    sessionId: decodedState.sessionId,
  });

  if (!session) {
    throw new Error("OAuth session could not be found.");
  }

  if (session.userId !== input.userId) {
    throw new Error("OAuth session does not match the signed-in user.");
  }

  if (session.stateNonce !== decodedState.nonce) {
    throw new Error("OAuth session state mismatch.");
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    throw new Error("OAuth session has expired.");
  }

  const provider = getOAuthProviderDefinition(session.providerKey);

  if (!provider) {
    throw new Error(`Unsupported OAuth provider: ${session.providerKey}`);
  }

  return {
    provider,
    session,
  };
}
