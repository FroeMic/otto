import type { ProvisioningHost, ProvisioningProviderId } from "./types"

export type CreateProvisioningHostInput = {
  docker?: {
    endpointHost: string
    endpointMode: "container_name" | "published_port"
    hostImage: string
    networkName: string
    sshPort: number
    sshUsername: string
  }
  hetzner?: {
    image: string
    labels: Record<string, string>
    location: string
    name: string
    serverType: string
    sshKeys: string[]
    userData: string
  }
  tenantId: string
}

export interface ProvisioningProvider {
  readonly deletesRemoteHosts?: boolean
  readonly id: ProvisioningProviderId

  createHost(input: CreateProvisioningHostInput): Promise<ProvisioningHost>
  deleteHost(providerServerId: string): Promise<void>
  getHost(providerServerId: string): Promise<ProvisioningHost>
  isHostNotFoundError?(error: unknown): boolean
  waitForHostAction(input: {
    actionId: string
    providerServerId: string
  }): Promise<void>
}
