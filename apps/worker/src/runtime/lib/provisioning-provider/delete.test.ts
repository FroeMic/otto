import { beforeEach, describe, expect, it, vi } from "vitest"

import { deleteProviderHosts } from "./delete"
import type { ProvisioningProvider } from "./interface"

type DeleteProviderHostsInput = Parameters<typeof deleteProviderHosts>[0]
type ResolveProvisioningProviderById =
  typeof import("./resolver").resolveProvisioningProviderById
const { resolveProvisioningProviderByIdMock } = vi.hoisted(() => ({
  resolveProvisioningProviderByIdMock: vi.fn<ResolveProvisioningProviderById>(),
}))

vi.mock("./resolver", () => ({
  resolveProvisioningProviderById: resolveProvisioningProviderByIdMock,
}))

describe("deleteProviderHosts", () => {
  beforeEach(() => {
    resolveProvisioningProviderByIdMock.mockReset()
    resolveProvisioningProviderByIdMock.mockImplementation((providerId) => {
      if (providerId === "hetzner") {
        const provider: ProvisioningProvider = {
          createHost: vi.fn(async () => {
            throw new Error("not implemented")
          }),
          deleteHost: vi.fn(async (providerServerId: string) => {
            if (providerServerId === "srv-missing") {
              const error = new Error("missing")
              ;(error as Error & { code: string }).code = "NOT_FOUND"
              throw error
            }
          }),
          deletesRemoteHosts: true,
          getHost: vi.fn(async () => {
            throw new Error("not implemented")
          }),
          id: "hetzner",
          isHostNotFoundError: (error: unknown) =>
            error instanceof Error &&
            "code" in error &&
            error.code === "NOT_FOUND",
          waitForHostAction: vi.fn(async () => undefined),
        }

        return provider
      }

      const provider: ProvisioningProvider = {
        createHost: vi.fn(async () => {
          throw new Error("not implemented")
        }),
        deleteHost: vi.fn(async () => undefined),
        deletesRemoteHosts: false,
        getHost: vi.fn(async () => {
          throw new Error("not implemented")
        }),
        id: providerId,
        isHostNotFoundError: () => false,
        waitForHostAction: vi.fn(async () => undefined),
      }

      return provider
    })
  })

  it("deletes unique remote hosts and skips missing hosts", async () => {
    const appendJobEvent = vi.fn<DeleteProviderHostsInput["appendJobEvent"]>(
      async () => undefined,
    )

    const deletedCount = await deleteProviderHosts({
      appendJobEvent,
      events: {
        deletedProviderServer: "deleted_provider_server",
        deletingProviderServer: "deleting_provider_server",
        skippedMissingProviderServer: "skipped_missing_provider_server",
      },
      targets: [
        {
          provider: "hetzner",
          providerServerId: "srv-1",
          tenantId: "tenant-1",
        },
        {
          provider: "hetzner",
          providerServerId: "srv-1",
          tenantId: "tenant-1",
        },
        {
          provider: "hetzner",
          providerServerId: "srv-missing",
          tenantId: "tenant-1",
        },
        {
          provider: "fake",
          providerServerId: "srv-fake",
          tenantId: "tenant-1",
        },
      ],
    })

    expect(deletedCount).toBe(1)
    expect(
      appendJobEvent.mock.calls.some(
        ([eventType]) => eventType === "deleting_provider_server",
      ),
    ).toBe(true)
    expect(
      appendJobEvent.mock.calls.some(
        ([eventType]) => eventType === "deleted_provider_server",
      ),
    ).toBe(true)
    expect(
      appendJobEvent.mock.calls.some(
        ([eventType]) => eventType === "skipped_missing_provider_server",
      ),
    ).toBe(true)
  })
})
