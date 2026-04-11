import { useSuspenseQuery } from "@tanstack/react-query"

import {
  SettingsPage,
  SettingsPageContent,
  SettingsPageTitle,
  SettingsSectionDescription,
} from "@/client/app/app-shell/SettingsLayout"

import { agentPersonalizationOverviewQueryOptions } from "../api/agent"
import { AgentInstructionEmptyState } from "../components/AgentInstructionEmptyState"
import { AgentInstructionList } from "../components/AgentInstructionList"

export interface AgentPersonalizationPageProps {
  orgSlug: string
}

export function AgentPersonalizationPage({
  orgSlug,
}: AgentPersonalizationPageProps) {
  const { data } = useSuspenseQuery(
    agentPersonalizationOverviewQueryOptions(orgSlug),
  )

  if (data.state === "pending_setup") {
    return <AgentInstructionEmptyState />
  }

  return (
    <SettingsPage>
      <SettingsPageContent className="flex max-w-3xl flex-col gap-8 pb-8">
        <div className="flex flex-col gap-2">
          <SettingsPageTitle>Personalization</SettingsPageTitle>
          <SettingsSectionDescription className="max-w-3xl leading-6">
            Review and adjust the instruction files Otto uses for your
            workspace.
          </SettingsSectionDescription>
        </div>

        <AgentInstructionList orgSlug={orgSlug} tabs={data.tabs} />
      </SettingsPageContent>
    </SettingsPage>
  )
}
