import { ArrowLeftIcon } from "@phosphor-icons/react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"

import {
  SettingsPage,
  SettingsPageContent,
  SettingsSectionDescription,
} from "@/client/app/app-shell/SettingsLayout"

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
      <SettingsPageContent className="flex max-w-3xl flex-col gap-8 pb-8">
        <div className="flex flex-col gap-4">
          <Link
            className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            params={{ orgSlug }}
            to="/$orgSlug/settings/agent/personalization"
          >
            <ArrowLeftIcon className="size-4" />
            Personalization
          </Link>

          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">Otto instructions</p>
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
      </SettingsPageContent>
    </SettingsPage>
  )
}
