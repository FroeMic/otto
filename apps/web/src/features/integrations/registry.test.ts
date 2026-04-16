import assert from "node:assert/strict";

import { describe, it } from "vitest";

import {
  integrationDetailRegistry,
  integrationOverviewRegistry,
} from "./registry";

describe("integration registry", () => {
  it("registers gandi in the overview and detail registries", () => {
    assert.equal(typeof integrationOverviewRegistry.gandi, "function");
    assert.equal(typeof integrationDetailRegistry.gandi, "function");
  });

  it("registers posthog in the overview and detail registries", () => {
    assert.equal(typeof integrationOverviewRegistry.posthog, "function");
    assert.equal(typeof integrationDetailRegistry.posthog, "function");
  });
});
