import { describe, expect, it, vi } from "vitest";

import type { OpenClawTenantConfig } from "../openclaw/config";
import { RuntimeManager } from "./manager";

function buildConfig(): OpenClawTenantConfig {
  return {
    authTokenEnvVar: "OPENCLAW_GATEWAY_TOKEN",
    gatewayPort: 18789,
    integrations: [],
    prompts: {},
    tenantId: "tenant_test",
    workspacePath: "/home/node/.openclaw/workspace",
  };
}

describe("RuntimeManager.applyTenantConfig", () => {
  it("recreates the gateway container so changed env files are reloaded", async () => {
    const manager = new RuntimeManager({} as never);
    const connection = { host: "tenant.test" };

    vi.spyOn(manager, "ensureRuntimeDirectories").mockResolvedValue(undefined);
    vi.spyOn(manager, "writeTenantConfigFiles").mockResolvedValue(undefined);
    vi.spyOn(manager, "verifyTenantConfigFiles").mockResolvedValue(undefined);
    const restartSpy = vi
      .spyOn(manager, "restartGatewayWithResult")
      .mockResolvedValue({
        exitCode: 0,
        stderr: "",
        stdout: "",
      });
    vi.spyOn(manager, "checkGatewayHealthWithResult").mockResolvedValue({
      exitCode: 0,
      stderr: "",
      stdout: "",
    });

    await manager.applyTenantConfig(connection, {
      desiredStateVersion: 1,
      gatewayToken: "gateway-token",
      managedBootstrapFiles: [],
      managedSkillFiles: [],
      openClawConfig: buildConfig(),
      tenantId: "tenant_test",
      tenantToken: "tenant-token",
    });

    expect(restartSpy).toHaveBeenCalledWith(connection, {
      pullImage: false,
      strategy: "recreate",
    });
  });
});
