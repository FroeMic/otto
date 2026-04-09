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
      "brave",
      "linear",
      "slack",
      "whatsapp",
    ]);
  });

  it("builds a sorted manifest for supported keys only", () => {
    const manifest = buildRuntimeIntegrationManifestForKeys([
      "brave",
      "linear",
      "slack",
      "whatsapp",
      "unknown",
    ]);

    assert.equal(manifest.length, 4);
    assert.equal(manifest[0]?.key, "brave");
    assert.equal(manifest[0]?.toolName, "brave");
    assert.deepEqual(manifest[0]?.commandGroups, []);
    assert.deepEqual(manifest[0]?.rootCommands, []);
    assert.equal(manifest[1]?.key, "linear");
    assert.equal(manifest[1]?.toolName, "linear");
    assert.deepEqual(
      manifest[1]?.commandGroups.map((group) => group.groupKey),
      [
        "attachment",
        "customer_need",
        "customer",
        "customer_tier",
        "customer_status",
        "initiative",
        "cycle",
        "workspace",
        "team",
        "workspace_member",
        "user",
        "document",
        "label",
        "project_milestone",
        "project_status",
        "issue",
        "project",
        "comment",
      ],
    );
    assert.equal(
      manifest[1]?.commandGroups.find(
        (group) => group.groupKey === "attachment",
      )?.commandCount,
      8,
    );
    assert.equal(
      manifest[1]?.commandGroups.find((group) => group.groupKey === "workspace")
        ?.commandCount,
      6,
    );
    assert.equal(
      manifest[1]?.commandGroups.find((group) => group.groupKey === "team")
        ?.commandCount,
      14,
    );
    assert.equal(
      manifest[1]?.commandGroups.find(
        (group) => group.groupKey === "workspace_member",
      )?.commandCount,
      5,
    );
    assert.equal(
      manifest[1]?.commandGroups.find((group) => group.groupKey === "user")
        ?.commandCount,
      5,
    );
    assert.equal(
      manifest[1]?.commandGroups.find((group) => group.groupKey === "document")
        ?.commandCount,
      6,
    );
    assert.equal(
      manifest[1]?.commandGroups.find((group) => group.groupKey === "label")
        ?.commandCount,
      14,
    );
    assert.equal(
      manifest[1]?.commandGroups.find(
        (group) => group.groupKey === "customer_status",
      )?.commandCount,
      5,
    );
    assert.equal(
      manifest[1]?.commandGroups.find(
        (group) => group.groupKey === "project_milestone",
      )?.commandCount,
      6,
    );
    assert.equal(
      manifest[1]?.commandGroups.find(
        (group) => group.groupKey === "project_status",
      )?.commandCount,
      4,
    );
    assert.equal(
      manifest[1]?.commandGroups.find(
        (group) => group.groupKey === "customer_tier",
      )?.commandCount,
      5,
    );
    assert.equal(
      manifest[1]?.commandGroups.find(
        (group) => group.groupKey === "customer_need",
      )?.commandCount,
      8,
    );
    assert.equal(
      manifest[1]?.commandGroups.find((group) => group.groupKey === "customer")
        ?.commandCount,
      6,
    );
    assert.equal(
      manifest[1]?.commandGroups.find(
        (group) => group.groupKey === "initiative",
      )?.commandCount,
      9,
    );
    assert.equal(
      manifest[1]?.commandGroups.find((group) => group.groupKey === "issue")
        ?.commandCount,
      16,
    );
    assert.equal(
      manifest[1]?.commandGroups.find((group) => group.groupKey === "project")
        ?.commandCount,
      13,
    );
    assert.equal(
      manifest[1]?.commandGroups.find((group) => group.groupKey === "cycle")
        ?.commandCount,
      6,
    );
    assert.equal(
      manifest[1]?.commandGroups.find((group) => group.groupKey === "comment")
        ?.commandCount,
      5,
    );
    assert.equal(manifest[2]?.key, "slack");
    assert.equal(manifest[2]?.toolName, "slack");
    assert.deepEqual(manifest[2]?.commandGroups, []);
    assert.deepEqual(manifest[2]?.rootCommands, []);
    assert.equal(manifest[3]?.key, "whatsapp");
    assert.equal(manifest[3]?.toolName, "whatsapp");
    assert.deepEqual(manifest[3]?.commandGroups, []);
    assert.deepEqual(manifest[3]?.rootCommands, []);
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
