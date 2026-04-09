import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isSlackOnboardingOAuthState,
  signSlackOnboardingOAuthState,
  verifySlackOnboardingOAuthState,
} from "./onboarding-state";

describe("Slack onboarding OAuth state", () => {
  it("round-trips signed onboarding state", () => {
    const encoded = signSlackOnboardingOAuthState({
      onboardingSessionId: "session-123",
      orgSlug: "michael",
      userExternalId: "user_123",
    });

    assert.deepEqual(verifySlackOnboardingOAuthState(encoded), {
      onboardingSessionId: "session-123",
      orgSlug: "michael",
      userExternalId: "user_123",
    });
  });

  it("recognizes the onboarding state shape", () => {
    assert.equal(
      isSlackOnboardingOAuthState({
        onboardingSessionId: "session-123",
        orgSlug: "michael",
        userExternalId: "user_123",
      }),
      true,
    );

    assert.equal(
      isSlackOnboardingOAuthState({
        provider: "slack",
        sessionId: "managed-session",
      }),
      false,
    );
  });
});
