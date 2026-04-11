import { CaretRightIcon } from "@phosphor-icons/react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import {
  SettingsCard,
  SettingsPage,
  SettingsPageContent,
  SettingsRow,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowTitle,
  SettingsSectionDescription,
} from "@/client/app/app-shell/SettingsLayout"
import { shellBootstrapQueryOptions } from "@/features/workspace/api/workspace"

import { agentPersonalizationDetailQueryOptions } from "../api/agent"
import { AgentInstructionEditor } from "../components/AgentInstructionEditor"
import { AgentInstructionEmptyState } from "../components/AgentInstructionEmptyState"

export interface AgentPersonalizationDetailPageProps {
  instructionTab: string
  orgSlug: string
}

export function AgentPersonalizationDetailPage({
  instructionTab,
  orgSlug,
}: AgentPersonalizationDetailPageProps) {
  const { data: shellData } = useSuspenseQuery(
    shellBootstrapQueryOptions(orgSlug),
  )
  const { data } = useSuspenseQuery(
    agentPersonalizationDetailQueryOptions({
      instructionTab,
      orgSlug,
    }),
  )

  if (data.state === "pending_setup" || !data.instruction) {
    return <AgentInstructionEmptyState />
  }

  return (
    <SettingsPage>
      <SettingsPageContent className="flex max-w-3xl flex-col gap-6 pb-8">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              {data.selectedTab.label}
            </h1>
            <SettingsSectionDescription className="max-w-3xl leading-6">
              {data.instruction.description}
            </SettingsSectionDescription>
          </div>
        </div>

        <AgentInstructionEditor
          instruction={data.instruction}
          orgSlug={orgSlug}
        />

        {shellData.user.isPlatformAdmin ? (
          <SettingsCard>
            <Link
              className="block transition-colors hover:bg-muted/30"
              params={{ instructionTab, orgSlug }}
              preload="intent"
              to="/$orgSlug/settings/agent/personalization/$instructionTab/system"
            >
              <SettingsRow>
                <SettingsRowLabel>
                  <SettingsRowTitle>System instructions</SettingsRowTitle>
                  <SettingsRowDescription>
                    Review the locked instructions Otto prepends to this file.
                  </SettingsRowDescription>
                </SettingsRowLabel>
                <CaretRightIcon className="size-4 shrink-0 text-muted-foreground" />
              </SettingsRow>
            </Link>
          </SettingsCard>
        ) : null}
      </SettingsPageContent>
    </SettingsPage>
  )
}
