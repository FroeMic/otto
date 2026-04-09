import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getConnectedMessagingSurfaces } from "./workspace";

describe("getConnectedMessagingSurfaces", () => {
  it("uses the managed Slack integration route when Slack is connected without a team id", () => {
    const surfaces = getConnectedMessagingSurfaces({
      isReady: true,
      onboardingDraft: null,
      latestOnboardingSession: null,
      slackIntegration: {
        connectedAt: new Date().toISOString(),
        teamId: null,
      },
      slug: "michael",
      tenants: [],
    } as never);

    assert.deepEqual(surfaces, [
      {
        external: false,
        href: "/michael/integrations2/slack/status",
        iconSrc: "/integrations/slack.svg",
        key: "slack",
        label: "Slack",
      },
    ]);
  });
});
