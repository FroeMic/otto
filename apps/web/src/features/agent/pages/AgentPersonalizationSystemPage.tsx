import { useSuspenseQuery } from "@tanstack/react-query"
import { Navigate } from "@tanstack/react-router"

import {
  SettingsCard,
  SettingsPage,
  SettingsPageContent,
  SettingsSectionDescription,
} from "@/client/app/app-shell/SettingsLayout"
import { Textarea } from "@/components/ui/textarea"
import { shellBootstrapQueryOptions } from "@/features/workspace/api/workspace"

import { agentPersonalizationDetailQueryOptions } from "../api/agent"
import { AgentInstructionEmptyState } from "../components/AgentInstructionEmptyState"

export interface AgentPersonalizationSystemPageProps {
  instructionTab: string
  orgSlug: string
}

export function AgentPersonalizationSystemPage({
  instructionTab,
  orgSlug,
}: AgentPersonalizationSystemPageProps) {
  const { data: shellData } = useSuspenseQuery(
    shellBootstrapQueryOptions(orgSlug),
  )
  const { data } = useSuspenseQuery(
    agentPersonalizationDetailQueryOptions({
      instructionTab,
      orgSlug,
    }),
  )

  if (!shellData.user.isPlatformAdmin) {
    return (
      <Navigate
        params={{ instructionTab, orgSlug }}
        replace
        to="/$orgSlug/settings/agent/personalization/$instructionTab"
      />
    )
  }

  if (data.state === "pending_setup" || !data.instruction) {
    return <AgentInstructionEmptyState />
  }

  return (
    <SettingsPage>
      <SettingsPageContent className="flex max-w-3xl flex-col gap-6 pb-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            {data.selectedTab.label}
          </h1>
          <SettingsSectionDescription className="max-w-3xl leading-6">
            System instructions are locked and managed at the platform level for
            this file.
          </SettingsSectionDescription>
        </div>

        <SettingsCard className="divide-y-0">
          <div className="flex flex-col gap-3 px-5 py-5">
            <h2 className="text-sm font-medium">System instructions</h2>
            <Textarea
              className="min-h-64 rounded-2xl border-border bg-muted/20 font-mono text-xs leading-5 disabled:cursor-default disabled:border-border disabled:opacity-100 disabled:text-foreground md:text-xs"
              defaultValue={data.instruction.systemContent}
              disabled
              readOnly
            />
          </div>
        </SettingsCard>
      </SettingsPageContent>
    </SettingsPage>
  )
}
