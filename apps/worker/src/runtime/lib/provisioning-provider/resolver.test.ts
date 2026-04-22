import { describe, expect, it, vi } from "vitest"

import { getProvisioningProviderMode } from "../env"
import {
  resolveProvisioningProvider,
  resolveProvisioningProviderById,
} from "./resolver"

vi.mock("../env", () => ({
  getProvisioningProviderMode: vi.fn(() => "fake"),
}))

describe("provisioning provider resolver", () => {
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
    expect(provider.deletesRemoteHosts).toBe(false)
  })

  it("resolves docker provider directly by id", () => {
    const provider = resolveProvisioningProviderById("docker")

    expect(provider.id).toBe("docker")
    expect(provider.deletesRemoteHosts).toBe(false)
  })
})
