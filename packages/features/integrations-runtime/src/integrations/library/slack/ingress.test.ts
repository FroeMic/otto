import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getSlackIngressCompatibilityPath,
  getSlackIngressEndpoint,
  getSlackIngressFrameworkPath,
  slackIngressDefinition,
} from "./ingress";

describe("slack ingress definition", () => {
  it("declares Slack as platform-managed ingress with framework and compatibility paths", () => {
    assert.equal(slackIngressDefinition.setupMode, "platform_managed");
    assert.deepEqual(
      slackIngressDefinition.endpoints.map((endpoint) => endpoint.endpointKey),
      ["events", "commands", "interactivity"],
    );
    assert.equal(
      getSlackIngressFrameworkPath("events"),
      "/api/webhooks/integrations/slack/events",
    );
    assert.equal(
      getSlackIngressCompatibilityPath("events"),
      "/api/integrations/slack/events",
    );
  });

  it("returns endpoint metadata for compatibility migration", () => {
    assert.deepEqual(getSlackIngressEndpoint("commands"), {
      compatibilityPath: "/api/integrations/slack/commands",
      endpointKey: "commands",
      frameworkPath: "/api/webhooks/integrations/slack/commands",
      label: "Slash commands",
    });
  });
});
