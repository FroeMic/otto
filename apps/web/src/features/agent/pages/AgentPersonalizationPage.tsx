import { useSuspenseQuery } from "@tanstack/react-query"

import {
  SettingsPage,
  SettingsPageContent,
  SettingsSection,
  SettingsSectionDescription,
  SettingsSectionTitle,
} from "@/client/app/app-shell/SettingsLayout"

import { agentPersonalizationDetailQueryOptions } from "../api/agent"
import { AgentInstructionEditor } from "../components/AgentInstructionEditor"
import { AgentInstructionEmptyState } from "../components/AgentInstructionEmptyState"
import { AgentInstructionHeader } from "../components/AgentInstructionHeader"
import { AgentInstructionTabs } from "../components/AgentInstructionTabs"

export interface AgentPersonalizationPageProps {
  instructionTab: string
  orgSlug: string
}

export function AgentPersonalizationPage({
  instructionTab,
  orgSlug,
}: AgentPersonalizationPageProps) {
  const { data } = useSuspenseQuery(
    agentPersonalizationDetailQueryOptions({
      instructionTab,
      orgSlug,
    }),
  )

  if (data.state === "pending_setup" || !data.instruction) {
    return (
      <div className="flex flex-col gap-6">
        <AgentInstructionHeader>
          <AgentInstructionTabs
            currentInstructionTab={data.selectedTab.slug}
            orgSlug={orgSlug}
            tabs={data.tabs}
          />
        </AgentInstructionHeader>
        <AgentInstructionEmptyState />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <AgentInstructionHeader>
        <AgentInstructionTabs
          currentInstructionTab={data.selectedTab.slug}
          orgSlug={orgSlug}
          tabs={data.tabs}
        />
      </AgentInstructionHeader>

      <SettingsPage>
        <SettingsPageContent className="flex flex-col gap-8 pb-8">
          <SettingsSection>
            <SettingsSectionTitle>{data.selectedTab.label}</SettingsSectionTitle>
            <SettingsSectionDescription>
              {data.instruction.description}
            </SettingsSectionDescription>
          </SettingsSection>

          <AgentInstructionEditor
            instruction={data.instruction}
            orgSlug={orgSlug}
          />
        </SettingsPageContent>
      </SettingsPage>
    </div>
  )
}
