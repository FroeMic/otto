import { getProvisioningProviderMode } from "../env"
import { HetznerClient } from "../hetzner/client"
import type { ProvisioningProvider } from "./interface"
import { FakeProvisioningProvider } from "./providers/fake"
import { HetznerProvisioningProvider } from "./providers/hetzner"
import type { ProvisioningProviderId } from "./types"

const dockerProvider = new FakeProvisioningProvider("docker")
const fakeProvider = new FakeProvisioningProvider("fake")
let cachedHetznerProvider: HetznerProvisioningProvider | null = null

export function resolveProvisioningProvider(): ProvisioningProvider {
  const mode = getProvisioningProviderMode()

  return resolveProvisioningProviderById(mode)
}

export function resolveProvisioningProviderById(
  providerId: ProvisioningProviderId,
): ProvisioningProvider {
  if (providerId === "hetzner") {
    return getHetznerProvisioningProvider()
  }

  if (providerId === "docker") {
    // Docker mode still reuses the fake host lifecycle until the real Docker
    // provider implementation lands.
    return dockerProvider
  }

  return fakeProvider
}

function getHetznerProvisioningProvider() {
  if (!cachedHetznerProvider) {
    cachedHetznerProvider = new HetznerProvisioningProvider(new HetznerClient())
  }

  return cachedHetznerProvider
}
