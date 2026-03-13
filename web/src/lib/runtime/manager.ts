import { getEnv } from "@/lib/env";
import {
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
      openClawConfig: OpenClawTenantConfig;
      slackBotToken?: string | null;
    },
  ): Promise<void> {
    await this.execChecked(
      connection,
      buildShellCommand([
        "mkdir -p /opt/openclaw/home/workspace",
        "mkdir -p /opt/openclaw/runtime",
      ]),
    );

    await this.applyTenantFiles(connection, [
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
        path: "/opt/openclaw/runtime/bootstrap-metadata.json",
        contents: JSON.stringify(
          {
            desiredStateVersion: input.desiredStateVersion,
            bootstrappedAt: new Date().toISOString(),
            tenantId: input.tenantId,
          },
          null,
          2,
        ),
        mode: 0o640,
      },
    ]);

    await this.execChecked(
      connection,
      buildShellCommand([
        "chown -R openclaw:openclaw /opt/openclaw",
        "test -s /opt/openclaw/home/openclaw.json",
        "test -s /opt/openclaw/home/.env",
        "test -s /opt/openclaw/runtime/bootstrap-metadata.json",
      ]),
    );
  }

  async restartGateway(connection: SshConnection): Promise<void> {
    const image = getEnv().RUNTIME_OPENCLAW_IMAGE;

    await this.execChecked(
      connection,
      buildShellCommand([
        `docker pull ${shellQuoteForShell(image)}`,
        "docker rm -f openclaw-gateway >/dev/null 2>&1 || true",
        [
          "docker run -d",
          "--name openclaw-gateway",
          "--restart unless-stopped",
          "--network host",
          "--user 1000:1001",
          "--env-file /opt/openclaw/home/.env",
          "-v /opt/openclaw/home:/home/node/.openclaw",
          shellQuoteForShell(image),
          "node dist/index.js gateway --port 18789",
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

  async checkGatewayHealth(connection: SshConnection): Promise<void> {
    try {
      for (let attempt = 1; attempt <= GATEWAY_HEALTH_MAX_ATTEMPTS; attempt++) {
        const result = await this.sshClient.exec(
          connection,
          buildShellCommand([
            "docker ps --filter name=openclaw-gateway --filter status=running --format '{{.Names}}' | grep -x openclaw-gateway >/dev/null",
            "curl -fsS http://127.0.0.1:18789/healthz >/dev/null",
          ]),
          { timeoutMs: 30_000 },
        );

        if (result.exitCode === 0) {
          return;
        }

        const status = await this.getGatewayStatusSummary(connection);

        console.info(
          `[worker] gateway health check attempt ${attempt}/${GATEWAY_HEALTH_MAX_ATTEMPTS}: waiting for ${connection.host}:18789 (container ${status})`,
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

  if (env.RUNTIME_OPENAI_API_KEY) {
    lines.push(`OPENAI_API_KEY=${env.RUNTIME_OPENAI_API_KEY}`);
  }

  if (env.RUNTIME_SLACK_APP_TOKEN) {
    lines.push(`SLACK_APP_TOKEN=${env.RUNTIME_SLACK_APP_TOKEN}`);
  }

  if (input.slackBotToken) {
    lines.push(`SLACK_BOT_TOKEN=${input.slackBotToken}`);
  }

  return `${lines.join("\n")}\n`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
