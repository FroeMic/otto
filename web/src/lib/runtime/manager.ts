import { getControlPlaneBaseUrl, getEnv } from "@/lib/env";
import {
  OPENCLAW_GATEWAY_CONTAINER_PORT,
  OPENCLAW_GATEWAY_HOST_PORT,
  type OpenClawTenantConfig,
  renderOpenClawConfig,
} from "@/lib/openclaw/config";
import type { SshConnection } from "@/lib/ssh/client";
import { SshClient } from "@/lib/ssh/client";

export type RuntimeFile = {
  path: string;
  contents: string;
  mode?: number;
};

export type ManagedBootstrapRuntimeFile = {
  filename: string;
  contents: string;
};

export type ApplyTenantConfigResult = {
  restartStderr: string;
  restartStdout: string;
  verifyStderr: string;
  verifyStdout: string;
};

const GATEWAY_HEALTH_POLL_INTERVAL_MS = 15_000;
const GATEWAY_HEALTH_MAX_ATTEMPTS = 20;

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
      managedBootstrapFiles: ManagedBootstrapRuntimeFile[];
      openClawConfig: OpenClawTenantConfig;
      slackBotToken?: string | null;
    },
  ): Promise<void> {
    await this.ensureRuntimeDirectories(connection);
    await this.writeTenantConfigFiles(connection, {
      desiredStateVersion: input.desiredStateVersion,
      gatewayToken: input.gatewayToken,
      managedBootstrapFiles: input.managedBootstrapFiles,
      metadataPath: "/opt/openclaw/runtime/bootstrap-metadata.json",
      metadataTimestampKey: "bootstrappedAt",
      openClawConfig: input.openClawConfig,
      slackBotToken: input.slackBotToken,
      tenantId: input.tenantId,
    });
    await this.verifyTenantConfigFiles(connection, {
      metadataPath: "/opt/openclaw/runtime/bootstrap-metadata.json",
      openClawConfig: input.openClawConfig,
    });
  }

  async restartGateway(connection: SshConnection): Promise<void> {
    await this.restartGatewayWithResult(connection);
  }

  async applyTenantConfig(
    connection: SshConnection,
    input: {
      desiredStateVersion: number;
      gatewayToken: string;
      managedBootstrapFiles: ManagedBootstrapRuntimeFile[];
      openClawConfig: OpenClawTenantConfig;
      slackBotToken?: string | null;
      tenantId: string;
    },
  ): Promise<ApplyTenantConfigResult> {
    await this.ensureRuntimeDirectories(connection);
    await this.writeTenantConfigFiles(connection, {
      desiredStateVersion: input.desiredStateVersion,
      gatewayToken: input.gatewayToken,
      managedBootstrapFiles: input.managedBootstrapFiles,
      metadataPath: "/opt/openclaw/runtime/apply-metadata.json",
      metadataTimestampKey: "appliedAt",
      openClawConfig: input.openClawConfig,
      slackBotToken: input.slackBotToken,
      tenantId: input.tenantId,
    });
    await this.verifyTenantConfigFiles(connection, {
      metadataPath: "/opt/openclaw/runtime/apply-metadata.json",
      openClawConfig: input.openClawConfig,
    });

    const restart = await this.restartGatewayWithResult(connection);
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

  async ensureRuntimeDirectories(connection: SshConnection) {
    await this.execChecked(
      connection,
      buildShellCommand([
        "mkdir -p /opt/openclaw/home/workspace",
        "mkdir -p /opt/openclaw/runtime",
      ]),
    );
  }

  async writeTenantConfigFiles(
    connection: SshConnection,
    input: {
      desiredStateVersion: number;
      gatewayToken: string;
      managedBootstrapFiles: ManagedBootstrapRuntimeFile[];
      metadataPath: string;
      metadataTimestampKey: string;
      openClawConfig: OpenClawTenantConfig;
      slackBotToken?: string | null;
      tenantId: string;
    },
  ) {
    const runtimeFiles = buildTenantRuntimeFiles({
      desiredStateVersion: input.desiredStateVersion,
      gatewayToken: input.gatewayToken,
      managedBootstrapFiles: input.managedBootstrapFiles,
      metadataPath: input.metadataPath,
      metadataTimestampKey: input.metadataTimestampKey,
      openClawConfig: input.openClawConfig,
      slackBotToken: input.slackBotToken,
      tenantId: input.tenantId,
    });

    await this.applyTenantFiles(connection, runtimeFiles);
    await this.normalizeTenantRuntimeFilePermissions(connection, {
      managedBootstrapFiles: input.managedBootstrapFiles,
      metadataPath: input.metadataPath,
    });
  }

  async verifyTenantConfigFiles(
    connection: SshConnection,
    input: {
      metadataPath: string;
      openClawConfig: OpenClawTenantConfig;
    },
  ) {
    const commands = [
      "chown -R openclaw:openclaw /opt/openclaw",
      "test -s /opt/openclaw/home/openclaw.json",
      "test -s /opt/openclaw/home/.env",
      "test -s /opt/openclaw/home/workspace/AGENTS.md",
      "test -s /opt/openclaw/home/workspace/IDENTITY.md",
      "test -s /opt/openclaw/home/workspace/TOOLS.md",
      `test -s ${shellQuoteForShell(input.metadataPath)}`,
    ];

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

    await this.execChecked(connection, buildShellCommand(commands));
  }

  async restartGatewayWithResult(connection: SshConnection) {
    const image = getEnv().RUNTIME_OPENCLAW_IMAGE;

    return await this.execChecked(
      connection,
      buildShellCommand([
        `docker pull ${shellQuoteForShell(image)}`,
        "docker rm -f openclaw-gateway >/dev/null 2>&1 || true",
        [
          "docker run -d",
          "--name openclaw-gateway",
          "--restart unless-stopped",
          `-p 127.0.0.1:${OPENCLAW_GATEWAY_HOST_PORT}:${OPENCLAW_GATEWAY_CONTAINER_PORT}`,
          "--user 1000:1001",
          "--env-file /opt/openclaw/home/.env",
          "-v /opt/openclaw/home:/home/node/.openclaw",
          shellQuoteForShell(image),
          `node dist/index.js gateway --port ${OPENCLAW_GATEWAY_CONTAINER_PORT}`,
        ].join(" "),
      ]),
      { timeoutMs: 300_000 },
    );
  }

  async applyTenantFiles(connection: SshConnection, files: RuntimeFile[]) {
    for (const file of files) {
      await this.sshClient.writeFileAtomic(
        connection,
        file.path,
        file.contents,
        file.mode,
      );
    }
  }

  async normalizeTenantRuntimeFilePermissions(
    connection: SshConnection,
    input: {
      managedBootstrapFiles: ManagedBootstrapRuntimeFile[];
      metadataPath: string;
    },
  ) {
    const managedFilePaths = input.managedBootstrapFiles.map(
      (file) => `/opt/openclaw/home/workspace/${file.filename}`,
    );

    const ownershipTargets = [
      "/opt/openclaw",
      "/opt/openclaw/home",
      "/opt/openclaw/home/workspace",
      "/opt/openclaw/runtime",
      "/opt/openclaw/home/openclaw.json",
      "/opt/openclaw/home/.env",
      input.metadataPath,
      ...managedFilePaths,
    ];

    const quotedOwnershipTargets = ownershipTargets
      .map((path) => shellQuoteForShell(path))
      .join(" ");

    const quotedManagedFilePaths = managedFilePaths
      .map((path) => shellQuoteForShell(path))
      .join(" ");

    const commands = [
      "install -d -o openclaw -g openclaw -m 750 /opt/openclaw /opt/openclaw/home /opt/openclaw/home/workspace /opt/openclaw/runtime",
      `chown openclaw:openclaw ${quotedOwnershipTargets}`,
      "chmod 750 /opt/openclaw /opt/openclaw/home /opt/openclaw/home/workspace /opt/openclaw/runtime",
      "chmod 640 /opt/openclaw/home/openclaw.json",
      "chmod 600 /opt/openclaw/home/.env",
      `chmod 640 ${shellQuoteForShell(input.metadataPath)}`,
    ];

    if (quotedManagedFilePaths.length > 0) {
      commands.push(`chmod 640 ${quotedManagedFilePaths}`);
    }

    await this.execChecked(connection, buildShellCommand(commands));
  }

  async checkGatewayHealth(connection: SshConnection): Promise<void> {
    await this.checkGatewayHealthWithResult(connection);
  }

  async checkGatewayHealthWithResult(connection: SshConnection) {
    try {
      for (let attempt = 1; attempt <= GATEWAY_HEALTH_MAX_ATTEMPTS; attempt++) {
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
          `[worker] gateway health check attempt ${attempt}/${GATEWAY_HEALTH_MAX_ATTEMPTS}: waiting for ${connection.host}:${OPENCLAW_GATEWAY_HOST_PORT} (container ${status})`,
        );

        if (attempt < GATEWAY_HEALTH_MAX_ATTEMPTS) {
          await sleep(GATEWAY_HEALTH_POLL_INTERVAL_MS);
        }
      }

      throw new Error(
        `Gateway health check did not succeed after ${GATEWAY_HEALTH_MAX_ATTEMPTS} attempts over ${Math.round((GATEWAY_HEALTH_MAX_ATTEMPTS * GATEWAY_HEALTH_POLL_INTERVAL_MS) / 1000)}s`,
      );
    } catch (error) {
      const diagnostics = await this.getGatewayDiagnostics(connection);
      const message = error instanceof Error ? error.message : "Unknown error";

      throw new Error(`${message}\n\nGateway diagnostics:\n${diagnostics}`);
    }
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

function shellQuote(value: string) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function shellQuoteForShell(value: string) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function buildRuntimeEnvFile(input: {
  gatewayToken: string;
  slackBotToken?: string | null;
}) {
  const env = getEnv();
  const lines = [`OPENCLAW_GATEWAY_TOKEN=${input.gatewayToken}`];
  const controlPlaneBaseUrl = getControlPlaneBaseUrl();

  if (env.RUNTIME_OPENAI_API_KEY) {
    lines.push(`OPENAI_API_KEY=${env.RUNTIME_OPENAI_API_KEY}`);
  }

  if (controlPlaneBaseUrl) {
    lines.push(`OTTO_CONTROL_PLANE_BASE_URL=${controlPlaneBaseUrl}`);
  }

  if (env.RUNTIME_SLACK_APP_TOKEN) {
    lines.push(`SLACK_APP_TOKEN=${env.RUNTIME_SLACK_APP_TOKEN}`);
  }

  if (input.slackBotToken) {
    lines.push(`SLACK_BOT_TOKEN=${input.slackBotToken}`);
  }

  return `${lines.join("\n")}\n`;
}

function buildTenantRuntimeFiles(input: {
  desiredStateVersion: number;
  gatewayToken: string;
  managedBootstrapFiles: ManagedBootstrapRuntimeFile[];
  metadataPath: string;
  metadataTimestampKey: string;
  openClawConfig: OpenClawTenantConfig;
  slackBotToken?: string | null;
  tenantId: string;
}): RuntimeFile[] {
  return [
    ...input.managedBootstrapFiles.map((file) => ({
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
      contents: buildRuntimeEnvFile({
        gatewayToken: input.gatewayToken,
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
