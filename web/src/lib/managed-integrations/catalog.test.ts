import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getManagedIntegrationDefinition,
  listRuntimeManagedIntegrationDefinitions,
  listWorkspaceManagedIntegrationDefinitions,
} from "@/lib/managed-integrations/catalog";

describe("managed integration catalog", () => {
  it("lists Linear in the workspace catalog", () => {
    const keys = listWorkspaceManagedIntegrationDefinitions().map(
      (definition) => definition.key,
    );

    assert.deepEqual(keys, ["linear"]);
  });

  it("keeps the demo provider as the only runtime-manifest-backed entry", () => {
    const keys = listRuntimeManagedIntegrationDefinitions().map(
      (definition) => definition.key,
    );

    assert.deepEqual(keys, ["demo-linear"]);
  });

  it("returns Linear metadata for the dedicated integration page", () => {
    const definition = getManagedIntegrationDefinition("linear");

    assert.ok(definition);
    assert.equal(definition.label, "Linear");
    assert.equal(definition.runtimeTool, null);
    assert.ok(definition.agentCapabilities.length >= 1);
  });
});
