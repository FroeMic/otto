import { useQuery, useSuspenseQuery } from "@tanstack/react-query"

import {
  platformOrganizationDetailQueryOptions,
  platformUsageQueryOptions,
} from "@/features/platform/api/platform"
import {
  SettingsCard,
  SettingsPage,
  SettingsRow,
  SettingsRowLabel,
  SettingsRowTitle,
  SettingsSection,
  SettingsSectionDescription,
  SettingsSectionTitle,
} from "@/client/app/app-shell/SettingsLayout"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"

export interface PlatformOrganizationUsagePageProps {
  orgSlug: string
}

export function PlatformOrganizationUsagePage({
  orgSlug,
}: PlatformOrganizationUsagePageProps) {
  const { data: detail } = useSuspenseQuery(
    platformOrganizationDetailQueryOptions(orgSlug),
  )
  const tenant = detail.organization.tenant

  if (!tenant) {
    return (
      <div className="px-4 pb-6 md:px-6">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No tenant provisioned yet</EmptyTitle>
            <EmptyDescription>
              This organization does not have a tenant runtime yet, so there is
              no provider usage to inspect.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  if (!tenant.openAiProvider?.projectId) {
    return (
      <div className="px-4 pb-6 md:px-6">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No OpenAI provider configured yet</EmptyTitle>
            <EmptyDescription>
              Provision an OpenAI project for this workspace first, then usage
              data will appear here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - 30)
  const { data } = useQuery(
    platformUsageQueryOptions({
      from: from.toISOString(),
      orgSlug,
      to: to.toISOString(),
    }),
  )

  return (
    <div className="px-4 pb-6 md:px-6">
      <SettingsPage className="mx-0 max-w-4xl">
        <div className="flex flex-col gap-10">
          <SettingsSection>
            <SettingsSectionTitle>Usage summary</SettingsSectionTitle>
            <SettingsSectionDescription>
              Provider usage over the last 30 days.
            </SettingsSectionDescription>
            <SettingsCard>
              <SettingsRow>
                <SettingsRowLabel>
                  <SettingsRowTitle>Requests</SettingsRowTitle>
                </SettingsRowLabel>
                <div className="text-sm text-foreground">
                  {data?.summary.totalRequests ?? 0}
                </div>
              </SettingsRow>
              <SettingsRow>
                <SettingsRowLabel>
                  <SettingsRowTitle>Input tokens</SettingsRowTitle>
                </SettingsRowLabel>
                <div className="text-sm text-foreground">
                  {data?.summary.totalInputTokens ?? 0}
                </div>
              </SettingsRow>
              <SettingsRow>
                <SettingsRowLabel>
                  <SettingsRowTitle>Output tokens</SettingsRowTitle>
                </SettingsRowLabel>
                <div className="text-sm text-foreground">
                  {data?.summary.totalOutputTokens ?? 0}
                </div>
              </SettingsRow>
              <SettingsRow>
                <SettingsRowLabel>
                  <SettingsRowTitle>Credits burned</SettingsRowTitle>
                </SettingsRowLabel>
                <div className="text-sm text-foreground">
                  {data?.summary.totalCreditsBurnedMilli ?? 0}
                </div>
              </SettingsRow>
            </SettingsCard>
          </SettingsSection>

          <SettingsSection>
            <SettingsSectionTitle>Usage by model</SettingsSectionTitle>
            <SettingsCard>
              {data?.usageByModel.length ? (
                data.usageByModel.map((row) => (
                  <SettingsRow key={`${row.usageType}:${row.model}`}>
                    <SettingsRowLabel>
                      <SettingsRowTitle>{row.model || row.usageType}</SettingsRowTitle>
                    </SettingsRowLabel>
                    <div className="text-sm text-foreground">
                      {row.requestCount} requests · {row.totalTokens} tokens
                    </div>
                  </SettingsRow>
                ))
              ) : (
                <SettingsRow>
                  <div className="text-sm text-muted-foreground">
                    No usage data for this period.
                  </div>
                </SettingsRow>
              )}
            </SettingsCard>
          </SettingsSection>
        </div>
      </SettingsPage>
    </div>
  )
}
