import type { SshConnection } from "@/lib/ssh/client";

export type RuntimeFile = {
  path: string;
  contents: string;
  mode?: number;
};

export class RuntimeManager {
  async applyTenantFiles(
    _connection: SshConnection,
    _files: RuntimeFile[],
  ): Promise<void> {
    throw new Error("RuntimeManager.applyTenantFiles is not implemented yet");
  }

  async restartGateway(_connection: SshConnection): Promise<void> {
    throw new Error("RuntimeManager.restartGateway is not implemented yet");
  }

  async checkGatewayHealth(_connection: SshConnection): Promise<void> {
    throw new Error("RuntimeManager.checkGatewayHealth is not implemented yet");
  }
}
