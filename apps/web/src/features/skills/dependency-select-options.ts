import type { WorkspaceIntegrationCatalogEntry } from "@/features/integrations/types"

import type { WorkspaceInstalledSkillListEntry } from "./types"

export interface DependencySelectOption {
  label: string
  searchText: string
  value: string
}

export interface IntegrationDependencySelectOption extends DependencySelectOption {
  iconSrc: string | null
  installed: boolean
}

export function toggleDependencySelection(selectedValues: string[], value: string) {
  const selectedSet = new Set(selectedValues)

  if (selectedSet.has(value)) {
    selectedSet.delete(value)
  } else {
    selectedSet.add(value)
  }

  return [...selectedSet].sort((left, right) => left.localeCompare(right))
}

export function filterDependencySelectOptions<T extends DependencySelectOption>(
  options: T[],
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return options
  }

  return options.filter((option) =>
    option.searchText.toLowerCase().includes(normalizedQuery),
  )
}

export function buildIntegrationDependencyOptions(input: {
  catalog: WorkspaceIntegrationCatalogEntry[]
  knownIntegrationKeys: string[]
}): IntegrationDependencySelectOption[] {
  const catalogByKey = new Map<string, WorkspaceIntegrationCatalogEntry>(
    input.catalog.map((integration) => [integration.key, integration]),
  )
  const keys = new Set<string>([
    ...input.catalog.map((integration) => integration.key),
    ...input.knownIntegrationKeys,
  ])

  return [...keys]
    .map((key) => {
      const catalogEntry = catalogByKey.get(key)
      const label = catalogEntry?.label ?? key

      return {
        iconSrc: catalogEntry?.iconSrc ?? null,
        installed: catalogEntry?.connected ?? false,
        label,
        searchText: `${label} ${key}`,
        value: key,
      }
    })
    .sort((left, right) => {
      if (left.installed !== right.installed) {
        return left.installed ? -1 : 1
      }

      return left.label.localeCompare(right.label)
    })
}

export function buildSkillDependencyOptions(input: {
  knownSkillKeys: string[]
  skills: WorkspaceInstalledSkillListEntry[]
}): DependencySelectOption[] {
  const skillByKey = new Map(input.skills.map((skill) => [skill.skillKey, skill]))
  const keys = new Set<string>([
    ...input.knownSkillKeys,
    ...input.skills.map((skill) => skill.skillKey),
  ])

  return [...keys]
    .map((key) => {
      const skill = skillByKey.get(key)
      const label = skill?.displayName ?? key

      return {
        label,
        searchText: `${label} ${key}`,
        value: key,
      }
    })
    .sort((left, right) => left.label.localeCompare(right.label))
}
