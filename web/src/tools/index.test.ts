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
    assert.equal(getToolDefinition("channel", "whatsapp"), null);
    assert.equal(getToolDefinition("web", "search"), null);
    assert.deepEqual(definitions, []);
  });

  it("computes lifecycle actions from current state", () => {
    assert.deepEqual(
      listAvailableToolActions(
        {
          supportsConfig: true,
          supportsEnable: false,
          supportsInstall: false,
          supportsReapply: true,
        } as never,
        {
          enabled: true,
          installState: "installed",
        },
      ),
      ["update", "reapply"],
    );
  });
});
