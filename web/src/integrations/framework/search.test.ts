import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  findIntegrationFunctionMatches,
  listRuntimeIntegrationDefinitions,
} from "@/integrations/framework";

describe("integration function discovery", () => {
  it("recommends linear search for issue-related requests and returns an example call", () => {
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

    const matches = findIntegrationFunctionMatches({
      definitions,
      query: "find issues about credits",
    });

    assert.ok(matches.length >= 1);
    assert.equal(matches[0]?.integrationKey, "linear");
    assert.equal(matches[0]?.functionKey, "search_issues");
    assert.equal(
      matches[0]?.executionGuide.exampleCall.arguments.query,
      "credit",
    );
    assert.equal(
      matches[0]?.executionGuide.toolName,
      "execute_integration_function",
    );
  });
});
