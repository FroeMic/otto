import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRuntimeIntegrationDetailsResponse,
  buildRuntimeIntegrationSummaryResponse,
} from "./runtime-response";
import type { IntegrationDefinition } from "./types";

const settingsDefinition = {
  agentCapabilities: [] as [],
  categoryLabel: "Messaging",
  catalogDescription: "Test integration",
  description: "Test integration with settings.",
  iconSrc: null,
  key: "slack",
  label: "Slack",
  pageDescription: "Test integration with settings.",
  runtimeSurface: {
    commandGroups: [],
    rootCommands: [],
    toolDescription: "Test tool.",
    toolName: "slack",
  },
  settings: {
    description: "Manage Slack behavior.",
    label: "Configuration",
  },
    settingsPath: (orgSlug: string) =>
      `/${orgSlug}/settings/agent/integrations/slack/status`,
  showInWorkspaceCatalog: true,
} satisfies IntegrationDefinition & {
  runtimeSurface: NonNullable<IntegrationDefinition["runtimeSurface"]>;
};

const connectedStatus = {
  connected: true,
  connectionStatus: "connected",
  enabled: true,
  integrationStatus: "connected",
  needsAttention: false,
} as const;

describe("runtime integration response settings guidance", () => {
  it("adds explicit configure_integration guidance to summary settings", () => {
    const response = buildRuntimeIntegrationSummaryResponse({
      definition: settingsDefinition,
      status: connectedStatus,
    });

    assert.equal(response.settings?.label, "Configuration");
    assert.equal(response.settings?.toolName, "configure_integration");
    assert.match(
      (response.settings?.recommendedWorkflow ?? []).join(" "),
      /action=get/,
    );
  });

  it("adds explicit configure_integration guidance to detail settings", () => {
    const response = buildRuntimeIntegrationDetailsResponse({
      definition: settingsDefinition,
      detail: {
        commandKey: "noop.test",
        commandPath: ["noop", "test"],
        description: "No-op command.",
        argumentsSchema: {
          type: "object",
          additionalProperties: false,
          properties: {},
        },
        inputMode: "json",
        label: "No-op",
        resultMode: "json",
        execute: async () => ({}),
      },
      detailType: "command",
      status: connectedStatus,
    });

    assert.equal(response.integration.settings?.label, "Configuration");
    assert.equal(
      response.integration.settings?.toolName,
      "configure_integration",
    );
    assert.match(
      (response.integration.settings?.recommendedWorkflow ?? []).join(" "),
      /expectedEntryVersion/,
    );
  });
});
