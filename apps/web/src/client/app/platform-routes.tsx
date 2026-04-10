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

export interface PlatformShellRouteProps {}

export function PlatformShellRoute(_props: PlatformShellRouteProps) {
  return (
    <PlatformShell>
      <Outlet />
    </PlatformShell>
  )
}

export interface PlatformOrganizationsRoutePageProps {}

export function PlatformOrganizationsRoutePage(
  _props: PlatformOrganizationsRoutePageProps,
) {
  return <PlatformOrganizationsPage />
}

export interface PlatformOrganizationLayoutRoutePageProps {}

export function PlatformOrganizationLayoutRoutePage(
  _props: PlatformOrganizationLayoutRoutePageProps,
) {
  const { platformOrgSlug } = useParams({
    from: "/platform/organizations/$platformOrgSlug",
  })

  return <PlatformOrganizationLayoutPage orgSlug={platformOrgSlug} />
}

export interface PlatformOrganizationOverviewRoutePageProps {}

export function PlatformOrganizationOverviewRoutePage(
  _props: PlatformOrganizationOverviewRoutePageProps,
) {
  const { platformOrgSlug } = useParams({
    from: "/platform/organizations/$platformOrgSlug",
  })

  return <PlatformOrganizationOverviewPage orgSlug={platformOrgSlug} />
}

export interface PlatformOrganizationUsageRoutePageProps {}

export function PlatformOrganizationUsageRoutePage(
  _props: PlatformOrganizationUsageRoutePageProps,
) {
  const { platformOrgSlug } = useParams({
    from: "/platform/organizations/$platformOrgSlug",
  })

  return <PlatformOrganizationUsagePage orgSlug={platformOrgSlug} />
}

export interface PlatformOrganizationAccessRoutePageProps {}

export function PlatformOrganizationAccessRoutePage(
  _props: PlatformOrganizationAccessRoutePageProps,
) {
  const { platformOrgSlug } = useParams({
    from: "/platform/organizations/$platformOrgSlug",
  })

  return <PlatformOrganizationAccessPage orgSlug={platformOrgSlug} />
}

export interface PlatformOrganizationJobsRoutePageProps {}

export function PlatformOrganizationJobsRoutePage(
  _props: PlatformOrganizationJobsRoutePageProps,
) {
  const { platformOrgSlug } = useParams({
    from: "/platform/organizations/$platformOrgSlug",
  })

  return <PlatformOrganizationJobsPage orgSlug={platformOrgSlug} />
}

export interface PlatformOrganizationEventsRoutePageProps {}

export function PlatformOrganizationEventsRoutePage(
  _props: PlatformOrganizationEventsRoutePageProps,
) {
  const { platformOrgSlug } = useParams({
    from: "/platform/organizations/$platformOrgSlug",
  })

  return <PlatformOrganizationEventsPage orgSlug={platformOrgSlug} />
}

export interface PlatformOrganizationLogsRoutePageProps {}

export function PlatformOrganizationLogsRoutePage(
  _props: PlatformOrganizationLogsRoutePageProps,
) {
  const { platformOrgSlug } = useParams({
    from: "/platform/organizations/$platformOrgSlug",
  })

  return <PlatformOrganizationLogsPage orgSlug={platformOrgSlug} />
}

export interface PlatformRedirectRoutePageProps {}

export function PlatformRedirectRoutePage(_props: PlatformRedirectRoutePageProps) {
  return <PlatformRedirectPage />
}

export interface PlatformOrganizationRedirectRoutePageProps {}

export function PlatformOrganizationRedirectRoutePage(
  _props: PlatformOrganizationRedirectRoutePageProps,
) {
  const { platformOrgSlug } = useParams({
    from: "/platform/organizations/$platformOrgSlug",
  })

  return <PlatformOrganizationRedirectPage orgSlug={platformOrgSlug} />
}
