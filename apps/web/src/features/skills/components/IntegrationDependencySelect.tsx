import { useSuspenseQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import { workspaceIntegrationsQueryOptions } from "@/features/integrations/api/integrations"

import { buildIntegrationDependencyOptions } from "../dependency-select-options"
import {
  DependencyMultiSelect,
  IntegrationDependencyOptionMeta,
} from "./DependencyMultiSelect"

export interface IntegrationDependencySelectProps {
  disabled?: boolean
  knownIntegrationKeys: string[]
  orgSlug: string
  selectedIntegrationKeys: string[]
  onSelectedIntegrationKeysChange: (selectedIntegrationKeys: string[]) => void
}

export function IntegrationDependencySelect({
  disabled = false,
  knownIntegrationKeys,
  onSelectedIntegrationKeysChange,
  orgSlug,
  selectedIntegrationKeys,
}: IntegrationDependencySelectProps) {
  const { data: integrations } = useSuspenseQuery(
    workspaceIntegrationsQueryOptions(orgSlug),
  )
  const options = useMemo(
    () =>
      buildIntegrationDependencyOptions({
        catalog: integrations,
        knownIntegrationKeys,
      }),
    [integrations, knownIntegrationKeys],
  )

  return (
    <DependencyMultiSelect
      disabled={disabled}
      emptyMessage="No integrations found."
      getOptionMeta={(option) => (
        <IntegrationDependencyOptionMeta option={option} />
      )}
      options={options}
      placeholder="Select integrations"
      searchPlaceholder="Search integrations..."
      selectedValues={selectedIntegrationKeys}
      onSelectedValuesChange={onSelectedIntegrationKeysChange}
    />
  )
}
