import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  findIntegrationCommandMatches,
  listRuntimeIntegrationDefinitions,
} from "@/integrations/framework";

describe("integration command discovery", () => {
  it("recommends linear issue search for issue-related requests and returns compact example arguments", () => {
    const definitions = listRuntimeIntegrationDefinitions().map(
      (definition) => ({
        ...definition,
        status: {
          connected: true,
          connectionStatus: "connected",
          enabled: true,
          integrationStatus: "connected",
          needsAttention: false,
        },
      }),
    );

    const matches = findIntegrationCommandMatches({
      definitions,
      query: "find issues about credits",
    });

    assert.ok(matches.length >= 1);
    assert.equal(matches[0]?.integrationKey, "linear");
    assert.equal(matches[0]?.commandKey, "issue.search");
    assert.equal(matches[0]?.exampleArguments.query, "credit");
    assert.equal(matches[0]?.connected, true);
    assert.equal(matches[0]?.needsAttention, false);
  });
});
