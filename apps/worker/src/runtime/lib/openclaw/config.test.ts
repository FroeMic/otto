import assert from "node:assert/strict";

import { describe, expect, it } from "vitest";

import { renderOpenClawConfig, type OpenClawTenantConfig } from "./config";

function buildConfig(): OpenClawTenantConfig {
  return {
    authTokenEnvVar: "OPENCLAW_GATEWAY_TOKEN",
    gatewayPort: 18789,
    integrations: [],
    ottoPlugins: [
      {
        id: "otto-managed-config",
        timeoutMs: 15_000,
      },
      {
        id: "otto-workspace-chat",
      },
    ],
    prompts: {},
    tenantId: "tenant_test",
    workspacePath: "/home/node/.openclaw/workspace",
  };
}

describe("renderOpenClawConfig", () => {
  it("omits plugin config fields when a plugin does not declare them and enables the workspace channel", () => {
    const rendered = JSON.parse(renderOpenClawConfig(buildConfig())) as {
      channels: Record<string, { enabled: boolean; managed?: boolean }>;
      plugins: {
        entries: Record<string, { config?: Record<string, unknown>; enabled: boolean }>;
      };
      tools: Record<string, unknown>;
    };

    expect(rendered.plugins.entries["otto-managed-config"]).toEqual({
      config: { timeoutMs: 15_000 },
      enabled: true,
    });
    expect(rendered.plugins.entries["otto-workspace-chat"]).toEqual({
      enabled: true,
    });
    assert.equal(
      "config" in rendered.plugins.entries["otto-workspace-chat"],
      false,
    );
    expect(rendered.channels["otto-workspace-chat"]).toEqual({
      enabled: true,
      managed: true,
    });
    expect(rendered.tools.alsoAllow).toEqual(["otto-managed-config"]);
  });

  it("allowlists optional Otto tool plugins without including non-tool plugins", () => {
    const rendered = JSON.parse(
      renderOpenClawConfig({
        ...buildConfig(),
        ottoPlugins: [
          {
            id: "otto-managed-config",
            timeoutMs: 15_000,
          },
          {
            id: "otto-managed-skills",
            timeoutMs: 15_000,
          },
          {
            id: "otto-integrations",
            timeoutMs: 15_000,
          },
          {
            id: "otto-session-reporter",
            timeoutMs: 15_000,
          },
          {
            id: "otto-workspace-chat",
          },
        ],
      }),
    ) as {
      tools: {
        alsoAllow?: string[];
      };
    };

    expect(rendered.tools.alsoAllow).toEqual([
      "otto-managed-config",
      "otto-managed-skills",
      "otto-integrations",
    ]);
  });
});
