import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSlackConnectionProfile } from "./oauth-metadata";

describe("buildSlackConnectionProfile", () => {
  it("builds Slack installation metadata from the generic OAuth connection row", () => {
    const profile = buildSlackConnectionProfile({
      externalAccountId: "T123",
      externalAccountLabel: "Otto Workspace",
      grantedScopesCsv: "chat:write,channels:read,users:read",
      providerMetadataJson: {
        installerUserId: "U_INSTALLER",
        slackBotUserId: "U_BOT",
      },
      tenantIntegrationId: "tenant_integration_123",
    });

    assert.deepEqual(profile, {
      grantedScopes: ["chat:write", "channels:read", "users:read"],
      installerUserId: "U_INSTALLER",
      slackBotUserId: "U_BOT",
      teamId: "T123",
      teamName: "Otto Workspace",
      tenantIntegrationId: "tenant_integration_123",
    });
  });

  it("returns null when the generic OAuth connection is missing a Slack team id", () => {
    assert.equal(
      buildSlackConnectionProfile({
        externalAccountId: null,
        externalAccountLabel: "Otto Workspace",
        grantedScopesCsv: "chat:write",
        providerMetadataJson: {},
        tenantIntegrationId: "tenant_integration_123",
      }),
      null,
    );
  });
});
