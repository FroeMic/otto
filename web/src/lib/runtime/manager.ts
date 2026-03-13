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
      openClawConfig: OpenClawTenantConfig;
    },
  ): Promise<void> {
    await this.execChecked(
      connection,
      buildShellCommand([
        "mkdir -p /opt/openclaw/config",
        "mkdir -p /opt/openclaw/runtime",
      ]),
    );

    await this.applyTenantFiles(connection, [
      {
        path: "/opt/openclaw/config/openclaw.json",
        contents: renderOpenClawConfig(input.openClawConfig),
        mode: 0o640,
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
        "test -s /opt/openclaw/config/openclaw.json",
        "test -s /opt/openclaw/runtime/bootstrap-metadata.json",
      ]),
    );
  }

  async applyTenantFiles(
    connection: SshConnection,
    files: RuntimeFile[],
  ): Promise<void> {
    for (const file of files) {
      await this.sshClient.writeFileAtomic(
        connection,
        file.path,
        file.contents,
        file.mode,
      );
    }
  }

  async restartGateway(_connection: SshConnection): Promise<void> {
    throw new Error("RuntimeManager.restartGateway is not implemented yet");
  }

  async checkGatewayHealth(_connection: SshConnection): Promise<void> {
    throw new Error("RuntimeManager.checkGatewayHealth is not implemented yet");
  }

  private async execChecked(connection: SshConnection, command: string) {
    const result = await this.sshClient.exec(connection, command);

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
