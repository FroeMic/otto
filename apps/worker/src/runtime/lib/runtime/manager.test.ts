import { execFileSync } from "node:child_process"

import { describe, expect, it, vi } from "vitest"
import { __testing as envTesting } from "../env"
import type { OpenClawTenantConfig } from "../openclaw/config"
import {
  buildManagedSkillPruneCommand,
  listInstallOnlyManagedSkillFiles,
  listManagedEntryRuntimeFiles,
  RuntimeManager,
} from "./manager"

function buildConfig(): OpenClawTenantConfig {
  return {
    authTokenEnvVar: "OPENCLAW_GATEWAY_TOKEN",
    gatewayPort: 18789,
    integrations: [],
    prompts: {},
    tenantId: "tenant_test",
    workspacePath: "/home/node/.openclaw/workspace",
  }
}

describe("RuntimeManager.applyTenantConfig", () => {
  it("recreates the gateway container so changed env files are reloaded", async () => {
    const manager = new RuntimeManager({} as never)
    const connection = { host: "tenant.test" }

    vi.spyOn(manager, "ensureRuntimeDirectories").mockResolvedValue(undefined)
    vi.spyOn(manager, "writeTenantConfigFiles").mockResolvedValue(undefined)
    vi.spyOn(manager, "verifyTenantConfigFiles").mockResolvedValue(undefined)
    const restartSpy = vi
      .spyOn(manager, "restartGatewayWithResult")
      .mockResolvedValue({
        exitCode: 0,
        stderr: "",
        stdout: "",
      })
    vi.spyOn(manager, "checkGatewayHealthWithResult").mockResolvedValue({
      exitCode: 0,
      stderr: "",
      stdout: "",
    })

    await manager.applyTenantConfig(connection, {
      desiredStateVersion: 1,
      gatewayToken: "gateway-token",
      managedBootstrapFiles: [],
      managedSkillFiles: [],
      openClawConfig: buildConfig(),
      tenantId: "tenant_test",
      tenantToken: "tenant-token",
    })

    expect(restartSpy).toHaveBeenCalledWith(connection, {
      pullImage: false,
      strategy: "recreate",
    })
  })
})

describe("RuntimeManager runtime home bootstrap", () => {
  it("retries gateway health when a startup probe times out", async () => {
    const execMock = vi
      .fn()
      .mockRejectedValueOnce(
        new Error(
          "SSH command timed out after 30000ms: docker ps --filter name=openclaw-gateway",
        ),
      )
      .mockResolvedValueOnce({
        exitCode: 0,
        stderr: "",
        stdout: "status=running health=starting restartCount=0 exitCode=0",
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stderr: "",
        stdout: '{"ok":true,"status":"live"}',
      })
    const manager = new RuntimeManager({
      exec: execMock,
    } as never)

    await expect(
      manager.checkGatewayHealthWithResult({
        host: "tenant.test",
        port: 22,
        username: "root",
      }),
    ).resolves.toEqual({
      exitCode: 0,
      stderr: "",
      stdout: '{"ok":true,"status":"live"}',
    })

    expect(execMock).toHaveBeenCalledTimes(3)
  })

  it("verifies workspace chat runtimes include audio media config", async () => {
    const execMock = vi.fn(async () => ({
      exitCode: 0,
      stderr: "",
      stdout: "",
    }))
    const manager = new RuntimeManager({
      exec: execMock,
    } as never)

    await manager.verifyTenantConfigFiles(
      {
        host: "tenant.test",
        port: 22,
        username: "root",
      },
      {
        managedSkillFiles: [],
        metadataPath: "/opt/openclaw/runtime/apply-metadata.json",
        openClawConfig: {
          ...buildConfig(),
          ottoPlugins: [{ id: "otto-workspace-chat" }],
        },
      },
    )

    const command =
      (execMock.mock.calls as unknown as Array<[unknown, string]>)[0]?.[1] ?? ""

    expect(command).toContain("grep -F")
    expect(command).toContain("audio")
    expect(command).toContain("/opt/openclaw/home/openclaw.json")
  })

  it("writes the OpenAI proxy transport switch to the tenant runtime env", async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL
    const previousTransport = process.env.OTTO_OPENAI_PROXY_TRANSPORT
    process.env.DATABASE_URL =
      "postgres://postgres:postgres@localhost:5432/otto"
    process.env.OTTO_OPENAI_PROXY_TRANSPORT = "websocket"
    envTesting.resetEnvCacheForTests()

    const manager = new RuntimeManager({} as never)
    vi.spyOn(manager, "moveManagedSkillDirectories").mockResolvedValue(
      undefined,
    )
    vi.spyOn(manager, "applyInstallOnlyManagedSkillFiles").mockResolvedValue(
      undefined,
    )
    vi.spyOn(manager, "reconcileManagedSkillFiles").mockResolvedValue(undefined)
    vi.spyOn(
      manager,
      "normalizeTenantRuntimeFilePermissions",
    ).mockResolvedValue(undefined)
    const applyFilesSpy = vi
      .spyOn(manager, "applyTenantFiles")
      .mockResolvedValue(undefined)

    try {
      await manager.writeTenantConfigFiles({ host: "tenant.test" } as never, {
        desiredStateVersion: 1,
        gatewayToken: "gateway-token",
        managedBootstrapFiles: [],
        managedSkillFiles: [],
        metadataPath: "/opt/openclaw/runtime/apply-metadata.json",
        metadataTimestampKey: "appliedAt",
        openClawConfig: buildConfig(),
        tenantId: "tenant_test",
        tenantToken: "tenant-token",
      })

      const files = applyFilesSpy.mock.calls[0]?.[1] ?? []
      const envFile = files.find(
        (file) => file.path === "/opt/openclaw/home/.env",
      )
      expect(envFile?.contents).toContain(
        "OTTO_OPENAI_PROXY_TRANSPORT=websocket",
      )
    } finally {
      if (previousDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL
      } else {
        process.env.DATABASE_URL = previousDatabaseUrl
      }
      if (previousTransport === undefined) {
        delete process.env.OTTO_OPENAI_PROXY_TRANSPORT
      } else {
        process.env.OTTO_OPENAI_PROXY_TRANSPORT = previousTransport
      }
      envTesting.resetEnvCacheForTests()
    }
  })

  it("creates the cron directories mounted into the OpenClaw container", async () => {
    const execMock = vi.fn(async () => ({
      exitCode: 0,
      stderr: "",
      stdout: "",
    }))
    const sshClient = {
      exec: execMock,
    }
    const manager = new RuntimeManager(sshClient as never)

    await manager.ensureRuntimeDirectories({
      host: "tenant.test",
      port: 22,
      username: "root",
    })

    const command =
      (execMock.mock.calls as unknown as Array<[unknown, string]>)[0]?.[1] ?? ""

    expect(command).toContain("/opt/openclaw/home/cron")
    expect(command).toContain("/opt/openclaw/home/cron/runs")
  })

  it("normalizes cron directory ownership and permissions for the container user", async () => {
    const execMock = vi.fn(async () => ({
      exitCode: 0,
      stderr: "",
      stdout: "",
    }))
    const sshClient = {
      exec: execMock,
    }
    const manager = new RuntimeManager(sshClient as never)

    await manager.normalizeTenantRuntimeFilePermissions(
      {
        host: "tenant.test",
        port: 22,
        username: "root",
      },
      {
        managedBootstrapFiles: [],
        managedSkillFiles: [],
        metadataPath: "/opt/openclaw/runtime/apply-metadata.json",
      },
    )

    const command =
      (execMock.mock.calls as unknown as Array<[unknown, string]>)[0]?.[1] ?? ""

    expect(command).toContain("/opt/openclaw/home/cron")
    expect(command).toContain("/opt/openclaw/home/cron/runs")
    expect(command).toContain("install -d -o openclaw -g openclaw -m 700")
    expect(command).toContain("chmod 700")
  })

  it("keeps managed personalization files root-owned while preserving writable workspace areas", async () => {
    const execMock = vi.fn(async () => ({
      exitCode: 0,
      stderr: "",
      stdout: "",
    }))
    const sshClient = {
      exec: execMock,
    }
    const manager = new RuntimeManager(sshClient as never)

    await manager.normalizeTenantRuntimeFilePermissions(
      {
        host: "tenant.test",
        port: 22,
        username: "root",
      },
      {
        managedBootstrapFiles: [
          {
            contents: "# AGENTS",
            filename: "AGENTS.md",
          },
          {
            contents: "# USER",
            filename: "USER.md",
          },
        ],
        managedSkillFiles: [],
        metadataPath: "/opt/openclaw/runtime/apply-metadata.json",
      },
    )

    const command =
      (execMock.mock.calls as unknown as Array<[unknown, string]>)[0]?.[1] ?? ""

    expect(command).toContain(
      "install -d -o root -g openclaw -m 755 /opt/openclaw/home/workspace",
    )
    expect(command).toContain("install -d -o openclaw -g openclaw -m 770")
    expect(command).toContain("/opt/openclaw/home/workspace/memory")
    expect(command).toContain("/opt/openclaw/home/workspace/projects")
    expect(command).toContain("chown root:openclaw")
    expect(command).toContain("/opt/openclaw/home/workspace/AGENTS.md")
    expect(command).toContain("/opt/openclaw/home/workspace/USER.md")
    expect(command).toContain("chmod 755 /opt/openclaw/home/workspace")
    expect(command).toContain("chmod 770")
    expect(command).toContain("chmod 444")
  })

  it("pre-creates OpenClaw workspace-local state without making the managed workspace root writable", async () => {
    const execMock = vi.fn(async () => ({
      exitCode: 0,
      stderr: "",
      stdout: "",
    }))
    const sshClient = {
      exec: execMock,
    }
    const manager = new RuntimeManager(sshClient as never)

    await manager.normalizeTenantRuntimeFilePermissions(
      {
        host: "tenant.test",
        port: 22,
        username: "root",
      },
      {
        managedBootstrapFiles: [],
        managedSkillFiles: [],
        metadataPath: "/opt/openclaw/runtime/apply-metadata.json",
      },
    )

    const command =
      (execMock.mock.calls as unknown as Array<[unknown, string]>)[0]?.[1] ?? ""

    expect(command).toContain(
      "install -d -o root -g openclaw -m 755 /opt/openclaw/home/workspace",
    )
    expect(command).toContain(
      "install -d -o openclaw -g openclaw -m 770 /opt/openclaw/home/workspace/.openclaw",
    )
    expect(command).toContain(
      "chown openclaw:openclaw /opt/openclaw/home/workspace/.openclaw",
    )
    expect(command).toContain("chmod 755 /opt/openclaw/home/workspace")
    expect(command).toContain(
      "chmod 770 /opt/openclaw/home/workspace/.openclaw",
    )
  })
})

describe("managed skill runtime file projection", () => {
  it("splits managed-entry files from install-only companion files", () => {
    const files = [
      {
        contents: "# Name Generator",
        filename: "skills/name-and-domain-research/SKILL.md",
        projectionMode: "managed_entry" as const,
      },
      {
        contents: "# Naming strategies",
        filename:
          "skills/name-and-domain-research/references/naming-strategies.md",
        projectionMode: "install_if_missing" as const,
      },
    ]

    expect(listManagedEntryRuntimeFiles(files)).toEqual([files[0]])
    expect(listInstallOnlyManagedSkillFiles(files)).toEqual([files[1]])
  })

  it("only writes install-if-missing managed skill files when they are absent", async () => {
    const sshClient = {
      exec: vi
        .fn()
        .mockResolvedValueOnce({ exitCode: 1, stderr: "", stdout: "" })
        .mockResolvedValueOnce({ exitCode: 0, stderr: "", stdout: "" }),
      writeFileAtomic: vi.fn(async () => undefined),
    }
    const manager = new RuntimeManager(sshClient as never)

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
    )

    expect(sshClient.writeFileAtomic).toHaveBeenCalledTimes(1)
    expect(sshClient.writeFileAtomic).toHaveBeenCalledWith(
      expect.anything(),
      "/opt/openclaw/home/workspace/skills/name-and-domain-research/references/naming-strategies.md",
      "# Naming strategies",
      0o640,
    )
  })

  it("overwrites install-if-missing companion files when a reset operation targets the skill", async () => {
    const sshClient = {
      exec: vi.fn().mockResolvedValue({ exitCode: 0, stderr: "", stdout: "" }),
      writeFileAtomic: vi.fn(async () => undefined),
    }
    const manager = new RuntimeManager(sshClient as never)

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
    )

    expect(sshClient.writeFileAtomic).toHaveBeenCalledTimes(1)
    expect(sshClient.exec).not.toHaveBeenCalled()
  })

  it("deletes the full skill directory when a skill is removed from the manifest", () => {
    const command = buildManagedSkillPruneCommand({
      nextPaths: [],
      previousPaths: [
        "/opt/openclaw/home/workspace/skills/name-and-domain-research/SKILL.md",
        "/opt/openclaw/home/workspace/skills/name-and-domain-research/references/setup.md",
      ],
    })

    expect(command).toContain(
      "rm -rf '/opt/openclaw/home/workspace/skills/name-and-domain-research'",
    )
  })

  it("builds valid shell when multiple skill directories are removed", () => {
    const command = buildManagedSkillPruneCommand({
      nextPaths: [],
      previousPaths: [
        "/opt/openclaw/home/workspace/skills/linear-triage/SKILL.md",
        "/opt/openclaw/home/workspace/skills/random-color/SKILL.md",
        "/opt/openclaw/home/workspace/skills/test-skill/SKILL.md",
      ],
    })

    expect(command).toBeTruthy()
    execFileSync("bash", ["-n", "-c", command ?? ""])
  })
})

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
          headersBase64: Buffer.from(
            "content-type: application/json\r\n",
            "utf8",
          ).toString("base64"),
          status: 202,
        }),
      })),
      writeFileAtomic: vi.fn(async () => undefined),
    }
    const manager = new RuntimeManager(sshClient as never)

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
    })
  })

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
          headersBase64: Buffer.from(
            "content-type: application/json\r\n",
            "utf8",
          ).toString("base64"),
          status: 500,
        }),
      })),
      writeFileAtomic: vi.fn(async () => undefined),
    }
    const manager = new RuntimeManager(sshClient as never)

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
    ).rejects.toThrow("workspace chat plugin is not configured")

    expect(sshClient.writeFileAtomic).toHaveBeenCalled()
    expect(sshClient.exec).toHaveBeenCalled()
    const firstExecCall = sshClient.exec.mock.calls.at(0) as
      | unknown[]
      | undefined
    const executedCommand =
      firstExecCall && typeof firstExecCall[1] === "string"
        ? firstExecCall[1]
        : ""

    expect(executedCommand).toContain("/otto/workspace-chat/events")
    expect(executedCommand).toContain("authorization: Bearer gateway-token")
  })
})
