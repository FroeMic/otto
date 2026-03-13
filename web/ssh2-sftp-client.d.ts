declare module "ssh2-sftp-client" {
  import type { ConnectConfig } from "ssh2";

  export default class SftpClient {
    constructor(name?: string, callbacks?: Record<string, unknown>);
    chmod(remotePath: string, mode: number): Promise<void>;
    connect(config: ConnectConfig): Promise<unknown>;
    end(): Promise<boolean>;
    mkdir(remotePath: string, recursive?: boolean): Promise<string>;
    put(
      input: Buffer | string,
      remotePath: string,
      options?: Record<string, unknown>,
    ): Promise<string>;
    rename(fromPath: string, toPath: string): Promise<void>;
  }
}
