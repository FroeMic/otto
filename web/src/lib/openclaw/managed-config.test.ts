import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildManagedBootstrapFileContent,
  getManagedBootstrapFileDefinitions,
  normalizeManagedBootstrapFilePath,
} from "@/lib/openclaw/managed-config";

describe("buildManagedBootstrapFileContent", () => {
  it("includes HEARTBEAT.md and MEMORY.md in the managed bootstrap registry", () => {
    const definitions = getManagedBootstrapFileDefinitions();

    assert.deepEqual(
      definitions.map((definition) => definition.path),
      [
        "AGENTS.md",
        "HEARTBEAT.md",
        "IDENTITY.md",
        "MEMORY.md",
        "SOUL.md",
        "USER.md",
        "TOOLS.md",
      ],
    );
  });

  it("injects workspace app context into TOOLS.md when runtime context is available", () => {
    const rendered = buildManagedBootstrapFileContent({
      path: "TOOLS.md",
      runtimeContext: {
        ottoBaseUrl: "https://app.getyourotto.com/",
        workspaceSlug: "/michael/",
      },
      sharedContent: "Shared notes",
      systemContent: "TOOLS.md - Local Notes",
    });

    assert.match(
      rendered,
      /Workspace app base URL: https:\/\/app\.getyourotto\.com/,
    );
    assert.match(rendered, /Current workspace slug: michael/);
    assert.match(rendered, /## Workspace App Context/);
    assert.match(
      rendered,
      /Workspace home: https:\/\/app\.getyourotto\.com\/michael/,
    );
    assert.match(
      rendered,
      /Skills: https:\/\/app\.getyourotto\.com\/michael\/skills/,
    );
    assert.match(
      rendered,
      /Integrations: https:\/\/app\.getyourotto\.com\/michael\/integrations/,
    );
    assert.match(
      rendered,
      /Otto settings: https:\/\/app\.getyourotto\.com\/michael\/agent/,
    );
    assert.match(
      rendered,
      /Scheduled tasks: https:\/\/app\.getyourotto\.com\/michael\/scheduled-tasks/,
    );
    assert.match(
      rendered,
      /Workspace settings: https:\/\/app\.getyourotto\.com\/michael\/settings\/workspace/,
    );
    assert.match(
      rendered,
      /User settings: https:\/\/app\.getyourotto\.com\/michael\/settings\/user/,
    );
  });

  it("does not inject workspace app context into non-tool managed files", () => {
    const rendered = buildManagedBootstrapFileContent({
      path: "AGENTS.md",
      runtimeContext: {
        ottoBaseUrl: "https://app.getyourotto.com",
        workspaceSlug: "michael",
      },
      sharedContent: "Shared notes",
      systemContent: "AGENTS.md - Your Workspace",
    });

    assert.doesNotMatch(rendered, /Workspace App Context/);
    assert.doesNotMatch(rendered, /control plane/i);
  });

  it("normalizes the legacy USERS.md path to USER.md", () => {
    assert.equal(
      normalizeManagedBootstrapFilePath("HEARTBEAT.md"),
      "HEARTBEAT.md",
    );
    assert.equal(normalizeManagedBootstrapFilePath("MEMORY.md"), "MEMORY.md");
    assert.equal(normalizeManagedBootstrapFilePath("USERS.md"), "USER.md");
    assert.equal(normalizeManagedBootstrapFilePath("USER.md"), "USER.md");
    assert.equal(normalizeManagedBootstrapFilePath("not-a-managed-file"), null);
  });
});
