import assert from "node:assert/strict";

import { describe, expect, it } from "vitest";

import { __testing as envTesting } from "../env";
import {
  buildOpenClawTenantConfig,
  renderOpenClawConfig,
  type OpenClawTenantConfig,
} from "./config";

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

function restoreEnvVar(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function saveEnvVars(names: string[]) {
  return Object.fromEntries(names.map((name) => [name, process.env[name]]));
}

describe("renderOpenClawConfig", () => {
  it("builds a tenant config when web search config is absent", () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5432/otto";
    envTesting.resetEnvCacheForTests();
    try {
      const config = buildOpenClawTenantConfig({
        configJson: {},
        tenantId: "tenant_test",
      });

      expect(config.webSearch).toBeUndefined();
      expect(config.tenantId).toBe("tenant_test");
    } finally {
      process.env.DATABASE_URL = previousDatabaseUrl;
      envTesting.resetEnvCacheForTests();
    }
  });

  it("honors Otto plugins declared in desired state config", () => {
    const previousEnv = saveEnvVars([
      "DATABASE_URL",
      "LANDING_PAGE_DOMAIN",
      "WORKOS_BASE_URL",
      "WORKOS_REDIRECT_URI",
      "SLACK_REDIRECT_URI",
      "NEXT_PUBLIC_WORKOS_REDIRECT_URI",
    ]);

    process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5432/otto";
    delete process.env.LANDING_PAGE_DOMAIN;
    delete process.env.WORKOS_BASE_URL;
    delete process.env.WORKOS_REDIRECT_URI;
    delete process.env.SLACK_REDIRECT_URI;
    delete process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;
    envTesting.resetEnvCacheForTests();

    try {
      const config = buildOpenClawTenantConfig({
        configJson: {
          ottoPlugins: [{ id: "otto-workspace-chat" }],
        },
        tenantId: "tenant_test",
      });
      const rendered = JSON.parse(renderOpenClawConfig(config)) as {
        channels: Record<string, { enabled: boolean; managed?: boolean }>;
        plugins: {
          entries: Record<string, { enabled: boolean }>;
        };
      };

      expect(rendered.plugins.entries["otto-workspace-chat"]).toEqual({
        enabled: true,
      });
      expect(rendered.channels["otto-workspace-chat"]).toEqual({
        enabled: true,
        managed: true,
      });
    } finally {
      for (const [name, value] of Object.entries(previousEnv)) {
        restoreEnvVar(name, value);
      }
      envTesting.resetEnvCacheForTests();
    }
  });

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
