import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { platformOrganizationDetailQueryOptions } from "@/features/platform/api/platform"
import { PlatformUsageContent } from "@/features/platform/components/PlatformUsageContent"
import { getPreviousBillingCycleRange } from "@/features/usage/date-ranges"

export interface PlatformOrganizationUsagePageProps {
  orgSlug: string
}

export function PlatformOrganizationUsagePage({
  orgSlug,
}: PlatformOrganizationUsagePageProps) {
  const { data: detail } = useSuspenseQuery(
    platformOrganizationDetailQueryOptions(orgSlug),
  )
  const organization = detail.organization
  const tenant = organization.tenant

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

  const currentPeriodStart = organization.billing?.currentPeriodStart
    ? new Date(organization.billing.currentPeriodStart)
    : null
  const currentPeriodEnd = organization.billing?.currentPeriodEnd
    ? new Date(organization.billing.currentPeriodEnd)
    : null
  const previousCycleRange = getPreviousBillingCycleRange({
    currentPeriodEnd,
    currentPeriodStart,
  })

  return (
    <PlatformUsageContent
      creditBalance={{
        currentBalanceCreditsMilli:
          organization.billing?.currentBalanceCreditsMilli ?? 0,
        totalDebitedCreditsMilli:
          organization.billing?.totalDebitedCreditsMilli ?? 0,
        totalGrantedCreditsMilli:
          organization.billing?.totalGrantedCreditsMilli ?? 0,
      }}
      currentCycleEndIso={organization.billing?.currentPeriodEnd ?? null}
      currentCycleStartIso={organization.billing?.currentPeriodStart ?? null}
      locale={organization.locale}
      orgSlug={orgSlug}
      previousCycleEndIso={previousCycleRange?.to.toISOString() ?? null}
      previousCycleStartIso={previousCycleRange?.from.toISOString() ?? null}
      timezone={organization.timezone}
    />
  )
}
