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
    const manifest = buildRuntimeIntegrationManifestForKeys([
      "linear",
      "unknown",
    ]);

    assert.equal(manifest.length, 1);
    assert.equal(manifest[0]?.key, "linear");
    assert.equal(manifest[0]?.toolName, "linear");
    assert.deepEqual(
      manifest[0]?.commandGroups.map((group) => group.groupKey),
      ["workspace", "issue"],
    );
  });

  it("returns a placeholder response for connected linear issue search", async () => {
    const result = (await executeRuntimeIntegrationStub({
      arguments: {
        query: "bug",
      },
      commandKey: "issue.search",
      integrationKey: "linear",
    })) as {
      commandKey: string;
      integrationKey: string;
      source: string;
    };

    assert.equal(result.integrationKey, "linear");
    assert.equal(result.commandKey, "issue.search");
    assert.equal(result.source, "stub");
  });
});
