import { useSuspenseQuery } from "@tanstack/react-query"

import { platformOrganizationsQueryOptions } from "@/features/platform/api/platform"
import { PlatformOrganizationsTable } from "@/features/platform/components/PlatformOrganizationsTable"

export interface PlatformOrganizationsPageProps {}

export function PlatformOrganizationsPage(
  _props: PlatformOrganizationsPageProps,
) {
  const { data } = useSuspenseQuery(platformOrganizationsQueryOptions())

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 pt-6">
      <div className="px-4 md:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
      </div>
      <PlatformOrganizationsTable organizations={data.organizations} />
    </div>
  )
}
