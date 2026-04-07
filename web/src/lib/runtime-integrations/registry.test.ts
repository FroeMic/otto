import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildRuntimeIntegrationManifestForKeys,
  executeRuntimeIntegrationStub,
  listSupportedRuntimeIntegrationKeys,
} from "@/lib/runtime-integrations/registry";

describe("runtime integration registry", () => {
  it("lists supported integration keys deterministically", () => {
    assert.deepEqual(listSupportedRuntimeIntegrationKeys(), ["linear"]);
  });

  it("builds a sorted manifest for supported keys only", () => {
    const manifest = buildRuntimeIntegrationManifestForKeys(["linear", "unknown"]);

    assert.equal(manifest.length, 1);
    assert.equal(manifest[0]?.key, "linear");
    assert.equal(manifest[0]?.toolName, "linear");
    assert.equal(manifest[0]?.operations[0]?.key, "search_issues");
  });

  it("returns a placeholder response for connected linear search", async () => {
    const result = (await executeRuntimeIntegrationStub({
      integrationKey: "linear",
      params: {
        operation: "search_issues",
        query: "bug",
      },
    })) as {
      integrationKey: string;
      operation: string;
      source: string;
      totalMatched: number;
    };

    assert.equal(result.integrationKey, "linear");
    assert.equal(result.operation, "search_issues");
    assert.equal(result.source, "stub");
    assert.equal(result.totalMatched, 0);
  });
});
