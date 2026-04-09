import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSlackWorkspaceOauthStartUrl } from "./oauth-url";

describe("buildSlackWorkspaceOauthStartUrl", () => {
  it("returns the legacy onboarding-backed Slack oauth route when a session exists", () => {
    assert.equal(
      buildSlackWorkspaceOauthStartUrl({
        hasSlackOAuthConfig: true,
        onboardingSessionId: "session-123",
      }),
      "/oauth/start/slack?onboardingSessionId=session-123",
    );
  });

  it("returns null when the workspace has no onboarding session", () => {
    assert.equal(
      buildSlackWorkspaceOauthStartUrl({
        hasSlackOAuthConfig: true,
        onboardingSessionId: null,
      }),
      null,
    );
  });

  it("returns null when Slack oauth is unavailable", () => {
    assert.equal(
      buildSlackWorkspaceOauthStartUrl({
        hasSlackOAuthConfig: false,
        onboardingSessionId: "session-123",
      }),
      null,
    );
  });
});
