import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildRuntimeIntegrationManifestForKeys,
  executeRuntimeIntegrationStub,
  listSupportedRuntimeIntegrationKeys,
} from "@/lib/runtime-integrations/registry";

describe("runtime integration registry", () => {
  it("lists supported integration keys deterministically", () => {
    assert.deepEqual(listSupportedRuntimeIntegrationKeys(), [
      "demo-linear",
      "linear",
    ]);
  });

  it("builds a sorted manifest for supported keys only", () => {
    const manifest = buildRuntimeIntegrationManifestForKeys([
      "linear",
      "unknown",
      "demo-linear",
      "demo-linear",
    ]);

    assert.equal(manifest.length, 2);
    assert.equal(manifest[0]?.key, "demo-linear");
    assert.equal(manifest[1]?.key, "linear");
    assert.equal(manifest[1]?.toolName, "linear");
    assert.equal(manifest[0]?.toolName, "demo_linear");
    assert.equal(manifest[0]?.operations[0]?.key, "search_issues");
  });

  it("executes the stubbed demo-linear search", async () => {
    const result = (await executeRuntimeIntegrationStub({
      integrationKey: "demo-linear",
      params: {
        operation: "search_issues",
        query: "plugin",
      },
    })) as {
      integrationKey: string;
      items: Array<{ title?: string }>;
      operation: string;
      source: string;
    };

    assert.equal(result.integrationKey, "demo-linear");
    assert.equal(result.operation, "search_issues");
    assert.equal(result.source, "stub");
    assert.ok(result.items.length >= 1);
    assert.match(result.items[0]?.title ?? "", /plugin/i);
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
