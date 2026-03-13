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

export class RuntimeManager {
  constructor(private readonly sshClient = new SshClient()) {}

  async bootstrapTenantRuntime(
    connection: SshConnection,
    input: {
      tenantId: string;
      desiredStateVersion: number;
      gatewayToken: string;
      openClawConfig: OpenClawTenantConfig;
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
    await this.execChecked(
      connection,
      buildShellCommand([
        "docker ps --filter name=openclaw-gateway --filter status=running --format '{{.Names}}' | grep -x openclaw-gateway",
        `docker exec openclaw-gateway sh -lc ${shellQuote(
          "node dist/index.js health",
        )}`,
      ]),
      { timeoutMs: 120_000 },
    );
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

function buildRuntimeEnvFile(input: { gatewayToken: string }) {
  const env = getEnv();
  const lines = [`OPENCLAW_GATEWAY_TOKEN=${input.gatewayToken}`];

  if (env.RUNTIME_OPENAI_API_KEY) {
    lines.push(`OPENAI_API_KEY=${env.RUNTIME_OPENAI_API_KEY}`);
  }

  if (env.RUNTIME_SLACK_APP_TOKEN) {
    lines.push(`SLACK_APP_TOKEN=${env.RUNTIME_SLACK_APP_TOKEN}`);
  }

  if (env.RUNTIME_SLACK_BOT_TOKEN) {
    lines.push(`SLACK_BOT_TOKEN=${env.RUNTIME_SLACK_BOT_TOKEN}`);
  }

  return `${lines.join("\n")}\n`;
}
