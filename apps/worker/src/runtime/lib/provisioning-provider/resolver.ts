import { getEnv, getProvisioningProviderMode } from "../env"
import { HetznerClient } from "../hetzner/client"
import type { ProvisioningProvider } from "./interface"
import { DockerProvisioningProvider } from "./providers/docker"
import { FakeProvisioningProvider } from "./providers/fake"
import { HetznerProvisioningProvider } from "./providers/hetzner"
import type { ProvisioningProviderId } from "./types"

const fakeProvider = new FakeProvisioningProvider("fake")
let cachedDockerProvider: DockerProvisioningProvider | null = null
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
    return getDockerProvisioningProvider()
  }

  return fakeProvider
}

function getDockerProvisioningProvider() {
  if (!cachedDockerProvider) {
    const env = getEnv()
    cachedDockerProvider = new DockerProvisioningProvider({
      dockerBin: env.TENANT_RUNTIME_DOCKER_DOCKER_BIN,
      hostImage: env.TENANT_RUNTIME_DOCKER_HOST_IMAGE,
      networkName: env.TENANT_RUNTIME_DOCKER_NETWORK,
      pollIntervalMs: env.TENANT_RUNTIME_DOCKER_POLL_INTERVAL_MS,
      sshHost: env.TENANT_RUNTIME_DOCKER_SSH_HOST,
      sshPortRangeEnd: env.TENANT_RUNTIME_DOCKER_SSH_PORT_RANGE_END,
      sshPortRangeStart: env.TENANT_RUNTIME_DOCKER_SSH_PORT_RANGE_START,
      sshUsername: env.TENANT_RUNTIME_DOCKER_SSH_USERNAME,
      startupTimeoutMs: env.TENANT_RUNTIME_DOCKER_STARTUP_TIMEOUT_MS,
      tenantHostPrefix: env.TENANT_RUNTIME_DOCKER_CONTAINER_PREFIX,
    })
  }

  return cachedDockerProvider
}

function getHetznerProvisioningProvider() {
  if (!cachedHetznerProvider) {
    cachedHetznerProvider = new HetznerProvisioningProvider(new HetznerClient())
  }

  return cachedHetznerProvider
}
