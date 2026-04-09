import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getToolDefinition,
  listAvailableToolActions,
  listToolDefinitions,
} from "@/tools";

describe("tool registry", () => {
  it("loads unique registry-backed non-integration surfaces", () => {
    const definitions = listToolDefinitions();
    const surfaceIds = new Set(
      definitions.map((definition) => `${definition.kind}:${definition.key}`),
    );
    const ids = new Set(definitions.map((definition) => definition.id));

    assert.equal(surfaceIds.size, definitions.length);
    assert.equal(ids.size, definitions.length);
    assert.equal(getToolDefinition("channel", "slack"), null);
    assert.ok(getToolDefinition("channel", "whatsapp"));
    assert.ok(getToolDefinition("web", "search"));
  });

  it("computes lifecycle actions from current state", () => {
    const definition = getToolDefinition("channel", "whatsapp");

    assert.ok(definition);
    assert.deepEqual(
      listAvailableToolActions(definition, {
        enabled: true,
        installState: "installed",
      }),
      ["update", "reapply"],
    );
    assert.deepEqual(
      listAvailableToolActions(definition, {
        enabled: false,
        installState: "installed",
      }),
      ["update", "reapply"],
    );
    assert.deepEqual(
      listAvailableToolActions(definition, {
        enabled: false,
        installState: "uninstalled",
      }),
      [],
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
