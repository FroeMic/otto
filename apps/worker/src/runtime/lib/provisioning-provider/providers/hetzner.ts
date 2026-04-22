import {
  HetznerApiError,
  type HetznerClient,
  type HetznerServer,
} from "../../hetzner/client"
import type {
  CreateProvisioningHostInput,
  ProvisioningProvider,
} from "../interface"
import type { ProvisioningHost } from "../types"

export class HetznerProvisioningProvider implements ProvisioningProvider {
  readonly deletesRemoteHosts = true
  readonly id = "hetzner" as const
  private readonly client: HetznerClient

  constructor(client: HetznerClient) {
    this.client = client
  }

  async createHost(
    input: CreateProvisioningHostInput,
  ): Promise<ProvisioningHost> {
    if (!input.hetzner) {
      throw new Error("Hetzner host create input is missing Hetzner config")
    }

    const server = await this.client.createServer({
      image: input.hetzner.image,
      labels: input.hetzner.labels,
      location: input.hetzner.location,
      name: input.hetzner.name,
      serverType: input.hetzner.serverType,
      sshKeys: input.hetzner.sshKeys,
      userData: input.hetzner.userData,
    })

    return normalizeHetznerServer(server)
  }

  async deleteHost(providerServerId: string): Promise<void> {
    await this.client.deleteServer(providerServerId)
  }

  async getHost(providerServerId: string): Promise<ProvisioningHost> {
    const server = await this.client.getServer(providerServerId)
    return normalizeHetznerServer(server)
  }

  isHostNotFoundError(error: unknown): boolean {
    return (
      error instanceof HetznerApiError &&
      (error.responseStatus === 404 || error.code === "not_found")
    )
  }

  async waitForHostAction(input: {
    actionId: string
    providerServerId: string
  }): Promise<void> {
    await this.client.waitForServerAction(
      input.providerServerId,
      input.actionId,
    )
  }
}

function normalizeHetznerServer(server: HetznerServer): ProvisioningHost {
  return {
    actionId: server.actionId,
    id: server.id,
    ipv4: server.ipv4 ?? undefined,
    status: server.status,
  }
}
