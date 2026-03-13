export type SshConnection = {
  host: string;
  port?: number;
  username: string;
  privateKey: string;
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
    throw new Error("SshClient.waitUntilReachable is not implemented yet");
  }
}
