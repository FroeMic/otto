export type CreateServerInput = {
  name: string;
  serverType: string;
  image: string;
  location: string;
  userData: string;
};

export type CreatedServer = {
  id: string;
  ipv4: string | null;
  status: string;
  actionId: string | null;
};

export class HetznerClient {
  async createServer(_input: CreateServerInput): Promise<CreatedServer> {
    throw new Error("HetznerClient.createServer is not implemented yet");
  }

  async getServer(_serverId: string): Promise<CreatedServer> {
    throw new Error("HetznerClient.getServer is not implemented yet");
  }

  async waitForServerAction(
    _serverId: string,
    _actionId: string,
  ): Promise<void> {
    throw new Error("HetznerClient.waitForServerAction is not implemented yet");
  }
}
