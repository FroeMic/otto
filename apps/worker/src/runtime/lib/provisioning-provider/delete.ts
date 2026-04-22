import { resolveProvisioningProviderById } from "./resolver"
import { parseProvisioningProviderId } from "./types"

type DeleteProviderHostsInput = {
  appendJobEvent: (
    eventType: string,
    message: string,
    metadata: Record<string, unknown>,
  ) => Promise<void>
  events: {
    deletedProviderServer: string
    deletingProviderServer: string
    skippedMissingProviderServer: string
  }
  targets: Array<{
    provider: string
    providerServerId: string | null
    tenantId: string
  }>
}

export async function deleteProviderHosts(input: DeleteProviderHostsInput) {
  const targetsByProvider = groupTargetsByProvider(input.targets)
  let deletedCount = 0

  for (const [providerId, targets] of targetsByProvider.entries()) {
    const provider = resolveProvisioningProviderById(providerId)

    if (!provider.deletesRemoteHosts) {
      continue
    }

    for (const target of targets) {
      await input.appendJobEvent(
        input.events.deletingProviderServer,
        `Deleting ${provider.id} tenant server`,
        {
          provider: provider.id,
          providerServerId: target.providerServerId,
          tenantId: target.tenantId,
        },
      )

      try {
        await provider.deleteHost(target.providerServerId)
        deletedCount += 1
        await input.appendJobEvent(
          input.events.deletedProviderServer,
          `Deleted ${provider.id} tenant server`,
          {
            provider: provider.id,
            providerServerId: target.providerServerId,
            tenantId: target.tenantId,
          },
        )
      } catch (error) {
        if (provider.isHostNotFoundError?.(error)) {
          await input.appendJobEvent(
            input.events.skippedMissingProviderServer,
            `Skipped deleting ${provider.id} server because it was already gone`,
            {
              provider: provider.id,
              providerServerId: target.providerServerId,
              tenantId: target.tenantId,
            },
          )
          continue
        }

        throw error
      }
    }
  }

  return deletedCount
}

function groupTargetsByProvider(
  targets: Array<{
    provider: string
    providerServerId: string | null
    tenantId: string
  }>,
) {
  const seen = new Set<string>()
  const grouped = new Map<
    ReturnType<typeof parseProvisioningProviderId>,
    Array<{
      providerServerId: string
      tenantId: string
    }>
  >()

  for (const target of targets) {
    const providerId = parseProvisioningProviderId(target.provider)

    if (!providerId || !target.providerServerId) {
      continue
    }

    const dedupeKey = `${providerId}:${target.providerServerId}`

    if (seen.has(dedupeKey)) {
      continue
    }

    seen.add(dedupeKey)
    const existing = grouped.get(providerId) ?? []
    existing.push({
      providerServerId: target.providerServerId,
      tenantId: target.tenantId,
    })
    grouped.set(providerId, existing)
  }

  return grouped as Map<
    Exclude<ReturnType<typeof parseProvisioningProviderId>, null>,
    Array<{
      providerServerId: string
      tenantId: string
    }>
  >
}
