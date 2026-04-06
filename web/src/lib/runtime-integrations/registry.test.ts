import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildRuntimeIntegrationManifestForKeys,
  executeRuntimeIntegrationStub,
  listSupportedRuntimeIntegrationKeys,
} from "@/lib/runtime-integrations/registry";

describe("runtime integration registry", () => {
  it("lists supported integration keys deterministically", () => {
    assert.deepEqual(listSupportedRuntimeIntegrationKeys(), ["demo-linear"]);
  });

  it("builds a sorted manifest for supported keys only", () => {
    const manifest = buildRuntimeIntegrationManifestForKeys([
      "unknown",
      "demo-linear",
      "demo-linear",
    ]);

    assert.equal(manifest.length, 1);
    assert.equal(manifest[0]?.key, "demo-linear");
    assert.equal(manifest[0]?.toolName, "demo_linear");
    assert.equal(manifest[0]?.operations[0]?.key, "search_issues");
  });

  it("executes the stubbed demo-linear search", () => {
    const result = executeRuntimeIntegrationStub({
      integrationKey: "demo-linear",
      params: {
        operation: "search_issues",
        query: "plugin",
      },
    });

    assert.equal(result.integrationKey, "demo-linear");
    assert.equal(result.operation, "search_issues");
    assert.equal(result.source, "stub");
    assert.ok(result.items.length >= 1);
    assert.match(result.items[0]?.title ?? "", /plugin/i);
  });
});
