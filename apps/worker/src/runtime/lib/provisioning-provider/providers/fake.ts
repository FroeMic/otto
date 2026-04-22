import { FakeHetznerClient } from "../../hetzner/fake"
import type {
  CreateProvisioningHostInput,
  ProvisioningProvider,
} from "../interface"
import type { ProvisioningHost, ProvisioningProviderId } from "../types"

const fakeClient = new FakeHetznerClient()

export class FakeProvisioningProvider implements ProvisioningProvider {
  readonly deletesRemoteHosts = false
  readonly id: ProvisioningProviderId

  constructor(id: ProvisioningProviderId = "fake") {
    this.id = id
  }

  async createHost(
    input: CreateProvisioningHostInput,
  ): Promise<ProvisioningHost> {
    const server = await fakeClient.createServer({
      tenantId: input.tenantId,
    })

    return normalizeFakeServer(server)
  }

  async deleteHost(_providerServerId: string): Promise<void> {
    return
  }

  async getHost(providerServerId: string): Promise<ProvisioningHost> {
    const server = await fakeClient.getServer(providerServerId)
    return normalizeFakeServer(server)
  }

  async waitForHostAction(input: {
    actionId: string
    providerServerId: string
  }): Promise<void> {
    await fakeClient.waitForServerAction(input.providerServerId, input.actionId)
  }
}

function normalizeFakeServer(server: {
  actionId: string | null
  id: string
  ipv4: string
  status: string
}): ProvisioningHost {
  return {
    actionId: server.actionId,
    id: server.id,
    ipv4: server.ipv4,
    status: server.status,
  }
}
