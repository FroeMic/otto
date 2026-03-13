import fs from "node:fs/promises";
import path from "node:path";

import { Client, type ConnectConfig } from "ssh2";
import SftpClient from "ssh2-sftp-client";

import { getEnv, normalizePrivateKeyValue } from "@/lib/env";

export type SshConnection = {
  host: string;
  port?: number;
  privateKey?: string;
  username?: string;
};

export type SshExecResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
};

export type SshExecOptions = {
  timeoutMs?: number;
};

export class SshClient {
  async exec(
    connection: SshConnection,
    command: string,
    options: SshExecOptions = {},
  ): Promise<SshExecResult> {
    const env = getEnv();
    const client = new Client();
    const connectConfig = await buildConnectConfig(connection);

    return await new Promise<SshExecResult>((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      let exitCode: number | null = null;
      let settled = false;
      const timeoutMs = options.timeoutMs ?? env.RUNTIME_SSH_COMMAND_TIMEOUT_MS;
      const timeout = setTimeout(() => {
        rejectOnce(
          new Error(
            `SSH command timed out after ${timeoutMs}ms: ${command.slice(0, 120)}`,
          ),
        );
      }, timeoutMs);

      client.on("ready", () => {
        client.exec(command, (error, stream) => {
          if (error) {
            rejectOnce(error);
            return;
          }

          stream.on("close", (code: number | undefined) => {
            exitCode = typeof code === "number" ? code : null;
            resolveOnce({
              exitCode,
              stderr,
              stdout,
            });
          });

          stream.on("data", (chunk: Buffer | string) => {
            stdout += chunk.toString();
          });

          stream.stderr.on("data", (chunk: Buffer | string) => {
            stderr += chunk.toString();
          });
        });
      });

      client.on("error", (error) => {
        rejectOnce(error);
      });

      client.on("close", () => {
        if (!settled && exitCode === null) {
          rejectOnce(
            new Error(
              `SSH connection closed before command completed: ${command.slice(0, 120)}`,
            ),
          );
        }
      });

      try {
        client.connect(connectConfig);
      } catch (error) {
        rejectOnce(
          error instanceof Error ? error : new Error("Unknown SSH exec error"),
        );
      }

      function finalize() {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);
        client.removeAllListeners();
        client.end();
      }

      function resolveOnce(result: SshExecResult) {
        finalize();
        resolve(result);
      }

      function rejectOnce(error: Error) {
        finalize();
        reject(error);
      }
    });
  }

  async writeFileAtomic(
    connection: SshConnection,
    targetPath: string,
    contents: string,
    mode = 0o600,
  ): Promise<void> {
    const client = new SftpClient("otto-write-file");

    try {
      await client.connect(await buildConnectConfig(connection));

      const remoteDirectory = path.posix.dirname(targetPath);
      const tempPath = `${targetPath}.tmp-${Date.now()}`;

      await client.mkdir(remoteDirectory, true);
      await client.put(Buffer.from(contents, "utf8"), tempPath);
      await client.rename(tempPath, targetPath);
      await client.chmod(targetPath, mode);
    } finally {
      await safeEnd(client);
    }
  }

  async waitUntilReachable(connection: SshConnection): Promise<void> {
    const env = getEnv();
    const deadline = Date.now() + env.RUNTIME_SSH_READY_TIMEOUT_MS;
    let lastError: Error | null = null;

    while (Date.now() < deadline) {
      const client = new SftpClient("otto-wait-for-ssh");

      try {
        await client.connect(await buildConnectConfig(connection));
        return;
      } catch (error) {
        lastError =
          error instanceof Error ? error : new Error("Unknown SSH error");
        await sleep(2_000);
      } finally {
        await safeEnd(client);
      }
    }

    throw new Error(
      `SSH did not become reachable for ${connection.host}:${connection.port ?? env.RUNTIME_SSH_PORT} within ${env.RUNTIME_SSH_READY_TIMEOUT_MS}ms${lastError ? ` (${lastError.message})` : ""}`,
    );
  }
}

async function buildConnectConfig(
  connection: SshConnection,
): Promise<ConnectConfig> {
  const env = getEnv();
  const privateKey = connection.privateKey ?? (await resolvePrivateKey());
  const agent = !privateKey ? process.env.SSH_AUTH_SOCK : undefined;

  if (!privateKey && !agent) {
    throw new Error(
      "SSH authentication is not configured. Set RUNTIME_DEPLOY_PRIVATE_KEY, RUNTIME_DEPLOY_PRIVATE_KEY_PATH, or run with SSH_AUTH_SOCK available.",
    );
  }

  return {
    ...(agent ? { agent } : {}),
    ...(privateKey ? { privateKey } : {}),
    host: connection.host,
    port: connection.port ?? env.RUNTIME_SSH_PORT,
    readyTimeout: env.RUNTIME_SSH_CONNECT_TIMEOUT_MS,
    username: connection.username ?? env.RUNTIME_SSH_USERNAME,
  };
}

async function resolvePrivateKey() {
  const env = getEnv();

  if (env.RUNTIME_DEPLOY_PRIVATE_KEY) {
    return normalizePrivateKeyValue(env.RUNTIME_DEPLOY_PRIVATE_KEY);
  }

  if (env.RUNTIME_DEPLOY_PRIVATE_KEY_PATH) {
    return await fs.readFile(env.RUNTIME_DEPLOY_PRIVATE_KEY_PATH, "utf8");
  }

  return undefined;
}

async function safeEnd(client: SftpClient) {
  try {
    await client.end();
  } catch {
    // ssh2-sftp-client can emit cleanup noise on end/close; ignore during shutdown.
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
