import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getToolDefinition,
  listAvailableToolActions,
  listToolDefinitions,
} from "@/tools";

describe("tool registry", () => {
  it("loads unique registry-backed surfaces", () => {
    const definitions = listToolDefinitions();
    const surfaceIds = new Set(
      definitions.map((definition) => `${definition.kind}:${definition.key}`),
    );
    const ids = new Set(definitions.map((definition) => definition.id));

    assert.equal(surfaceIds.size, definitions.length);
    assert.equal(ids.size, definitions.length);
    assert.ok(getToolDefinition("channel", "slack"));
    assert.ok(getToolDefinition("web", "search"));
  });

  it("computes lifecycle actions from current state", () => {
    const definition = getToolDefinition("channel", "slack");

    assert.ok(definition);
    assert.deepEqual(
      listAvailableToolActions(definition, {
        enabled: true,
        installState: "installed",
      }),
      ["update", "disable", "uninstall", "reapply"],
    );
    assert.deepEqual(
      listAvailableToolActions(definition, {
        enabled: false,
        installState: "installed",
      }),
      ["update", "enable", "uninstall", "reapply"],
    );
    assert.deepEqual(
      listAvailableToolActions(definition, {
        enabled: false,
        installState: "uninstalled",
      }),
      ["install"],
    );

    const webSearchDefinition = getToolDefinition("web", "search");

    assert.ok(webSearchDefinition);
    assert.deepEqual(
      listAvailableToolActions(webSearchDefinition, {
        enabled: true,
        installState: "installed",
      }),
      [],
    );
  });
});
