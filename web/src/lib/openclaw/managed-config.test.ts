import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildManagedBootstrapFileContent } from "@/lib/openclaw/managed-config";

describe("buildManagedBootstrapFileContent", () => {
  it("injects Otto UI context into TOOLS.md when runtime context is available", () => {
    const rendered = buildManagedBootstrapFileContent({
      path: "TOOLS.md",
      runtimeContext: {
        ottoBaseUrl: "https://app.getyourotto.com/",
        workspaceSlug: "/michael/",
      },
      sharedContent: "Shared notes",
      systemContent: "TOOLS.md - Local Notes",
    });

    assert.match(rendered, /Otto base URL: https:\/\/app\.getyourotto\.com/);
    assert.match(rendered, /Current workspace slug: michael/);
    assert.match(
      rendered,
      /Slack settings: https:\/\/app\.getyourotto\.com\/michael\/integrations\/slack/,
    );
    assert.match(
      rendered,
      /Web Search settings: https:\/\/app\.getyourotto\.com\/michael\/tools\/web\/search/,
    );
  });

  it("does not inject Otto UI context into non-tool managed files", () => {
    const rendered = buildManagedBootstrapFileContent({
      path: "AGENTS.md",
      runtimeContext: {
        ottoBaseUrl: "https://app.getyourotto.com",
        workspaceSlug: "michael",
      },
      sharedContent: "Shared notes",
      systemContent: "AGENTS.md - Your Workspace",
    });

    assert.doesNotMatch(rendered, /Otto Control Plane Context/);
  });
});
