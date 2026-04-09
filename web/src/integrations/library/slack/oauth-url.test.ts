import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSlackOnboardingOauthStartUrl,
  buildSlackWorkspaceOauthStartUrl,
} from "./oauth-url";

describe("buildSlackWorkspaceOauthStartUrl", () => {
  it("returns the managed Slack oauth route when an org slug exists", () => {
    assert.equal(
      buildSlackWorkspaceOauthStartUrl({
        hasSlackOAuthConfig: true,
        orgSlug: "michael",
      }),
      "/oauth/start/integration/slack?orgSlug=michael",
    );
  });

  it("returns null when the workspace has no org slug", () => {
    assert.equal(
      buildSlackWorkspaceOauthStartUrl({
        hasSlackOAuthConfig: true,
        orgSlug: null,
      }),
      null,
    );
  });

  it("returns null when Slack oauth is unavailable", () => {
    assert.equal(
      buildSlackWorkspaceOauthStartUrl({
        hasSlackOAuthConfig: false,
        orgSlug: "michael",
      }),
      null,
    );
  });
});

describe("buildSlackOnboardingOauthStartUrl", () => {
  it("returns the managed Slack oauth route when an onboarding session exists", () => {
    assert.equal(
      buildSlackOnboardingOauthStartUrl({
        hasSlackOAuthConfig: true,
        onboardingSessionId: "session-123",
      }),
      "/oauth/start/integration/slack?onboardingSessionId=session-123",
    );
  });

  it("returns null when onboarding has no session id", () => {
    assert.equal(
      buildSlackOnboardingOauthStartUrl({
        hasSlackOAuthConfig: true,
        onboardingSessionId: null,
      }),
      null,
    );
  });
});
