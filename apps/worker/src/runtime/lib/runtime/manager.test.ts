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

describe("RuntimeManager.invokeWorkspaceChatTurn", () => {
  it("surfaces the tenant gateway error payload when the workspace chat call fails", async () => {
    const manager = new RuntimeManager({} as never);
    const execCheckedSpy = vi
      .spyOn(manager as never, "execChecked")
      .mockResolvedValue({
        exitCode: 0,
        stderr: "",
        stdout: JSON.stringify({
          error: "workspace chat plugin is not configured",
          ok: false,
        }),
      });

    await expect(
      manager.invokeWorkspaceChatTurn(
        {
          host: "tenant.test",
          port: 22,
          username: "root",
        },
        {
          conversationKind: "ad_hoc",
          conversationId: "conv_1",
          conversationTitle: "Portfolio review",
          conversationVisibility: "open",
          gatewayToken: "gateway-token",
          message: "Hello",
          senderDisplayName: "Test User",
          senderExternalId: "user_1",
          userMessageId: "msg_1",
        },
      ),
    ).rejects.toThrow("workspace chat plugin is not configured");

    expect(execCheckedSpy).toHaveBeenCalled();
  });
});
