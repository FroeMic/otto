import net from "node:net";

import { getEnv } from "@/lib/env";

export type SshConnection = {
  host: string;
  port?: number;
  username: string;
  privateKey?: string;
};

export type SshExecResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
};

export class SshClient {
  async exec(
    _connection: SshConnection,
    _command: string,
  ): Promise<SshExecResult> {
    throw new Error("SshClient.exec is not implemented yet");
  }

  async writeFileAtomic(
    _connection: SshConnection,
    _targetPath: string,
    _contents: string,
    _mode = 0o600,
  ): Promise<void> {
    throw new Error("SshClient.writeFileAtomic is not implemented yet");
  }

  async waitUntilReachable(_connection: SshConnection): Promise<void> {
    const env = getEnv();
    const deadline = Date.now() + env.RUNTIME_SSH_READY_TIMEOUT_MS;
    let lastError: Error | null = null;

    while (Date.now() < deadline) {
      try {
        await waitForSshBanner({
          connectTimeoutMs: env.RUNTIME_SSH_CONNECT_TIMEOUT_MS,
          host: _connection.host,
          port: _connection.port ?? env.RUNTIME_SSH_PORT,
        });
        return;
      } catch (error) {
        lastError =
          error instanceof Error ? error : new Error("Unknown SSH error");
        await sleep(2_000);
      }
    }

    throw new Error(
      `SSH did not become reachable for ${_connection.host}:${_connection.port ?? env.RUNTIME_SSH_PORT} within ${env.RUNTIME_SSH_READY_TIMEOUT_MS}ms${lastError ? ` (${lastError.message})` : ""}`,
    );
  }
}

async function waitForSshBanner(input: {
  connectTimeoutMs: number;
  host: string;
  port: number;
}) {
  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({
      host: input.host,
      port: input.port,
    });

    let settled = false;

    function finish(callback: () => void) {
      if (settled) {
        return;
      }

      settled = true;
      socket.removeAllListeners();
      socket.destroy();
      callback();
    }

    socket.setTimeout(input.connectTimeoutMs);

    socket.on("data", (buffer) => {
      const banner = buffer.toString("utf8");

      if (banner.startsWith("SSH-")) {
        finish(resolve);
      }
    });

    socket.on("timeout", () => {
      finish(() =>
        reject(
          new Error(
            `Timed out waiting for SSH banner from ${input.host}:${input.port}`,
          ),
        ),
      );
    });

    socket.on("error", (error) => {
      finish(() => reject(error));
    });

    socket.on("close", () => {
      if (!settled) {
        finish(() =>
          reject(
            new Error(
              `Connection closed before SSH banner from ${input.host}:${input.port}`,
            ),
          ),
        );
      }
    });
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
