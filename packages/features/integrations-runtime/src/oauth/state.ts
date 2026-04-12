import crypto from "node:crypto";

import { signOAuthState, verifyOAuthState } from "../lib/crypto";

export type ManagedIntegrationOAuthState = {
  nonce: string;
  provider: string;
  sessionId: string;
};

export function createPkcePair() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");

  return {
    challenge,
    verifier,
  };
}

export function createStateNonce() {
  return crypto.randomBytes(24).toString("base64url");
}

export function signManagedIntegrationOAuthState(
  payload: ManagedIntegrationOAuthState,
) {
  return signOAuthState(payload);
}

export function verifyManagedIntegrationOAuthState(encodedState: string) {
  return verifyOAuthState<ManagedIntegrationOAuthState>(encodedState);
}
