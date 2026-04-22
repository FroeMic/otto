import type { ReactNode } from "react"

import {
  SettingsCard,
  SettingsSection,
  SettingsSectionDescription,
  SettingsSectionTitle,
} from "@/client/app/app-shell/SettingsLayout"

import type { WorkspaceIntegrationCatalogEntry } from "../types"

export interface IntegrationCatalogSectionProps {
  description: string
  entries: WorkspaceIntegrationCatalogEntry[]
  renderItem: (entry: WorkspaceIntegrationCatalogEntry) => ReactNode
  title: string
}

export function IntegrationCatalogSection({
  description,
  entries,
  renderItem,
  title,
}: IntegrationCatalogSectionProps) {
  return (
    <SettingsSection>
      <SettingsSectionTitle>{title}</SettingsSectionTitle>
      <SettingsSectionDescription>{description}</SettingsSectionDescription>
      <SettingsCard>{entries.map((entry) => renderItem(entry))}</SettingsCard>
    </SettingsSection>
  )
}
