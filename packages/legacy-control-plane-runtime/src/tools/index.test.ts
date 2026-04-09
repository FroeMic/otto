import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getToolDefinition,
  listAvailableToolActions,
  listToolDefinitions,
} from "./";

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
    assert.equal(getToolDefinition("web", "search"), null);
    assert.deepEqual(
      definitions.map((definition) => `${definition.kind}:${definition.key}`),
      ["channel:whatsapp"],
    );
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
  });
});
