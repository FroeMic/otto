import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getManagedIntegrationDefinition,
  listRuntimeManagedIntegrationDefinitions,
  listWorkspaceManagedIntegrationDefinitions,
} from "@/lib/managed-integrations/catalog";

describe("managed integration catalog", () => {
  it("lists managed integrations in the workspace catalog", () => {
    const keys = listWorkspaceManagedIntegrationDefinitions().map(
      (definition) => definition.key,
    );

    assert.deepEqual(keys, ["linear", "slack"]);
  });

  it("includes runtime-manifest-backed entries for supported integrations", () => {
    const keys = listRuntimeManagedIntegrationDefinitions().map(
      (definition) => definition.key,
    );

    assert.deepEqual(keys, ["linear", "slack"]);
  });

  it("returns Linear metadata for the dedicated integration page", () => {
    const definition = getManagedIntegrationDefinition("linear");

    assert.ok(definition);
    assert.equal(definition.label, "Linear");
    assert.equal(definition.runtimeSurface?.toolName, "linear");
    assert.equal(definition.settings, undefined);
    assert.equal(
      definition.settingsPath("michael"),
      "/michael/integrations2/linear/status",
    );
    assert.ok(definition.agentCapabilities.length >= 1);
  });

  it("returns Slack metadata for the managed integration page", () => {
    const definition = getManagedIntegrationDefinition("slack");

    assert.ok(definition);
    assert.equal(definition.label, "Slack");
    assert.equal(definition.oauth?.provider.key, "slack");
    assert.equal(definition.runtimeSurface?.toolName, "slack");
    assert.equal(definition.settings?.label, "Configuration");
    assert.equal(
      definition.settingsPath("michael"),
      "/michael/integrations2/slack/status",
    );
    assert.ok(definition.agentCapabilities.length >= 1);
  });
});
