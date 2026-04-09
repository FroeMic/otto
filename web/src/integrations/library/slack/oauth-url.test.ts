import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSlackWorkspaceOauthStartUrl } from "./oauth-url";

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
        onboardingSessionId: "session-123",
      }),
      null,
    );
  });
});
