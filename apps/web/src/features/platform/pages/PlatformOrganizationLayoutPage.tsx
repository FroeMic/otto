import { useSuspenseQuery } from "@tanstack/react-query"
import { Outlet } from "@tanstack/react-router"

import { platformOrganizationDetailQueryOptions } from "@/features/platform/api/platform"
import { PlatformOrganizationActions } from "@/features/platform/components/PlatformOrganizationActions"
import { PlatformOrganizationTabs } from "@/features/platform/components/PlatformOrganizationTabs"

export interface PlatformOrganizationLayoutPageProps {
  orgSlug: string
}

export function PlatformOrganizationLayoutPage({
  orgSlug,
}: PlatformOrganizationLayoutPageProps) {
  const { data } = useSuspenseQuery(
    platformOrganizationDetailQueryOptions(orgSlug),
  )
  const organization = data.organization
  const runtimeReady =
    organization.tenant?.status === "ready" &&
    organization.tenant.serverStatus === "ready"

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 pt-6">
      <div className="flex flex-col gap-4 px-4 md:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {organization.name}
            </h1>
          </div>
          <PlatformOrganizationActions
            hasTenant={Boolean(organization.tenant)}
            hasTenantOpenAiProvider={Boolean(
              organization.tenant?.openAiProvider,
            )}
            hasTenantServer={Boolean(organization.tenant?.serverStatus)}
            orgSlug={organization.slug}
            runtimeReady={Boolean(runtimeReady)}
          />
        </div>
        <PlatformOrganizationTabs orgSlug={organization.slug} />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  )
}
