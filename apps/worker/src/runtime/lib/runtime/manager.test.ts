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

describe("RuntimeManager.forwardWorkspaceChatIngressRequest", () => {
  it("accepts a tenant ingress acknowledgment without waiting for turn completion", async () => {
    const sshClient = {
      exec: vi.fn(async () => ({
        exitCode: 0,
        stderr: "",
        stdout: JSON.stringify({
          bodyBase64: Buffer.from(
            JSON.stringify({
              accepted: true,
              ok: true,
              sessionKey: "workspace:conv_1?assistantMessageId=msg_1",
            }),
            "utf8",
          ).toString("base64"),
          headersBase64: Buffer.from("content-type: application/json\r\n", "utf8").toString(
            "base64",
          ),
          status: 202,
        }),
      })),
      writeFileAtomic: vi.fn(async () => undefined),
    };
    const manager = new RuntimeManager(sshClient as never);

    await expect(
      manager.forwardWorkspaceChatIngressRequest(
        {
          host: "tenant.test",
          port: 22,
          username: "root",
        },
        {
          assistantMessageId: "msg_1",
          conversationKind: "ad_hoc",
          conversationId: "conv_1",
          conversationTitle: "Portfolio review",
          conversationVisibility: "open",
          gatewayToken: "gateway-token",
          parts: [
            {
              text: "Hello",
              type: "text",
            },
          ],
          senderDisplayName: "Test User",
          senderExternalId: "user_1",
          userMessageId: "user_msg_1",
        },
      ),
    ).resolves.toEqual({
      accepted: true,
      ok: true,
      sessionKey: "workspace:conv_1?assistantMessageId=msg_1",
    });
  });

  it("surfaces the tenant ingress error payload when the workspace event POST fails", async () => {
    const sshClient = {
      exec: vi.fn(async () => ({
        exitCode: 0,
        stderr: "",
        stdout: JSON.stringify({
          bodyBase64: Buffer.from(
            JSON.stringify({
              error: "workspace chat plugin is not configured",
            }),
            "utf8",
          ).toString("base64"),
          headersBase64: Buffer.from("content-type: application/json\r\n", "utf8").toString(
            "base64",
          ),
          status: 500,
        }),
      })),
      writeFileAtomic: vi.fn(async () => undefined),
    };
    const manager = new RuntimeManager(sshClient as never);

    await expect(
      manager.forwardWorkspaceChatIngressRequest(
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
          parts: [
            {
              text: "Hello",
              type: "text",
            },
          ],
          senderDisplayName: "Test User",
          senderExternalId: "user_1",
          userMessageId: "msg_1",
        },
      ),
    ).rejects.toThrow("workspace chat plugin is not configured");

    expect(sshClient.writeFileAtomic).toHaveBeenCalled();
    expect(sshClient.exec).toHaveBeenCalled();
    const firstExecCall = sshClient.exec.mock.calls.at(0) as unknown[] | undefined;
    const executedCommand =
      firstExecCall && typeof firstExecCall[1] === "string" ? firstExecCall[1] : "";

    expect(executedCommand).toContain("/otto/workspace-chat/events");
    expect(executedCommand).toContain(
      "authorization: Bearer gateway-token",
    );
  });
});
