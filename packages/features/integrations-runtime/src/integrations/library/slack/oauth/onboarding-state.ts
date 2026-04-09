import { signOAuthState, verifyOAuthState } from "../../../../lib/crypto";

export type SlackOnboardingOAuthState = {
  onboardingSessionId: string;
  orgSlug: string;
  userExternalId: string;
};

export function signSlackOnboardingOAuthState(
  payload: SlackOnboardingOAuthState,
) {
  return signOAuthState(payload);
}

export function verifySlackOnboardingOAuthState(encodedState: string) {
  return verifyOAuthState<SlackOnboardingOAuthState>(encodedState);
}

export function isSlackOnboardingOAuthState(
  value: Record<string, unknown> | null | undefined,
): value is SlackOnboardingOAuthState {
  return Boolean(
    value &&
      typeof value.onboardingSessionId === "string" &&
      typeof value.orgSlug === "string" &&
      typeof value.userExternalId === "string",
  );
}
