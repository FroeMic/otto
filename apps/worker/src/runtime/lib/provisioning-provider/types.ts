export const PROVISIONING_PROVIDER_IDS = ["docker", "fake", "hetzner"] as const

export type ProvisioningProviderId = (typeof PROVISIONING_PROVIDER_IDS)[number]

export type ProvisioningHost = {
  actionId?: string | null
  host?: string
  id: string
  ipv4?: string
  sshPort?: number
  sshUsername?: string
  status: string
}

export function parseProvisioningProviderId(
  value: string,
): ProvisioningProviderId | null {
  if (PROVISIONING_PROVIDER_IDS.includes(value as ProvisioningProviderId)) {
    return value as ProvisioningProviderId
  }

  return null
}
