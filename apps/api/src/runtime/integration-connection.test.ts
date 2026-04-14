import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { buildRuntimeIntegrationConnectionAction } from "./integration-connection";

describe("runtime integration connection action", () => {
  it("recommends enable for gandi when it is not yet enabled", () => {
    const result = buildRuntimeIntegrationConnectionAction({
      connectUrl: null,
      integration: {
        key: "gandi",
        label: "Gandi",
        status: {
          connected: false,
          connectionStatus: null,
          enabled: false,
          integrationStatus: null,
          needsAttention: false,
        },
      },
      requestedAction: "",
      workspaceUrl: "https://otto.test/acme/settings/agent/integrations/gandi/status",
    });

    assert.deepEqual(result, {
      availableActions: ["open_workspace", "enable"],
      connectUrl: null,
      integrationKey: "gandi",
      label: "Gandi",
      message:
        "Gandi is not enabled yet. Ask the user to open the workspace integration page and enable it.",
      recommendedAction: "enable",
      requiresUserAction: true,
      selectedAction: "enable",
      status: {
        connected: false,
        connectionStatus: null,
        enabled: false,
        integrationStatus: null,
        needsAttention: false,
      },
      workspaceUrl:
        "https://otto.test/acme/settings/agent/integrations/gandi/status",
    });
  });
});
