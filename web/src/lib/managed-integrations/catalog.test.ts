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

  it("includes runtime-manifest-backed entries for linear", () => {
    const keys = listRuntimeManagedIntegrationDefinitions().map(
      (definition) => definition.key,
    );

    assert.deepEqual(keys, ["linear"]);
  });

  it("returns Linear metadata for the dedicated integration page", () => {
    const definition = getManagedIntegrationDefinition("linear");

    assert.ok(definition);
    assert.equal(definition.label, "Linear");
    assert.equal(definition.runtimeSurface?.toolName, "linear");
    assert.ok(definition.agentCapabilities.length >= 1);
  });
});
