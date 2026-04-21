import { randomUUID } from "node:crypto";

import {
  getControlPlaneBaseUrl,
  getEnv,
  getOpenAiProxyBaseUrl,
  getOpenAiProxyTransport,
} from "../env";
import {
  OPENCLAW_GATEWAY_CONTAINER_PORT,
  OPENCLAW_GATEWAY_HOST_PORT,
  type OpenClawTenantConfig,
  OTTO_WEB_SEARCH_PROVIDER_ID,
  renderOpenClawConfig,
  TENANT_RUNTIME_SLACK_WEBHOOK_PATH,
} from "../openclaw/config";
import type { SshConnection } from "../ssh/client";
import { SshClient } from "../ssh/client";
import { resolveRuntimeWebSearchConfig } from "../web-search-config";

export type RuntimeFile = {
  path: string;
  contents: string;
  mode?: number;
};

export type ManagedBootstrapRuntimeFile = {
  filename: string;
  contents: string;
};

export type ManagedSkillRuntimeFile = {
  filename: string;
  contents: string;
  projectionMode?: "install_if_missing" | "managed_entry";
};

export type ManagedSkillRuntimeRenameOperation = {
  fromSkillKey: string;
  toSkillKey: string;
};

export type ManagedSkillRuntimeResetOperation = {
  scope: "companion_files";
  skillKey: string;
};

export type ApplyTenantConfigResult = {
  restartStderr: string;
  restartStdout: string;
  verifyStderr: string;
  verifyStdout: string;
};

export type WhatsAppLinkStatus = {
  linked: boolean;
  running: boolean;
  connected: boolean;
  authAgeMs: number | null;
  selfE164: string | null;
  selfJid: string | null;
  lastError: string | null;
};

export type ForwardedGatewayHttpResponse = {
  body: string;
  headers: Record<string, string>;
  status: number;
};

export type WorkspaceChatIngressAcceptanceResult = {
  accepted: true;
  ok: true;
  sessionKey: string;
};

const GATEWAY_HEALTH_MAX_DURATION_MS = 300_000;
const GATEWAY_HEALTH_MAX_POLL_INTERVAL_MS = 5_000;
const RUNTIME_START_HELPER_PATH =
  "/app/otto-helpers/start-runtime-with-watchers.mjs";
const WHATSAPP_QR_HELPER_PATH = "/app/otto-helpers/whatsapp-qr-login.mjs";
const MANAGED_SKILL_WORKSPACE_ROOT = "/opt/openclaw/home/workspace/skills";
const MANAGED_SKILL_MANIFEST_PATH =
  "/opt/openclaw/runtime/managed-skills-manifest.json";
const RUNTIME_CRON_ROOT = "/opt/openclaw/home/cron";
const RUNTIME_CRON_RUNS_ROOT = `${RUNTIME_CRON_ROOT}/runs`;
const MANAGED_SKILL_LOCAL_DIRECTORY_NAMES = [
  "references",
  "scripts",
  "state",
] as const;
const WORKSPACE_CHAT_HTTP_INGRESS_PATH = "/otto/workspace-chat/events";

export class RuntimeManager {
  constructor(private readonly sshClient = new SshClient()) {}

  async waitForHostBootstrap(connection: SshConnection): Promise<void> {
    await this.execChecked(
      connection,
      buildShellCommand([
        "cloud-init status --wait >/dev/null",
        "command -v docker >/dev/null",
        "systemctl is-active --quiet docker",
        "id openclaw >/dev/null",
      ]),
      { timeoutMs: getEnv().RUNTIME_SSH_READY_TIMEOUT_MS },
    );
  }

  async bootstrapTenantRuntime(
    connection: SshConnection,
    input: {
      tenantId: string;
      desiredStateVersion: number;
      gatewayToken: string;
      tenantToken: string;
      managedBootstrapFiles: ManagedBootstrapRuntimeFile[];
      managedSkillFiles: ManagedSkillRuntimeFile[];
      managedSkillResetOperations?: ManagedSkillRuntimeResetOperation[];
      managedSkillRenameOperations?: ManagedSkillRuntimeRenameOperation[];
      openClawConfig: OpenClawTenantConfig;
      slackBotToken?: string | null;
    },
  ): Promise<void> {
    await this.ensureRuntimeDirectories(connection);
    await this.writeTenantConfigFiles(connection, {
      desiredStateVersion: input.desiredStateVersion,
      gatewayToken: input.gatewayToken,
      tenantToken: input.tenantToken,
      managedBootstrapFiles: input.managedBootstrapFiles,
      managedSkillFiles: input.managedSkillFiles,
      managedSkillResetOperations: input.managedSkillResetOperations,
      managedSkillRenameOperations: input.managedSkillRenameOperations,
      metadataPath: "/opt/openclaw/runtime/bootstrap-metadata.json",
      metadataTimestampKey: "bootstrappedAt",
      openClawConfig: input.openClawConfig,
      slackBotToken: input.slackBotToken,
      tenantId: input.tenantId,
    });
    await this.verifyTenantConfigFiles(connection, {
      managedSkillFiles: input.managedSkillFiles,
      metadataPath: "/opt/openclaw/runtime/bootstrap-metadata.json",
      openClawConfig: input.openClawConfig,
    });
  }

  async restartGateway(connection: SshConnection): Promise<void> {
    await this.restartGatewayWithResult(connection);
  }

  async restartGatewayContainer(connection: SshConnection): Promise<void> {
    await this.restartGatewayWithResult(connection, {
      pullImage: false,
      strategy: "restart-container",
    });
    await this.checkGatewayHealth(connection);
  }

  async applyTenantConfig(
    connection: SshConnection,
    input: {
      desiredStateVersion: number;
      gatewayToken: string;
      tenantToken: string;
      managedBootstrapFiles: ManagedBootstrapRuntimeFile[];
      managedSkillFiles: ManagedSkillRuntimeFile[];
      managedSkillResetOperations?: ManagedSkillRuntimeResetOperation[];
      managedSkillRenameOperations?: ManagedSkillRuntimeRenameOperation[];
      openClawConfig: OpenClawTenantConfig;
      pullImageFirst?: boolean;
      slackBotToken?: string | null;
      tenantId: string;
    },
  ): Promise<ApplyTenantConfigResult> {
    await this.ensureRuntimeDirectories(connection);
    await this.writeTenantConfigFiles(connection, {
      desiredStateVersion: input.desiredStateVersion,
      gatewayToken: input.gatewayToken,
      tenantToken: input.tenantToken,
      managedBootstrapFiles: input.managedBootstrapFiles,
      managedSkillFiles: input.managedSkillFiles,
      managedSkillResetOperations: input.managedSkillResetOperations,
      managedSkillRenameOperations: input.managedSkillRenameOperations,
      metadataPath: "/opt/openclaw/runtime/apply-metadata.json",
      metadataTimestampKey: "appliedAt",
      openClawConfig: input.openClawConfig,
      slackBotToken: input.slackBotToken,
      tenantId: input.tenantId,
    });
    await this.verifyTenantConfigFiles(connection, {
      managedSkillFiles: input.managedSkillFiles,
      metadataPath: "/opt/openclaw/runtime/apply-metadata.json",
      openClawConfig: input.openClawConfig,
    });

    const restart = await this.restartGatewayWithResult(connection, {
      pullImage: input.pullImageFirst ?? false,
      // Docker restart preserves the container's original env; recreate is
      // required for changes in /opt/openclaw/home/.env to take effect.
      strategy: "recreate",
    });
    const verify = await this.checkGatewayHealthWithResult(connection);

    return {
      restartStderr: restart.stderr,
      restartStdout: restart.stdout,
      verifyStderr: verify.stderr,
      verifyStdout: verify.stdout,
    };
  }

  async readRuntimeEnvValue(
    connection: SshConnection,
    envVarName: string,
  ): Promise<string | null> {
    const result = await this.sshClient.exec(
      connection,
      buildShellCommand([
        `test -f /opt/openclaw/home/.env`,
        `source /opt/openclaw/home/.env >/dev/null 2>&1`,
        `printf '%s' "\${${envVarName}:-}"`,
      ]),
      { timeoutMs: 15_000 },
    );

    if (result.exitCode !== 0) {
      return null;
    }

    const value = result.stdout.trim();

    return value.length > 0 ? value : null;
  }

  async inspectGatewayImage(connection: SshConnection): Promise<string | null> {
    const result = await this.sshClient.exec(
      connection,
      buildShellCommand([
        "docker inspect openclaw-gateway --format '{{.Config.Image}}' 2>/dev/null || true",
      ]),
      { timeoutMs: 15_000 },
    );

    const image = result.stdout.trim();

    return image.length > 0 ? image : null;
  }

  async ensureRuntimeDirectories(connection: SshConnection) {
    await this.execChecked(
      connection,
      buildShellCommand([
        "mkdir -p /opt/openclaw/home/workspace",
        `mkdir -p ${shellQuoteForShell(MANAGED_SKILL_WORKSPACE_ROOT)}`,
        `mkdir -p ${shellQuoteForShell(RUNTIME_CRON_RUNS_ROOT)}`,
        "mkdir -p /opt/openclaw/runtime",
      ]),
    );
  }

  async writeTenantConfigFiles(
    connection: SshConnection,
    input: {
      desiredStateVersion: number;
      gatewayToken: string;
      tenantToken: string;
      managedBootstrapFiles: ManagedBootstrapRuntimeFile[];
      managedSkillFiles: ManagedSkillRuntimeFile[];
      managedSkillResetOperations?: ManagedSkillRuntimeResetOperation[];
      managedSkillRenameOperations?: ManagedSkillRuntimeRenameOperation[];
      metadataPath: string;
      metadataTimestampKey: string;
      openClawConfig: OpenClawTenantConfig;
      slackBotToken?: string | null;
      tenantId: string;
    },
  ) {
    const runtimeFiles = await buildTenantRuntimeFiles({
      desiredStateVersion: input.desiredStateVersion,
      gatewayToken: input.gatewayToken,
      tenantToken: input.tenantToken,
      managedBootstrapFiles: input.managedBootstrapFiles,
      managedSkillFiles: input.managedSkillFiles,
      metadataPath: input.metadataPath,
      metadataTimestampKey: input.metadataTimestampKey,
      openClawConfig: input.openClawConfig,
      slackBotToken: input.slackBotToken,
      tenantId: input.tenantId,
    });

    await this.moveManagedSkillDirectories(
      connection,
      input.managedSkillRenameOperations ?? [],
    );
    await this.applyTenantFiles(connection, runtimeFiles);
    await this.applyInstallOnlyManagedSkillFiles(
      connection,
      input.managedSkillFiles,
      input.managedSkillResetOperations ?? [],
    );
    await this.reconcileManagedSkillFiles(connection, input.managedSkillFiles);
    await this.normalizeTenantRuntimeFilePermissions(connection, {
      managedBootstrapFiles: input.managedBootstrapFiles,
      managedSkillFiles: input.managedSkillFiles,
      metadataPath: input.metadataPath,
    });
  }

  async verifyTenantConfigFiles(
    connection: SshConnection,
    input: {
      managedSkillFiles: ManagedSkillRuntimeFile[];
      metadataPath: string;
      openClawConfig: OpenClawTenantConfig;
    },
  ) {
    const commands = [
      "test -s /opt/openclaw/home/openclaw.json",
      "test -s /opt/openclaw/home/.env",
      "test -s /opt/openclaw/home/workspace/AGENTS.md",
      "test -s /opt/openclaw/home/workspace/IDENTITY.md",
      "test -s /opt/openclaw/home/workspace/SOUL.md",
      "test -s /opt/openclaw/home/workspace/USER.md",
      "test -s /opt/openclaw/home/workspace/TOOLS.md",
      `test -s ${shellQuoteForShell(input.metadataPath)}`,
    ];

    for (const file of input.managedSkillFiles) {
      commands.push(
        `test -s ${shellQuoteForShell(`/opt/openclaw/home/workspace/${file.filename}`)}`,
      );
    }

    if (input.openClawConfig.audio?.enabled) {
      const firstAudioModel = input.openClawConfig.audio.models[0]?.model;

      commands.push(
        "grep -F '\"audio\"' /opt/openclaw/home/openclaw.json >/dev/null",
      );

      if (firstAudioModel) {
        commands.push(
          `grep -F ${shellQuoteForShell(firstAudioModel)} /opt/openclaw/home/openclaw.json >/dev/null`,
        );
      }
    }

    if (input.openClawConfig.webSearch?.enabled) {
      commands.push(
        "grep -F '\"search\"' /opt/openclaw/home/openclaw.json >/dev/null",
        `grep -F ${shellQuoteForShell(OTTO_WEB_SEARCH_PROVIDER_ID)} /opt/openclaw/home/openclaw.json >/dev/null`,
      );
    }

    await this.execChecked(connection, buildShellCommand(commands));
  }

  async restartGatewayWithResult(
    connection: SshConnection,
    input: {
      pullImage?: boolean;
      strategy?: "recreate" | "restart-container";
    } = {},
  ) {
    if (input.strategy === "restart-container") {
      return await this.execChecked(
        connection,
        buildShellCommand(["docker restart openclaw-gateway >/dev/null"]),
        { timeoutMs: 60_000 },
      );
    }

    const image = getEnv().RUNTIME_OPENCLAW_IMAGE;
    const commands = [
      ...(input.pullImage === false
        ? []
        : [`docker pull ${shellQuoteForShell(image)}`]),
      [
        "if docker container inspect openclaw-gateway >/dev/null 2>&1; then",
        "docker rm -f openclaw-gateway >/dev/null;",
        "fi",
      ].join(" "),
      [
        "for attempt in $(seq 1 20); do",
        "if ! docker container inspect openclaw-gateway >/dev/null 2>&1; then",
        "break;",
        "fi;",
        "sleep 1;",
        "done",
      ].join(" "),
      [
        "if docker container inspect openclaw-gateway >/dev/null 2>&1; then",
        "echo 'openclaw-gateway container still exists after removal attempt' >&2;",
        "exit 1;",
        "fi",
      ].join(" "),
      [
        "docker run -d",
        "--name openclaw-gateway",
        "--restart unless-stopped",
        `-p 127.0.0.1:${OPENCLAW_GATEWAY_HOST_PORT}:${OPENCLAW_GATEWAY_CONTAINER_PORT}`,
        "--user 1000:1001",
        "--env-file /opt/openclaw/home/.env",
        "-v /opt/openclaw/home:/home/node/.openclaw",
        shellQuoteForShell(image),
        [
          "node",
          shellQuoteForShell(RUNTIME_START_HELPER_PATH),
          "--port",
          shellQuoteForShell(String(OPENCLAW_GATEWAY_CONTAINER_PORT)),
        ].join(" "),
      ].join(" "),
    ];

    return await this.execChecked(connection, buildShellCommand(commands), {
      timeoutMs: 300_000,
    });
  }

  async applyTenantFiles(connection: SshConnection, files: RuntimeFile[]) {
    await this.sshClient.writeFilesAtomic(
      connection,
      files.map((file) => ({
        contents: file.contents,
        mode: file.mode,
        targetPath: file.path,
      })),
    );
  }

  async normalizeTenantRuntimeFilePermissions(
    connection: SshConnection,
    input: {
      managedBootstrapFiles: ManagedBootstrapRuntimeFile[];
      managedSkillFiles: ManagedSkillRuntimeFile[];
      metadataPath: string;
    },
  ) {
    const managedFilePaths = input.managedBootstrapFiles.map(
      (file) => `/opt/openclaw/home/workspace/${file.filename}`,
    );
    const managedSkillPaths = input.managedSkillFiles.map(
      (file) => `/opt/openclaw/home/workspace/${file.filename}`,
    );
    const managedSkillDirectoryPaths = listManagedSkillDirectoryPaths(
      input.managedSkillFiles,
    );
    const managedSkillLocalDirectoryPaths = listManagedSkillLocalDirectoryPaths(
      input.managedSkillFiles,
    );

    const workspaceWritableDirectoryPaths = [
      "/opt/openclaw/home/workspace/memory",
      "/opt/openclaw/home/workspace/projects",
    ];

    const openClawOwnershipTargets = [
      "/opt/openclaw",
      "/opt/openclaw/home",
      RUNTIME_CRON_ROOT,
      RUNTIME_CRON_RUNS_ROOT,
      MANAGED_SKILL_WORKSPACE_ROOT,
      "/opt/openclaw/runtime",
      "/opt/openclaw/home/openclaw.json",
      "/opt/openclaw/home/.env",
      input.metadataPath,
      MANAGED_SKILL_MANIFEST_PATH,
      ...workspaceWritableDirectoryPaths,
      ...managedSkillDirectoryPaths,
      ...managedSkillLocalDirectoryPaths,
      ...managedSkillPaths,
    ];

    const protectedRootTargets = [
      "/opt/openclaw/home/workspace",
      ...managedFilePaths,
    ];

    const quotedOpenClawOwnershipTargets = openClawOwnershipTargets
      .map((path) => shellQuoteForShell(path))
      .join(" ");
    const quotedProtectedRootTargets = protectedRootTargets
      .map((path) => shellQuoteForShell(path))
      .join(" ");
    const quotedWorkspaceWritableDirectoryPaths = workspaceWritableDirectoryPaths
      .map((path) => shellQuoteForShell(path))
      .join(" ");

    const quotedManagedFilePaths = managedFilePaths
      .map((path) => shellQuoteForShell(path))
      .join(" ");
    const quotedManagedSkillDirectoryPaths = managedSkillDirectoryPaths
      .map((path) => shellQuoteForShell(path))
      .join(" ");
    const quotedManagedSkillLocalDirectoryPaths =
      managedSkillLocalDirectoryPaths
        .map((path) => shellQuoteForShell(path))
        .join(" ");
    const quotedManagedSkillPaths = managedSkillPaths
      .map((path) => shellQuoteForShell(path))
      .join(" ");

    const commands = [
      "install -d -o openclaw -g openclaw -m 750 /opt/openclaw /opt/openclaw/runtime",
      `install -d -o openclaw -g openclaw -m 700 /opt/openclaw/home /opt/openclaw/home/.cache /opt/openclaw/home/.cache/node-compile ${shellQuoteForShell(RUNTIME_CRON_ROOT)} ${shellQuoteForShell(RUNTIME_CRON_RUNS_ROOT)} ${shellQuoteForShell(MANAGED_SKILL_WORKSPACE_ROOT)}`,
      "install -d -o root -g openclaw -m 755 /opt/openclaw/home/workspace",
      `install -d -o openclaw -g openclaw -m 770 ${quotedWorkspaceWritableDirectoryPaths}`,
      ...(quotedManagedSkillDirectoryPaths.length > 0
        ? [
            `install -d -o openclaw -g openclaw -m 750 ${quotedManagedSkillDirectoryPaths}`,
          ]
        : []),
      ...(quotedManagedSkillLocalDirectoryPaths.length > 0
        ? [
            `install -d -o openclaw -g openclaw -m 770 ${quotedManagedSkillLocalDirectoryPaths}`,
          ]
        : []),
      "rm -f /opt/openclaw/home/workspace/USERS.md",
      `chown openclaw:openclaw ${quotedOpenClawOwnershipTargets}`,
      `chown root:openclaw ${quotedProtectedRootTargets}`,
      "chmod 750 /opt/openclaw /opt/openclaw/runtime",
      `chmod 700 /opt/openclaw/home /opt/openclaw/home/.cache /opt/openclaw/home/.cache/node-compile ${shellQuoteForShell(RUNTIME_CRON_ROOT)} ${shellQuoteForShell(RUNTIME_CRON_RUNS_ROOT)} ${shellQuoteForShell(MANAGED_SKILL_WORKSPACE_ROOT)}`,
      "chmod 755 /opt/openclaw/home/workspace",
      `chmod 770 ${quotedWorkspaceWritableDirectoryPaths}`,
      "chmod 600 /opt/openclaw/home/openclaw.json",
      "chmod 600 /opt/openclaw/home/.env",
      `chmod 640 ${shellQuoteForShell(MANAGED_SKILL_MANIFEST_PATH)}`,
      `chmod 640 ${shellQuoteForShell(input.metadataPath)}`,
    ];

    if (quotedManagedFilePaths.length > 0) {
      commands.push(`chmod 444 ${quotedManagedFilePaths}`);
    }

    if (quotedManagedSkillPaths.length > 0) {
      commands.push(`chmod 640 ${quotedManagedSkillPaths}`);
    }

    if (quotedManagedSkillDirectoryPaths.length > 0) {
      commands.push(`chmod 750 ${quotedManagedSkillDirectoryPaths}`);
    }

    if (quotedManagedSkillLocalDirectoryPaths.length > 0) {
      commands.push(`chmod 770 ${quotedManagedSkillLocalDirectoryPaths}`);
    }

    await this.execChecked(connection, buildShellCommand(commands));
  }

  async applyInstallOnlyManagedSkillFiles(
    connection: SshConnection,
    managedSkillFiles: ManagedSkillRuntimeFile[],
    resetOperations: ManagedSkillRuntimeResetOperation[] = [],
  ) {
    const resetSkillKeys = new Set(
      resetOperations
        .filter((operation) => operation.scope === "companion_files")
        .map((operation) => operation.skillKey),
    );

    for (const file of listInstallOnlyManagedSkillFiles(managedSkillFiles)) {
      const targetPath = `/opt/openclaw/home/workspace/${file.filename}`;

      if (shouldResetManagedSkillCompanionFile(file.filename, resetSkillKeys)) {
        await this.sshClient.writeFileAtomic(
          connection,
          targetPath,
          file.contents,
          0o640,
        );
        continue;
      }

      const existsResult = await this.sshClient.exec(
        connection,
        buildShellCommand([`test -e ${shellQuoteForShell(targetPath)}`]),
      );

      if (existsResult.exitCode === 0) {
        continue;
      }

      await this.sshClient.writeFileAtomic(
        connection,
        targetPath,
        file.contents,
        0o640,
      );
    }
  }

  async reconcileManagedSkillFiles(
    connection: SshConnection,
    managedSkillFiles: ManagedSkillRuntimeFile[],
  ) {
    const previousManifest = await this.readManagedSkillManifest(connection);
    const nextManifest = buildManagedSkillManifest(managedSkillFiles);
    const pruneCommand = buildManagedSkillPruneCommand({
      nextPaths: nextManifest.files,
      previousPaths: previousManifest.files,
    });

    if (pruneCommand) {
      await this.execChecked(connection, buildShellCommand([pruneCommand]));
    }

    await this.sshClient.writeFileAtomic(
      connection,
      MANAGED_SKILL_MANIFEST_PATH,
      JSON.stringify(nextManifest, null, 2),
      0o640,
    );
  }

  async moveManagedSkillDirectories(
    connection: SshConnection,
    renameOperations: ManagedSkillRuntimeRenameOperation[],
  ) {
    const renameCommand = buildManagedSkillRenameCommand(renameOperations);

    if (!renameCommand) {
      return;
    }

    await this.execChecked(connection, buildShellCommand([renameCommand]));
  }

  async readManagedSkillManifest(
    connection: SshConnection,
  ): Promise<{ files: string[] }> {
    const result = await this.sshClient.exec(
      connection,
      buildShellCommand([
        [
          `if test -f ${shellQuoteForShell(MANAGED_SKILL_MANIFEST_PATH)}; then`,
          `cat ${shellQuoteForShell(MANAGED_SKILL_MANIFEST_PATH)};`,
          "else",
          `printf '%s' ${shellQuoteForShell('{"files":[]}')};`,
          "fi",
        ].join(" "),
      ]),
    );

    if (result.exitCode !== 0) {
      throw new Error(
        `Failed to read managed skill manifest: ${result.stderr || result.stdout}`,
      );
    }

    try {
      return parseManagedSkillManifest(result.stdout);
    } catch {
      return { files: [] };
    }
  }

  async checkGatewayHealth(connection: SshConnection): Promise<void> {
    await this.checkGatewayHealthWithResult(connection);
  }

  async checkGatewayHealthWithResult(connection: SshConnection) {
    try {
      const deadline = Date.now() + GATEWAY_HEALTH_MAX_DURATION_MS;

      for (let attempt = 1; ; attempt += 1) {
        const result = await this.sshClient.exec(
          connection,
          buildShellCommand([
            "docker ps --filter name=openclaw-gateway --filter status=running --format '{{.Names}}' | grep -x openclaw-gateway >/dev/null",
            `curl -fsS http://127.0.0.1:${OPENCLAW_GATEWAY_HOST_PORT}/healthz`,
          ]),
          { timeoutMs: 30_000 },
        );

        if (result.exitCode === 0) {
          return result;
        }

        const status = await this.getGatewayStatusSummary(connection);

        console.info(
          `[worker] gateway health check attempt ${attempt}: waiting for ${connection.host}:${OPENCLAW_GATEWAY_HOST_PORT} (container ${status})`,
        );

        const remainingMs = deadline - Date.now();

        if (remainingMs <= 0) {
          break;
        }

        await sleep(
          Math.min(getGatewayHealthPollDelayMs(attempt), remainingMs),
        );
      }

      throw new Error(
        `Gateway health check did not succeed within ${Math.round(GATEWAY_HEALTH_MAX_DURATION_MS / 1000)}s`,
      );
    } catch (error) {
      const diagnostics = await this.getGatewayDiagnostics(connection);
      const message = error instanceof Error ? error.message : "Unknown error";

      throw new Error(`${message}\n\nGateway diagnostics:\n${diagnostics}`);
    }
  }

  async invokeGatewayTool(
    connection: SshConnection,
    input: {
      action?: string;
      args?: Record<string, unknown>;
      tool: string;
    },
  ): Promise<Record<string, unknown>> {
    const body = JSON.stringify({
      ...(input.action ? { action: input.action } : {}),
      ...(input.args ? { args: input.args } : {}),
      tool: input.tool,
    });
    const command = buildShellCommand([
      "test -f /opt/openclaw/home/.env",
      "source /opt/openclaw/home/.env >/dev/null 2>&1",
      `curl -fsS http://127.0.0.1:${OPENCLAW_GATEWAY_HOST_PORT}/tools/invoke -H "Authorization: Bearer $OPENCLAW_GATEWAY_TOKEN" -H "Content-Type: application/json" -d ${shellQuoteForShell(body)}`,
    ]);
    const result = await this.execChecked(connection, command, {
      timeoutMs: 60_000,
    });

    return parseToolInvokePayload(result.stdout);
  }

  async forwardWorkspaceChatIngressRequest(
    connection: SshConnection,
    input: {
      assistantMessageId?: string;
      conversationKind: "ad_hoc" | "durable_named" | "external_surface";
      conversationId: string;
      conversationTitle: string;
      conversationVisibility: "open" | "personal";
      gatewayToken: string;
      parts: WorkspaceChatMessagePart[];
      senderDisplayName: string;
      senderExternalId: string;
      timeoutMs?: number;
      userMessageId: string;
    },
  ): Promise<WorkspaceChatIngressAcceptanceResult> {
    const body = JSON.stringify({
      ...(input.assistantMessageId
        ? { assistantMessageId: input.assistantMessageId }
        : {}),
      conversationKind: input.conversationKind,
      conversationId: input.conversationId,
      conversationTitle: input.conversationTitle,
      conversationVisibility: input.conversationVisibility,
      parts: input.parts,
      senderDisplayName: input.senderDisplayName,
      senderExternalId: input.senderExternalId,
      userMessageId: input.userMessageId,
    });

    console.info("[workspace-chat] runtime manager posting tenant ingress request", {
      assistantMessageId: input.assistantMessageId ?? null,
      conversationId: input.conversationId,
      host: connection.host,
      partsCount: input.parts.length,
      timeoutMs: input.timeoutMs ?? 30_000,
    });

    const response = await this.forwardGatewayHttpRequest(connection, {
      body,
      headers: {
        authorization: `Bearer ${input.gatewayToken}`,
        "content-type": "application/json",
      },
      path: WORKSPACE_CHAT_HTTP_INGRESS_PATH,
      timeoutMs: input.timeoutMs ?? 30_000,
    });

    console.info("[workspace-chat] runtime manager tenant ingress returned", {
      assistantMessageId: input.assistantMessageId ?? null,
      conversationId: input.conversationId,
      host: connection.host,
      status: response.status,
    });

    return parseWorkspaceChatHttpIngressPayload(response);
  }

  async forwardSlackHttpRequest(
    connection: SshConnection,
    input: {
      body: string;
      headers: Record<string, string>;
      path?: string;
      timeoutMs?: number;
    },
  ): Promise<ForwardedGatewayHttpResponse> {
    return await this.forwardGatewayHttpRequest(connection, {
      body: input.body,
      headers: input.headers,
      path: input.path ?? TENANT_RUNTIME_SLACK_WEBHOOK_PATH,
      timeoutMs: input.timeoutMs,
    });
  }

  private async forwardGatewayHttpRequest(
    connection: SshConnection,
    input: {
      body: string;
      headers: Record<string, string>;
      path: string;
      timeoutMs?: number;
    },
  ): Promise<ForwardedGatewayHttpResponse> {
    const requestBodyPath = `/tmp/otto-plugin-ingress-${randomUUID()}.body`;
    await this.sshClient.writeFileAtomic(
      connection,
      requestBodyPath,
      input.body,
      0o600,
    );

    const forwardedHeaders = Object.entries(input.headers)
      .filter(([, value]) => value.trim().length > 0)
      .map(([name, value]) => `-H ${shellQuoteForShell(`${name}: ${value}`)}`)
      .join(" ");
    const targetUrl = `http://127.0.0.1:${OPENCLAW_GATEWAY_HOST_PORT}${input.path}`;
    const script = [
      "set -euo pipefail",
      `request_body_path=${shellQuoteForShell(requestBodyPath)}`,
      "response_body=$(mktemp /tmp/otto-plugin-response-body.XXXXXX)",
      "response_headers=$(mktemp /tmp/otto-plugin-response-headers.XXXXXX)",
      'trap \'rm -f "$request_body_path" "$response_body" "$response_headers"\' EXIT',
      [
        "status=$(curl -sS",
        `--max-time ${Math.max(5, Math.ceil((input.timeoutMs ?? 30_000) / 1000))}`,
        '-o "$response_body"',
        '-D "$response_headers"',
        "-X POST",
        forwardedHeaders,
        '--data-binary @"$request_body_path"',
        shellQuoteForShell(targetUrl),
        "-w '%{http_code}')",
      ]
        .filter(Boolean)
        .join(" "),
      [
        'printf \'{"status":%s,"headersBase64":"%s","bodyBase64":"%s"}\'',
        '"$status"',
        '"$(base64 < "$response_headers" | tr -d \'\\n\')"',
        '"$(base64 < "$response_body" | tr -d \'\\n\')"',
      ].join(" "),
    ].join("\n");
    const result = await this.sshClient.exec(
      connection,
      `bash -lc ${shellQuote(script)}`,
      { timeoutMs: Math.max((input.timeoutMs ?? 30_000) + 5_000, 20_000) },
    );

    if (result.exitCode !== 0) {
      throw new Error(
        `Tenant gateway HTTP forward failed: ${result.stderr || result.stdout || "Remote command failed"}`,
      );
    }

    return parseForwardedGatewayHttpPayload(result.stdout);
  }

  async startWhatsAppLoginWithQr(
    connection: SshConnection,
    input: {
      force?: boolean;
      timeoutMs?: number;
    },
  ) {
    const result = await this.invokeWhatsAppQrHelper(connection, {
      command: "start",
      helperTimeoutMs: Math.max(input.timeoutMs ?? 0, 60_000),
      timeoutMs: Math.max((input.timeoutMs ?? 0) + 15_000, 60_000),
      ...(typeof input.force === "boolean" ? { force: input.force } : {}),
    });

    return result as {
      events?: Array<{ at?: string; message?: string }>;
      message: string;
      qrDataUrl?: string;
      self?: {
        e164?: string | null;
        jid?: string | null;
      } | null;
    };
  }

  async waitForWhatsAppLogin(
    connection: SshConnection,
    input: {
      timeoutMs?: number;
    },
  ) {
    const result = await this.invokeWhatsAppQrHelper(connection, {
      command: "wait",
      helperTimeoutMs: input.timeoutMs,
      timeoutMs: Math.max((input.timeoutMs ?? 0) + 15_000, 60_000),
    });

    return result as {
      connected: boolean;
      events?: Array<{ at?: string; message?: string }>;
      message: string;
      self?: {
        e164?: string | null;
        jid?: string | null;
      } | null;
    };
  }

  async readWhatsAppQrHelperStatus(connection: SshConnection) {
    const result = await this.invokeWhatsAppQrHelper(connection, {
      command: "status",
      timeoutMs: 30_000,
    });

    return result as {
      state?: Record<string, unknown> | null;
    };
  }

  async readGatewayStatusJson(connection: SshConnection) {
    const result = await this.execChecked(
      connection,
      buildShellCommand([
        "docker ps --filter name=openclaw-gateway --filter status=running --format '{{.Names}}' | grep -x openclaw-gateway >/dev/null",
        "docker exec openclaw-gateway node dist/index.js status --json",
      ]),
      { timeoutMs: 60_000 },
    );

    return parseJsonObject(result.stdout);
  }

  async readWhatsAppLinkStatus(
    connection: SshConnection,
  ): Promise<WhatsAppLinkStatus> {
    const result = await this.execChecked(
      connection,
      buildShellCommand([
        "docker ps --filter name=openclaw-gateway --filter status=running --format '{{.Names}}' | grep -x openclaw-gateway >/dev/null",
        "docker exec openclaw-gateway node dist/index.js channels status --json",
      ]),
      { timeoutMs: 60_000 },
    );

    const payload = parseJsonObject(result.stdout);
    const channels = asRecord(payload.channels);
    const whatsappChannel = asRecord(channels?.whatsapp);
    const channelSelf = asRecord(whatsappChannel?.self);
    const channelAccounts = asRecord(payload.channelAccounts);
    const rawWhatsAppAccounts = channelAccounts?.whatsapp;
    const whatsappAccounts = Array.isArray(rawWhatsAppAccounts)
      ? rawWhatsAppAccounts
      : [];
    const rawAccount =
      whatsappAccounts.find(
        (account) => asRecord(account)?.accountId === "default",
      ) ?? whatsappAccounts[0];
    const account = asRecord(rawAccount);
    const self = asRecord(account?.self);

    return {
      authAgeMs:
        typeof account?.authAgeMs === "number" &&
        Number.isFinite(account.authAgeMs)
          ? account.authAgeMs
          : null,
      connected: account?.connected === true,
      lastError:
        typeof account?.lastError === "string" &&
        account.lastError.trim().length > 0
          ? account.lastError.trim()
          : null,
      linked: account?.linked === true,
      running: account?.running === true,
      selfE164:
        typeof channelSelf?.e164 === "string" &&
        channelSelf.e164.trim().length > 0
          ? channelSelf.e164.trim()
          : typeof self?.e164 === "string" && self.e164.trim().length > 0
            ? self.e164.trim()
            : null,
      selfJid:
        typeof channelSelf?.jid === "string" &&
        channelSelf.jid.trim().length > 0
          ? channelSelf.jid.trim()
          : null,
    };
  }

  async readWhatsAppSelfId(connection: SshConnection) {
    const status = await this.readWhatsAppLinkStatus(connection);
    return {
      e164: status.selfE164,
      jid: status.selfJid,
    };
  }

  async logoutWhatsApp(connection: SshConnection) {
    await this.execChecked(
      connection,
      buildShellCommand([
        "docker ps --filter name=openclaw-gateway --filter status=running --format '{{.Names}}' | grep -x openclaw-gateway >/dev/null",
        "docker exec openclaw-gateway node dist/index.js channels logout --channel whatsapp",
      ]),
      { timeoutMs: 60_000 },
    );
  }

  private async invokeWhatsAppQrHelper(
    connection: SshConnection,
    input: {
      command: "start" | "status" | "wait";
      force?: boolean;
      helperTimeoutMs?: number;
      timeoutMs?: number;
    },
  ) {
    const helperArgs = [
      shellQuoteForShell(input.command),
      "--account-id",
      shellQuoteForShell("default"),
    ];

    if (input.force) {
      helperArgs.push("--force");
    }

    if (typeof input.helperTimeoutMs === "number") {
      helperArgs.push(
        "--timeout-ms",
        shellQuoteForShell(String(input.helperTimeoutMs)),
      );
    }

    const result = await this.execChecked(
      connection,
      buildShellCommand([
        "docker ps --filter name=openclaw-gateway --filter status=running --format '{{.Names}}' | grep -x openclaw-gateway >/dev/null",
        [
          "docker exec openclaw-gateway",
          "node",
          shellQuoteForShell(WHATSAPP_QR_HELPER_PATH),
          ...helperArgs,
        ].join(" "),
      ]),
      { timeoutMs: input.timeoutMs ?? 60_000 },
    );

    return parseJsonObject(result.stdout);
  }

  private async execChecked(
    connection: SshConnection,
    command: string,
    options?: { timeoutMs?: number },
  ) {
    const result = await this.sshClient.exec(connection, command, options);

    if (result.exitCode !== 0) {
      throw new Error(
        `Remote command failed with exit code ${result.exitCode ?? "unknown"}: ${result.stderr || result.stdout || command}`,
      );
    }

    return result;
  }

  private async getGatewayDiagnostics(connection: SshConnection) {
    const result = await this.sshClient.exec(
      connection,
      buildShellCommand([
        "echo '=== docker ps ==='",
        "docker ps -a --filter name=openclaw-gateway --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'",
        "echo",
        "echo '=== docker inspect ==='",
        "docker inspect openclaw-gateway --format 'status={{.State.Status}} restartCount={{.RestartCount}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} exitCode={{.State.ExitCode}} error={{.State.Error}}' 2>/dev/null || true",
        "echo",
        "echo '=== docker logs ==='",
        "docker logs openclaw-gateway --tail 200 2>&1 || true",
      ]),
      { timeoutMs: 30_000 },
    );

    return (
      result.stdout ||
      result.stderr ||
      "No diagnostics available"
    ).trim();
  }

  private async getGatewayStatusSummary(connection: SshConnection) {
    const result = await this.sshClient.exec(
      connection,
      buildShellCommand([
        "docker inspect openclaw-gateway --format 'status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} restartCount={{.RestartCount}} exitCode={{.State.ExitCode}}' 2>/dev/null || echo 'missing'",
      ]),
      { timeoutMs: 15_000 },
    );

    return (result.stdout || result.stderr || "unknown").trim();
  }
}

function buildShellCommand(commands: string[]) {
  return `bash -lc ${shellQuote(commands.join(" && "))}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function shellQuoteForShell(value: string) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function getGatewayHealthPollDelayMs(attempt: number) {
  if (attempt <= 1) {
    return 1_000;
  }

  if (attempt === 2) {
    return 2_000;
  }

  if (attempt === 3) {
    return 3_000;
  }

  return GATEWAY_HEALTH_MAX_POLL_INTERVAL_MS;
}

async function buildRuntimeEnvFile(input: {
  gatewayToken: string;
  tenantToken: string;
  slackBotToken?: string | null;
}) {
  const lines = [`OPENCLAW_GATEWAY_TOKEN=${input.gatewayToken}`];
  lines.push(`TENANT_TOKEN=${input.tenantToken}`);
  const controlPlaneBaseUrl = getControlPlaneBaseUrl();
  const openAiProxyBaseUrl = getOpenAiProxyBaseUrl();
  const webSearch = resolveRuntimeWebSearchConfig();

  if (controlPlaneBaseUrl) {
    lines.push(`OTTO_CONTROL_PLANE_BASE_URL=${controlPlaneBaseUrl}`);
  }

  if (openAiProxyBaseUrl) {
    lines.push(`OTTO_OPENAI_PROXY_BASE_URL=${openAiProxyBaseUrl}`);
  }
  lines.push(`OTTO_OPENAI_PROXY_TRANSPORT=${getOpenAiProxyTransport()}`);

  if (input.slackBotToken) {
    lines.push(`SLACK_BOT_TOKEN=${input.slackBotToken}`);
  }

  lines.push(...webSearch.envLines);

  return `${lines.join("\n")}\n`;
}

async function buildTenantRuntimeFiles(input: {
  desiredStateVersion: number;
  gatewayToken: string;
  tenantToken: string;
  managedBootstrapFiles: ManagedBootstrapRuntimeFile[];
  managedSkillFiles: ManagedSkillRuntimeFile[];
  metadataPath: string;
  metadataTimestampKey: string;
  openClawConfig: OpenClawTenantConfig;
  slackBotToken?: string | null;
  tenantId: string;
}): Promise<RuntimeFile[]> {
  return [
    ...input.managedBootstrapFiles.map((file) => ({
      contents: file.contents,
      mode: 0o640,
      path: `/opt/openclaw/home/workspace/${file.filename}`,
    })),
    ...listManagedEntryRuntimeFiles(input.managedSkillFiles).map((file) => ({
      contents: file.contents,
      mode: 0o640,
      path: `/opt/openclaw/home/workspace/${file.filename}`,
    })),
    {
      path: "/opt/openclaw/home/openclaw.json",
      contents: renderOpenClawConfig(input.openClawConfig),
      mode: 0o640,
    },
    {
      path: "/opt/openclaw/home/.env",
      contents: await buildRuntimeEnvFile({
        gatewayToken: input.gatewayToken,
        tenantToken: input.tenantToken,
        slackBotToken: input.slackBotToken,
      }),
      mode: 0o600,
    },
    {
      path: input.metadataPath,
      contents: JSON.stringify(
        {
          desiredStateVersion: input.desiredStateVersion,
          [input.metadataTimestampKey]: new Date().toISOString(),
          tenantId: input.tenantId,
        },
        null,
        2,
      ),
      mode: 0o640,
    },
  ];
}

export function listManagedEntryRuntimeFiles(
  managedSkillFiles: ManagedSkillRuntimeFile[],
) {
  return managedSkillFiles.filter(
    (file) => (file.projectionMode ?? "managed_entry") === "managed_entry",
  );
}

export function listInstallOnlyManagedSkillFiles(
  managedSkillFiles: ManagedSkillRuntimeFile[],
) {
  return managedSkillFiles.filter(
    (file) => file.projectionMode === "install_if_missing",
  );
}

function shouldResetManagedSkillCompanionFile(
  filename: string,
  resetSkillKeys: Set<string>,
) {
  const normalizedFilename = filename.trim().replaceAll("\\", "/");

  if (!normalizedFilename.startsWith("skills/")) {
    return false;
  }

  const skillKey = normalizedFilename.split("/", 3)[1];

  return typeof skillKey === "string" && resetSkillKeys.has(skillKey);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonObject(value: string) {
  const parsed = JSON.parse(value);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected a JSON object from tenant runtime");
  }

  return parsed as Record<string, unknown>;
}

function parseToolInvokePayload(value: string) {
  const envelope = parseJsonObject(value);

  if (envelope.ok !== true) {
    const error =
      envelope.error &&
      typeof envelope.error === "object" &&
      !Array.isArray(envelope.error)
        ? (envelope.error as Record<string, unknown>)
        : {};
    const message =
      typeof error.message === "string"
        ? error.message
        : "Tenant runtime tool invocation failed";
    throw new Error(message);
  }

  const result =
    envelope.result &&
    typeof envelope.result === "object" &&
    !Array.isArray(envelope.result)
      ? (envelope.result as Record<string, unknown>)
      : null;
  const details = result?.details;

  if (details && typeof details === "object" && !Array.isArray(details)) {
    return details as Record<string, unknown>;
  }

  throw new Error(
    "Tenant runtime tool response did not include a JSON payload",
  );
}

function extractWorkspaceChatGatewayError(payload: Record<string, unknown>) {
  const directError =
    typeof payload.error === "string" && payload.error.trim().length > 0
      ? payload.error.trim()
      : null;

  if (directError) {
    return directError;
  }

  const errorObject =
    payload.error &&
    typeof payload.error === "object" &&
    !Array.isArray(payload.error)
      ? (payload.error as Record<string, unknown>)
      : null;

  if (
    typeof errorObject?.message === "string" &&
    errorObject.message.trim().length > 0
  ) {
    return errorObject.message.trim();
  }

  const details =
    payload.details &&
    typeof payload.details === "object" &&
    !Array.isArray(payload.details)
      ? (payload.details as Record<string, unknown>)
      : null;

  if (
    typeof details?.error === "string" &&
    details.error.trim().length > 0
  ) {
    return details.error.trim();
  }

  if (
    typeof details?.message === "string" &&
    details.message.trim().length > 0
  ) {
    return details.message.trim();
  }

  return null;
}

function parseWorkspaceChatHttpIngressPayload(
  response: ForwardedGatewayHttpResponse,
): WorkspaceChatIngressAcceptanceResult {
  const payload =
    response.body.trim().length > 0 ? parseJsonObject(response.body) : {};
  const sessionKey = payload.sessionKey;
  const explicitError = extractWorkspaceChatGatewayError(payload);

  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      explicitError ||
        `Tenant runtime workspace chat ingress returned ${response.status}`,
    );
  }

  if (payload.ok !== true || payload.accepted !== true) {
    throw new Error(
      explicitError || "Tenant runtime workspace chat ingress did not acknowledge the event",
    );
  }

  if (typeof sessionKey !== "string" || sessionKey.length === 0) {
    throw new Error(
      explicitError ||
        "Tenant runtime workspace chat ingress did not return a sessionKey",
    );
  }

  return {
    accepted: true,
    ok: true,
    sessionKey,
  };
}

function parseForwardedGatewayHttpPayload(
  value: string,
): ForwardedGatewayHttpResponse {
  const envelope = parseJsonObject(value);
  const status = envelope.status;

  if (typeof status !== "number") {
    throw new Error("Tenant runtime forwarded HTTP response is missing status");
  }

  const headersRaw = Buffer.from(
    typeof envelope.headersBase64 === "string" ? envelope.headersBase64 : "",
    "base64",
  ).toString("utf8");
  const body = Buffer.from(
    typeof envelope.bodyBase64 === "string" ? envelope.bodyBase64 : "",
    "base64",
  ).toString("utf8");

  return {
    body,
    headers: parseRawHttpHeaders(headersRaw),
    status,
  };
}

function parseRawHttpHeaders(value: string) {
  const headers: Record<string, string> = {};

  for (const line of value.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("HTTP/")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf(":");

    if (separatorIndex <= 0) {
      continue;
    }

    const name = trimmed.slice(0, separatorIndex).trim().toLowerCase();
    const headerValue = trimmed.slice(separatorIndex + 1).trim();

    if (!name || !headerValue) {
      continue;
    }

    headers[name] = headerValue;
  }

  return headers;
}

export function buildManagedSkillManifest(
  managedSkillFiles: ManagedSkillRuntimeFile[],
) {
  return {
    files: [
      ...new Set(
        managedSkillFiles.map(
          (file) => `/opt/openclaw/home/workspace/${file.filename}`,
        ),
      ),
    ].sort((left, right) => left.localeCompare(right)),
  };
}

export function parseManagedSkillManifest(value: string): { files: string[] } {
  const parsed = parseJsonObject(value);
  const files = Array.isArray(parsed.files)
    ? parsed.files.filter((entry): entry is string => typeof entry === "string")
    : [];

  return {
    files: [...new Set(files)].sort((left, right) => left.localeCompare(right)),
  };
}

export function buildManagedSkillPruneCommand(input: {
  nextPaths: string[];
  previousPaths: string[];
}) {
  const nextPaths = new Set(input.nextPaths);
  const removedPathCandidates = [...new Set(input.previousPaths)]
    .filter((path) => path.startsWith(`${MANAGED_SKILL_WORKSPACE_ROOT}/`))
    .filter((path) => !isManagedSkillLocalPath(path))
    .filter((path) => !nextPaths.has(path))
    .sort((left, right) => left.localeCompare(right));
  const nextSkillRoots = new Set(
    input.nextPaths.flatMap((path) => {
      const skillRoot = getManagedSkillRootPath(path);

      return skillRoot ? [skillRoot] : [];
    }),
  );
  const removedSkillRoots = [
    ...new Set(
      removedPathCandidates.flatMap((path) => {
        const skillRoot = getManagedSkillRootPath(path);

        if (!skillRoot || nextSkillRoots.has(skillRoot)) {
          return [];
        }

        return [skillRoot];
      }),
    ),
  ].sort((left, right) => right.length - left.length || left.localeCompare(right));
  const removedSkillRootSet = new Set(removedSkillRoots);
  const removedPaths = removedPathCandidates.filter((path) => {
    const skillRoot = getManagedSkillRootPath(path);

    return !skillRoot || !removedSkillRootSet.has(skillRoot);
  });

  if (removedPaths.length === 0 && removedSkillRoots.length === 0) {
    return null;
  }

  const directorySet = new Set<string>();

  for (const removedPath of removedPaths) {
    let currentDirectory = removedPath.slice(0, removedPath.lastIndexOf("/"));

    while (currentDirectory.startsWith(`${MANAGED_SKILL_WORKSPACE_ROOT}/`)) {
      directorySet.add(currentDirectory);
      currentDirectory = currentDirectory.slice(
        0,
        currentDirectory.lastIndexOf("/"),
      );
    }
  }

  const directories = [...directorySet].sort(
    (left, right) => right.length - left.length || left.localeCompare(right),
  );

  return [
    ...removedSkillRoots.map(
      (path) =>
        `if test -d ${shellQuoteForShell(path)}; then rm -rf ${shellQuoteForShell(path)}; fi`,
    ),
    ...removedPaths.map(
      (path) =>
        `if test -f ${shellQuoteForShell(path)}; then rm -f ${shellQuoteForShell(path)}; fi`,
    ),
    ...directories.map(
      (directory) =>
        `rmdir ${shellQuoteForShell(directory)} >/dev/null 2>&1 || true`,
    ),
  ].join("; ");
}

function getManagedSkillRootPath(path: string) {
  const rootPrefix = `${MANAGED_SKILL_WORKSPACE_ROOT}/`;

  if (!path.startsWith(rootPrefix)) {
    return null;
  }

  const relativePath = path.slice(rootPrefix.length);
  const [skillKey] = relativePath.split("/");

  if (!skillKey) {
    return null;
  }

  return `${rootPrefix}${skillKey}`;
}

export function buildManagedSkillRenameCommand(
  renameOperations: ManagedSkillRuntimeRenameOperation[],
) {
  const commands = renameOperations
    .filter(
      (operation) =>
        operation.fromSkillKey.trim().length > 0 &&
        operation.toSkillKey.trim().length > 0 &&
        operation.fromSkillKey !== operation.toSkillKey,
    )
    .map((operation) => {
      const fromPath = `${MANAGED_SKILL_WORKSPACE_ROOT}/${operation.fromSkillKey}`;
      const toPath = `${MANAGED_SKILL_WORKSPACE_ROOT}/${operation.toSkillKey}`;

      return [
        `if test -e ${shellQuoteForShell(fromPath)}; then`,
        `if ! test -d ${shellQuoteForShell(fromPath)}; then`,
        `echo ${shellQuoteForShell(`Managed skill source path is not a directory: ${fromPath}`)} >&2;`,
        "exit 1;",
        "fi;",
        `if test -e ${shellQuoteForShell(toPath)}; then`,
        `echo ${shellQuoteForShell(`Managed skill destination already exists: ${toPath}`)} >&2;`,
        "exit 1;",
        "fi;",
        `mv ${shellQuoteForShell(fromPath)} ${shellQuoteForShell(toPath)};`,
        `elif test -e ${shellQuoteForShell(toPath)}; then`,
        ":;",
        "else",
        ":;",
        "fi",
      ].join(" ");
    });

  if (commands.length === 0) {
    return null;
  }

  return commands.join(" ");
}

function listManagedSkillDirectoryPaths(
  managedSkillFiles: ManagedSkillRuntimeFile[],
) {
  return [
    ...new Set(
      managedSkillFiles.map((file) => {
        const pathSegments = file.filename.split("/").filter(Boolean);
        const skillKey = pathSegments[1];

        if (!skillKey) {
          return pathDirname(`/opt/openclaw/home/workspace/${file.filename}`);
        }

        return `${MANAGED_SKILL_WORKSPACE_ROOT}/${skillKey}`;
      }),
    ),
  ].sort((left, right) => left.localeCompare(right));
}

function listManagedSkillLocalDirectoryPaths(
  managedSkillFiles: ManagedSkillRuntimeFile[],
) {
  return listManagedSkillDirectoryPaths(managedSkillFiles)
    .flatMap((skillDirectoryPath) =>
      MANAGED_SKILL_LOCAL_DIRECTORY_NAMES.map(
        (directoryName) => `${skillDirectoryPath}/${directoryName}`,
      ),
    )
    .sort((left, right) => left.localeCompare(right));
}

function isManagedSkillLocalPath(path: string) {
  return MANAGED_SKILL_LOCAL_DIRECTORY_NAMES.some((directoryName) =>
    path.includes(`/${directoryName}/`),
  );
}

function pathDirname(path: string) {
  const lastSlashIndex = path.lastIndexOf("/");

  if (lastSlashIndex <= 0) {
    return path;
  }

  return path.slice(0, lastSlashIndex);
}
import type { WorkspaceChatMessagePart } from "@otto/feature-workspace-chat";
