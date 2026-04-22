import { Outlet, useParams } from "@tanstack/react-router"

import { PlatformShell } from "@/client/app/app-shell/PlatformShell"
import { PlatformOrganizationRedirectPage } from "@/client/app/pages/PlatformOrganizationRedirectPage"
import { PlatformRedirectPage } from "@/client/app/pages/PlatformRedirectPage"
import { PlatformOrganizationAccessPage } from "@/features/platform/pages/PlatformOrganizationAccessPage"
import { PlatformOrganizationEventsPage } from "@/features/platform/pages/PlatformOrganizationEventsPage"
import { PlatformOrganizationJobsPage } from "@/features/platform/pages/PlatformOrganizationJobsPage"
import { PlatformOrganizationLayoutPage } from "@/features/platform/pages/PlatformOrganizationLayoutPage"
import { PlatformOrganizationLogsPage } from "@/features/platform/pages/PlatformOrganizationLogsPage"
import { PlatformOrganizationOverviewPage } from "@/features/platform/pages/PlatformOrganizationOverviewPage"
import { PlatformOrganizationsPage } from "@/features/platform/pages/PlatformOrganizationsPage"
import { PlatformOrganizationUsagePage } from "@/features/platform/pages/PlatformOrganizationUsagePage"

const platformOrganizationRouteId =
  "/platform/platform-shell/organizations/$platformOrgSlug"

export function PlatformShellRoute() {
  return (
    <PlatformShell>
      <Outlet />
    </PlatformShell>
  )
}

export function PlatformOrganizationsRoutePage() {
  return <PlatformOrganizationsPage />
}

export function PlatformOrganizationLayoutRoutePage() {
  const { platformOrgSlug } = useParams({
    from: platformOrganizationRouteId,
  })

  return <PlatformOrganizationLayoutPage orgSlug={platformOrgSlug} />
}

export function PlatformOrganizationOverviewRoutePage() {
  const { platformOrgSlug } = useParams({
    from: platformOrganizationRouteId,
  })

  return <PlatformOrganizationOverviewPage orgSlug={platformOrgSlug} />
}

export function PlatformOrganizationUsageRoutePage() {
  const { platformOrgSlug } = useParams({
    from: platformOrganizationRouteId,
  })

  return <PlatformOrganizationUsagePage orgSlug={platformOrgSlug} />
}

export function PlatformOrganizationAccessRoutePage() {
  const { platformOrgSlug } = useParams({
    from: platformOrganizationRouteId,
  })

  return <PlatformOrganizationAccessPage orgSlug={platformOrgSlug} />
}

export function PlatformOrganizationJobsRoutePage() {
  const { platformOrgSlug } = useParams({
    from: platformOrganizationRouteId,
  })

  return <PlatformOrganizationJobsPage orgSlug={platformOrgSlug} />
}

export function PlatformOrganizationEventsRoutePage() {
  const { platformOrgSlug } = useParams({
    from: platformOrganizationRouteId,
  })

  return <PlatformOrganizationEventsPage orgSlug={platformOrgSlug} />
}

export function PlatformOrganizationLogsRoutePage() {
  const { platformOrgSlug } = useParams({
    from: platformOrganizationRouteId,
  })

  return <PlatformOrganizationLogsPage orgSlug={platformOrgSlug} />
}

export function PlatformRedirectRoutePage() {
  return <PlatformRedirectPage />
}

export function PlatformOrganizationRedirectRoutePage() {
  const { platformOrgSlug } = useParams({
    from: platformOrganizationRouteId,
  })

  return <PlatformOrganizationRedirectPage orgSlug={platformOrgSlug} />
}
