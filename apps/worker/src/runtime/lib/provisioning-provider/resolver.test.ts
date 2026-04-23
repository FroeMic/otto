import { describe, expect, it, vi } from "vitest"

import { getEnv, getProvisioningProviderMode } from "../env"
import {
  resolveProvisioningProvider,
  resolveProvisioningProviderById,
} from "./resolver"

vi.mock("../env", () => ({
  getEnv: vi.fn(() => ({
    TENANT_RUNTIME_DOCKER_CONTAINER_PREFIX: "tenant-host",
    TENANT_RUNTIME_DOCKER_DOCKER_BIN: "docker",
    TENANT_RUNTIME_DOCKER_HOST_IMAGE: "ghcr.io/example/tenant-host:latest",
    TENANT_RUNTIME_DOCKER_NETWORK: "otto-tenant-lab",
    TENANT_RUNTIME_DOCKER_POLL_INTERVAL_MS: 1,
    TENANT_RUNTIME_DOCKER_SSH_HOST: "127.0.0.1",
    TENANT_RUNTIME_DOCKER_SSH_PORT_RANGE_END: 22010,
    TENANT_RUNTIME_DOCKER_SSH_PORT_RANGE_START: 22000,
    TENANT_RUNTIME_DOCKER_SSH_USERNAME: "root",
    TENANT_RUNTIME_DOCKER_STARTUP_TIMEOUT_MS: 1_000,
  })),
  getProvisioningProviderMode: vi.fn(() => "fake"),
}))

describe("provisioning provider resolver", () => {
  it("hydrates docker provider from env config", () => {
    const provider = resolveProvisioningProviderById("docker")

    expect(getEnv).toHaveBeenCalled()
    expect(provider.id).toBe("docker")
    expect(provider.deletesRemoteHosts).toBe(true)
  })

  it("returns fake provider for fake mode", () => {
    vi.mocked(getProvisioningProviderMode).mockReturnValue("fake")
    const provider = resolveProvisioningProvider()

    expect(provider.id).toBe("fake")
    expect(provider.deletesRemoteHosts).toBe(false)
  })

  it("returns docker provider id in docker mode", () => {
    vi.mocked(getProvisioningProviderMode).mockReturnValue("docker")
    const provider = resolveProvisioningProvider()

    expect(provider.id).toBe("docker")
    expect(provider.deletesRemoteHosts).toBe(true)
  })

  it("resolves docker provider directly by id", () => {
    const provider = resolveProvisioningProviderById("docker")

    expect(provider.id).toBe("docker")
    expect(provider.deletesRemoteHosts).toBe(true)
  })

  it("returns singleton docker provider instance", () => {
    const first = resolveProvisioningProviderById("docker")
    const second = resolveProvisioningProviderById("docker")

    expect(first).toBe(second)
  })
})
