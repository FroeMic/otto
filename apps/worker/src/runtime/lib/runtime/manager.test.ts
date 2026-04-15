import { describe, expect, it, vi } from "vitest";

import type { OpenClawTenantConfig } from "../openclaw/config";
import { __testing as envTesting } from "../env";
import {
  listInstallOnlyManagedSkillFiles,
  listManagedEntryRuntimeFiles,
  RuntimeManager,
} from "./manager";

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

describe("RuntimeManager.verifySnapshotHostReady", () => {
  it("checks the baked-host contract instead of waiting for cloud-init", async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL =
      "postgres://postgres:postgres@localhost:5432/otto";
    envTesting.resetEnvCacheForTests();
    const sshClient = {
      exec: vi.fn().mockResolvedValue({
        exitCode: 0,
        stderr: "",
        stdout: "",
      }),
    };
    const manager = new RuntimeManager(sshClient as never);

    try {
      await manager.verifySnapshotHostReady({
        host: "tenant.test",
        port: 22,
        username: "root",
      });
    } finally {
      process.env.DATABASE_URL = previousDatabaseUrl;
      envTesting.resetEnvCacheForTests();
    }

    expect(sshClient.exec).toHaveBeenCalledTimes(1);
    const firstExecCall = sshClient.exec.mock.calls.at(0) as unknown[] | undefined;
    const executedCommand =
      firstExecCall && typeof firstExecCall[1] === "string" ? firstExecCall[1] : "";

    expect(executedCommand).toContain("command -v docker >/dev/null");
    expect(executedCommand).toContain("systemctl is-active --quiet docker");
    expect(executedCommand).toContain("id openclaw >/dev/null");
    expect(executedCommand).toContain("docker image inspect");
    expect(executedCommand).toContain(
      "/opt/openclaw/runtime/snapshot-metadata.json",
    );
  });
});

describe("managed skill runtime file projection", () => {
  it("splits managed-entry files from install-only companion files", () => {
    const files = [
      {
        contents: "# Brand Name Generator",
        filename: "skills/name-and-domain-research/SKILL.md",
        projectionMode: "managed_entry" as const,
      },
      {
        contents: "# Naming strategies",
        filename:
          "skills/name-and-domain-research/references/naming-strategies.md",
        projectionMode: "install_if_missing" as const,
      },
    ];

    expect(listManagedEntryRuntimeFiles(files)).toEqual([files[0]]);
    expect(listInstallOnlyManagedSkillFiles(files)).toEqual([files[1]]);
  });

  it("only writes install-if-missing managed skill files when they are absent", async () => {
    const sshClient = {
      exec: vi
        .fn()
        .mockResolvedValueOnce({ exitCode: 1, stderr: "", stdout: "" })
        .mockResolvedValueOnce({ exitCode: 0, stderr: "", stdout: "" }),
      writeFileAtomic: vi.fn(async () => undefined),
    };
    const manager = new RuntimeManager(sshClient as never);

    await manager.applyInstallOnlyManagedSkillFiles(
      { host: "tenant.test", port: 22, username: "root" } as never,
      [
        {
          contents: "# Naming strategies",
          filename:
            "skills/name-and-domain-research/references/naming-strategies.md",
          projectionMode: "install_if_missing",
        },
        {
          contents: "# Setup",
          filename: "skills/name-and-domain-research/references/setup.md",
          projectionMode: "install_if_missing",
        },
      ],
    );

    expect(sshClient.writeFileAtomic).toHaveBeenCalledTimes(1);
    expect(sshClient.writeFileAtomic).toHaveBeenCalledWith(
      expect.anything(),
      "/opt/openclaw/home/workspace/skills/name-and-domain-research/references/naming-strategies.md",
      "# Naming strategies",
      0o640,
    );
  });

  it("overwrites install-if-missing companion files when a reset operation targets the skill", async () => {
    const sshClient = {
      exec: vi.fn().mockResolvedValue({ exitCode: 0, stderr: "", stdout: "" }),
      writeFileAtomic: vi.fn(async () => undefined),
    };
    const manager = new RuntimeManager(sshClient as never);

    await manager.applyInstallOnlyManagedSkillFiles(
      { host: "tenant.test", port: 22, username: "root" } as never,
      [
        {
          contents: "# Naming strategies",
          filename:
            "skills/name-and-domain-research/references/naming-strategies.md",
          projectionMode: "install_if_missing",
        },
      ],
      [
        {
          scope: "companion_files",
          skillKey: "name-and-domain-research",
        },
      ],
    );

    expect(sshClient.writeFileAtomic).toHaveBeenCalledTimes(1);
    expect(sshClient.exec).not.toHaveBeenCalled();
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
