export function getStaleDirectoryIds(input: {
  currentIds: string[]
  syncedIds: string[]
}) {
  const syncedIdSet = new Set(
    input.syncedIds.map((id) => id.trim()).filter((id) => id.length > 0),
  )
  const staleIds: string[] = []
  const seenIds = new Set<string>()

  for (const currentId of input.currentIds) {
    const normalizedId = currentId.trim()

    if (
      normalizedId.length === 0 ||
      syncedIdSet.has(normalizedId) ||
      seenIds.has(normalizedId)
    ) {
      continue
    }

    staleIds.push(normalizedId)
    seenIds.add(normalizedId)
  }

  return staleIds
}
