import { randomUUID } from "node:crypto"

export type FakeCreatedServer = {
  actionId: string
  id: string
  ipv4: string
  status: string
}

export class FakeHetznerClient {
  async createServer(_input: { tenantId: string }): Promise<FakeCreatedServer> {
    const id = `fake-${randomUUID()}`

    return {
      actionId: `action-${randomUUID()}`,
      id,
      ipv4: getFakeIpv4(id),
      status: "creating",
    }
  }

  async getServer(serverId: string): Promise<FakeCreatedServer> {
    return {
      actionId: `action-for-${serverId}`,
      id: serverId,
      ipv4: getFakeIpv4(serverId),
      status: "running",
    }
  }

  async waitForServerAction(
    _serverId: string,
    _actionId: string,
  ): Promise<void> {
    return
  }
}

function getFakeIpv4(serverId: string) {
  let hash = 0

  for (const char of serverId) {
    hash = (hash + char.charCodeAt(0)) % 240
  }

  return `203.0.113.${Math.max(10, hash)}`
}
