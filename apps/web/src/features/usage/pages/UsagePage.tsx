import { useSuspenseQuery } from "@tanstack/react-query"

import {
  SettingsPage,
  SettingsPageContent,
} from "@/client/app/app-shell/SettingsLayout"
import { billingOverviewQueryOptions } from "@/features/billing/api/billing"
import { shellBootstrapQueryOptions } from "@/features/workspace/api/workspace"

import { WorkspaceUsageContent } from "../components/WorkspaceUsageContent"

export interface UsagePageProps {
  orgSlug: string
}

export function UsagePage({ orgSlug }: UsagePageProps) {
  const { data: shellData } = useSuspenseQuery(shellBootstrapQueryOptions(orgSlug))

  return (
    <SettingsPage>
      <SettingsPageContent>
        <WorkspaceUsageContent
          locale={shellData.currentOrganization.locale}
          orgSlug={orgSlug}
        />
      </SettingsPageContent>
    </SettingsPage>
  )
}
