import { useSuspenseQuery } from "@tanstack/react-query"

import {
  SettingsPage,
  SettingsPageContent,
  SettingsPageTitle,
  SettingsSection,
  SettingsSectionTitle,
} from "@/client/app/app-shell/SettingsLayout"
import { shellBootstrapQueryOptions } from "@/features/workspace/api/workspace"
import { resolveWorkspaceDateTimePreferences } from "@/features/workspace/date-time"

import { WorkspaceDetailsCard } from "../components/WorkspaceDetailsCard"
import { WorkspaceTimeAndRegionCard } from "../components/WorkspaceTimeAndRegionCard"

export interface WorkspaceSettingsPageProps {
  orgSlug: string
}

export function WorkspaceSettingsPage({
  orgSlug,
}: WorkspaceSettingsPageProps) {
  const { data } = useSuspenseQuery(shellBootstrapQueryOptions(orgSlug))

  return (
    <SettingsPage>
      <SettingsPageContent className="flex flex-col gap-8">
        <SettingsPageTitle>General</SettingsPageTitle>

        <SettingsSection>
          <SettingsSectionTitle>Workspace details</SettingsSectionTitle>
          <WorkspaceDetailsCard
            name={data.currentOrganization.name}
            orgSlug={orgSlug}
            slug={data.currentOrganization.slug}
          />
        </SettingsSection>

        <SettingsSection>
          <SettingsSectionTitle>Time and Region</SettingsSectionTitle>
          <WorkspaceTimeAndRegionCard
            initialPreferences={resolveWorkspaceDateTimePreferences({
              locale: data.currentOrganization.locale,
              timeFormatPreference:
                data.currentOrganization.timeFormatPreference,
              timeZone: data.currentOrganization.timezone,
            })}
            orgSlug={orgSlug}
          />
        </SettingsSection>
      </SettingsPageContent>
    </SettingsPage>
  )
}
