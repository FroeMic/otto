import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AgentCapability } from "@/tools/types";

import { buildResolvedIntegrationAgentCapability } from "./capabilities";

const slackTriggerCapability: AgentCapability = {
  description: "A Slack DM to Otto starts or continues an agent session.",
  direction: "trigger",
  key: "slack:trigger:dm",
  label: "Receive direct messages",
  source: "integration",
};

describe("integration capability resolution", () => {
  it("maps provider-owned trigger capabilities into shared capability rows", () => {
    const resolved = buildResolvedIntegrationAgentCapability({
      capability: slackTriggerCapability,
      definition: {
        key: "slack",
        label: "Slack",
      },
      policy: null,
      status: {
        connected: true,
        connectionStatus: "connected",
        enabled: true,
        integrationStatus: "connected",
        needsAttention: false,
      },
    });

    assert.equal(resolved.capabilityKey, "slack:trigger:dm");
    assert.equal(resolved.capabilityType, "trigger");
    assert.equal(resolved.effect, null);
    assert.equal(resolved.capabilityState.status, "enabled");
    assert.equal(resolved.userControllable, true);
  });

  it("respects non-configurable provider-owned capabilities", () => {
    const resolved = buildResolvedIntegrationAgentCapability({
      capability: {
        ...slackTriggerCapability,
        userControllable: false,
      },
      definition: {
        key: "slack",
        label: "Slack",
      },
      policy: null,
      status: {
        connected: true,
        connectionStatus: "connected",
        enabled: true,
        integrationStatus: "connected",
        needsAttention: false,
      },
    });

    assert.equal(resolved.userControllable, false);
  });

  it("marks provider-owned capabilities disabled when workspace policy blocks them", () => {
    const resolved = buildResolvedIntegrationAgentCapability({
      capability: {
        ...slackTriggerCapability,
        direction: "tool",
        key: "slack:tool:send",
        label: "Send messages",
      },
      definition: {
        key: "slack",
        label: "Slack",
      },
      policy: {
        policy: "block",
      },
      status: {
        connected: true,
        connectionStatus: "connected",
        enabled: true,
        integrationStatus: "connected",
        needsAttention: false,
      },
    });

    assert.equal(resolved.capabilityType, "command");
    assert.equal(resolved.effect, "write");
    assert.equal(resolved.capabilityState.status, "disabled");
    assert.equal(
      resolved.capabilityState.reason,
      "Disabled by workspace policy.",
    );
  });
});
