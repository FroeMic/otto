import { useSuspenseQuery } from "@tanstack/react-query"

import { buildPlatformActivityData } from "@/features/platform/activity"
import { platformOrganizationDetailQueryOptions } from "@/features/platform/api/platform"
import { PlatformActivityContent } from "@/features/platform/components/PlatformActivityContent"
import { resolvePlatformDateTimePreferences } from "@/features/platform/date-time"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"

export interface PlatformOrganizationEventsPageProps {
  orgSlug: string
}

export function PlatformOrganizationEventsPage({
  orgSlug,
}: PlatformOrganizationEventsPageProps) {
  const { data } = useSuspenseQuery(platformOrganizationDetailQueryOptions(orgSlug))
  const organization = data.organization
  const dateTimePreferences = resolvePlatformDateTimePreferences({
    locale: organization.locale,
    timeFormatPreference: organization.timeFormatPreference,
    timeZone: organization.timezone,
  })

  if (!organization.tenant) {
    return (
      <div className="px-4 pb-6 md:px-6">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No activity yet</EmptyTitle>
            <EmptyDescription>
              This organization does not have a tenant runtime yet, so there is
              no background activity to inspect.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  const { events, jobs } = buildPlatformActivityData(
    organization,
    dateTimePreferences,
  )

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden px-4 pb-6 md:px-6">
      <PlatformActivityContent
        dateTimePreferences={dateTimePreferences}
        events={events}
        jobs={jobs}
        mode="events"
        orgSlug={organization.slug}
      />
    </div>
  )
}
