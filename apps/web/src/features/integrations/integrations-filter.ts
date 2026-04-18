import type { WorkspaceIntegrationCatalogEntry } from "./types"

export type IntegrationInstallStateFilter =
  | "all"
  | "installed"
  | "not-installed"

export function parseIntegrationInstallStateFilter(
  value: string | null,
): IntegrationInstallStateFilter {
  if (value === "installed" || value === "not-installed") {
    return value
  }

  return "all"
}

export function filterIntegrationCatalogEntries(
  entries: WorkspaceIntegrationCatalogEntry[],
  input: {
    installState: IntegrationInstallStateFilter
    searchQuery: string
  },
) {
  const normalizedQuery = input.searchQuery.trim().toLowerCase()

  return entries.filter((entry) => {
    if (input.installState === "installed" && !entry.connected) {
      return false
    }

    if (input.installState === "not-installed" && entry.connected) {
      return false
    }

    if (!normalizedQuery) {
      return true
    }

    return (
      entry.label.toLowerCase().includes(normalizedQuery) ||
      entry.description.toLowerCase().includes(normalizedQuery)
    )
  })
}
