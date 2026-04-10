import { QueryClient } from "@tanstack/react-query"
import {
  createRootRouteWithContext,
  createRoute,
  Outlet,
} from "@tanstack/react-router"
import { z } from "zod"

import { SettingsShell } from "@/client/app/app-shell/SettingsShell"
import { PlatformShell } from "@/client/app/app-shell/PlatformShell"
import { WorkspaceShell } from "@/client/app/app-shell/WorkspaceShell"
import { PlatformOrganizationRedirectPage } from "@/client/app/pages/PlatformOrganizationRedirectPage"
import { PlatformAuthRequiredPage } from "@/client/app/pages/PlatformAuthRequiredPage"
import { PlatformRedirectPage } from "@/client/app/pages/PlatformRedirectPage"
import { RootPage } from "@/client/app/pages/RootPage"
import { WorkspaceAuthRequiredPage } from "@/client/app/pages/WorkspaceAuthRequiredPage"
import { WorkspaceSettingsRedirectPage } from "@/client/app/pages/WorkspaceSettingsRedirectPage"
import { BillingPage } from "@/features/billing/pages/BillingPage"
import { billingOverviewQueryOptions } from "@/features/billing/api/billing"
import { BillingPlansPage } from "@/features/billing/pages/BillingPlansPage"
import {
  platformBootstrapQueryOptions,
  platformOrganizationDetailQueryOptions,
  platformOrganizationsQueryOptions,
} from "@/features/platform/api/platform"
import { PlatformOrganizationAccessPage } from "@/features/platform/pages/PlatformOrganizationAccessPage"
import { PlatformOrganizationEventsPage } from "@/features/platform/pages/PlatformOrganizationEventsPage"
import { PlatformOrganizationJobsPage } from "@/features/platform/pages/PlatformOrganizationJobsPage"
import { PlatformOrganizationLayoutPage } from "@/features/platform/pages/PlatformOrganizationLayoutPage"
import { PlatformOrganizationLogsPage } from "@/features/platform/pages/PlatformOrganizationLogsPage"
import { PlatformOrganizationOverviewPage } from "@/features/platform/pages/PlatformOrganizationOverviewPage"
import { PlatformOrganizationsPage } from "@/features/platform/pages/PlatformOrganizationsPage"
import { PlatformOrganizationUsagePage } from "@/features/platform/pages/PlatformOrganizationUsagePage"
import { UsagePage } from "@/features/usage/pages/UsagePage"
import {
  ApiResponseError,
  connectedAccountsQueryOptions,
  shellBootstrapQueryOptions,
  userProfileQueryOptions,
} from "@/features/workspace/api/workspace"
import { workspaceMembersQueryOptions } from "@/features/workspace/api/members"
import { UserProfilePage } from "@/features/workspace/pages/UserProfilePage"
import { WorkspaceMembersPage } from "@/features/workspace/pages/WorkspaceMembersPage"
import { WorkspaceOverviewPage } from "@/features/workspace/pages/WorkspaceOverviewPage"
import { WorkspaceSettingsPage } from "@/features/workspace/pages/WorkspaceSettingsPage"

function WorkspaceRouteOutlet() {
  return <Outlet />
}

function PlatformRouteOutlet() {
  return <Outlet />
}

function WorkspaceShellRoute() {
  const { orgSlug } = workspaceRoute.useParams()

  return (
    <WorkspaceShell orgSlug={orgSlug}>
      <WorkspaceOverviewPage orgSlug={orgSlug} />
    </WorkspaceShell>
  )
}

function SettingsShellRoute() {
  const { orgSlug } = workspaceRoute.useParams()

  return (
    <SettingsShell orgSlug={orgSlug}>
      <Outlet />
    </SettingsShell>
  )
}

function WorkspaceSettingsRoutePage() {
  const { orgSlug } = workspaceRoute.useParams()

  return <WorkspaceSettingsPage orgSlug={orgSlug} />
}

function WorkspaceUserSettingsRoutePage() {
  const { orgSlug } = workspaceRoute.useParams()

  return <UserProfilePage orgSlug={orgSlug} />
}

function WorkspaceUsageRoutePage() {
  const { orgSlug } = workspaceRoute.useParams()

  return <UsagePage orgSlug={orgSlug} />
}

function WorkspaceMembersRoutePage() {
  const { orgSlug } = workspaceRoute.useParams()

  return <WorkspaceMembersPage orgSlug={orgSlug} />
}

function WorkspaceBillingRoutePage() {
  const { orgSlug } = workspaceRoute.useParams()

  return <BillingPage orgSlug={orgSlug} />
}

function WorkspaceBillingPlansRoutePage() {
  const { orgSlug } = workspaceRoute.useParams()

  return <BillingPlansPage orgSlug={orgSlug} />
}

function WorkspaceSettingsRedirectRoutePage() {
  const { orgSlug } = workspaceRoute.useParams()

  return <WorkspaceSettingsRedirectPage orgSlug={orgSlug} />
}

function WorkspaceRouteErrorPage(props: { error: unknown }) {
  const { orgSlug } = workspaceRoute.useParams()

  if (
    props.error instanceof ApiResponseError &&
    props.error.status === 401 &&
    props.error.code === "missing_workspace_session"
  ) {
    return (
      <WorkspaceAuthRequiredPage
        message={props.error.message}
        orgSlug={orgSlug}
      />
    )
  }

  throw props.error
}

function PlatformShellRoute() {
  return (
    <PlatformShell>
      <Outlet />
    </PlatformShell>
  )
}

function PlatformRouteErrorPage(props: { error: unknown }) {
  if (props.error instanceof ApiResponseError) {
    if (props.error.status === 401) {
      return <PlatformAuthRequiredPage message={props.error.message} />
    }

    if (props.error.status === 403) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center px-6 py-16">
          <div className="flex max-w-lg flex-col gap-3 text-center">
            <h1 className="text-3xl font-semibold tracking-tight">
              Platform access required
            </h1>
            <p className="text-sm text-muted-foreground">
              You need the platform admin role to access the operator UI.
            </p>
          </div>
        </div>
      )
    }
  }

  throw props.error
}

function PlatformOrganizationsRoutePage() {
  return <PlatformOrganizationsPage />
}

function PlatformOrganizationLayoutRoutePage() {
  const { platformOrgSlug } = platformOrganizationRoute.useParams()

  return <PlatformOrganizationLayoutPage orgSlug={platformOrgSlug} />
}

function PlatformOrganizationOverviewRoutePage() {
  const { platformOrgSlug } = platformOrganizationRoute.useParams()

  return <PlatformOrganizationOverviewPage orgSlug={platformOrgSlug} />
}

function PlatformOrganizationUsageRoutePage() {
  const { platformOrgSlug } = platformOrganizationRoute.useParams()

  return <PlatformOrganizationUsagePage orgSlug={platformOrgSlug} />
}

function PlatformOrganizationAccessRoutePage() {
  const { platformOrgSlug } = platformOrganizationRoute.useParams()

  return <PlatformOrganizationAccessPage orgSlug={platformOrgSlug} />
}

function PlatformOrganizationJobsRoutePage() {
  const { platformOrgSlug } = platformOrganizationRoute.useParams()

  return <PlatformOrganizationJobsPage orgSlug={platformOrgSlug} />
}

function PlatformOrganizationEventsRoutePage() {
  const { platformOrgSlug } = platformOrganizationRoute.useParams()

  return <PlatformOrganizationEventsPage orgSlug={platformOrgSlug} />
}

function PlatformOrganizationLogsRoutePage() {
  const { platformOrgSlug } = platformOrganizationRoute.useParams()

  return <PlatformOrganizationLogsPage orgSlug={platformOrgSlug} />
}

function PlatformRedirectRoutePage() {
  return <PlatformRedirectPage />
}

function PlatformOrganizationRedirectRoutePage() {
  const { platformOrgSlug } = platformOrganizationRoute.useParams()

  return <PlatformOrganizationRedirectPage orgSlug={platformOrgSlug} />
}

export const rootRoute = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  component: Outlet,
})

const billingSearchSchema = z.object({
  checkout: z.enum(["success", "canceled"]).optional(),
})

const homeRoute = createRoute({
  component: RootPage,
  getParentRoute: () => rootRoute,
  path: "/",
})

export const workspaceRoute = createRoute({
  component: WorkspaceRouteOutlet,
  errorComponent: WorkspaceRouteErrorPage,
  getParentRoute: () => rootRoute,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      shellBootstrapQueryOptions(params.orgSlug),
    ),
  path: "/$orgSlug",
})

const workspaceIndexRoute = createRoute({
  component: WorkspaceShellRoute,
  getParentRoute: () => workspaceRoute,
  path: "/",
})

const workspaceSettingsRoute = createRoute({
  component: SettingsShellRoute,
  getParentRoute: () => workspaceRoute,
  path: "/settings",
})

const workspaceSettingsIndexRoute = createRoute({
  component: WorkspaceSettingsRedirectRoutePage,
  getParentRoute: () => workspaceSettingsRoute,
  path: "/",
})

const workspaceSettingsWorkspaceRoute = createRoute({
  component: WorkspaceSettingsRoutePage,
  getParentRoute: () => workspaceSettingsRoute,
  path: "/workspace",
})

const workspaceSettingsUserRoute = createRoute({
  component: WorkspaceUserSettingsRoutePage,
  getParentRoute: () => workspaceSettingsRoute,
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(userProfileQueryOptions()),
      context.queryClient.ensureQueryData(
        connectedAccountsQueryOptions(params.orgSlug),
      ),
    ]),
  path: "/user",
})

const workspaceSettingsMembersRoute = createRoute({
  component: WorkspaceMembersRoutePage,
  getParentRoute: () => workspaceSettingsRoute,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      workspaceMembersQueryOptions(params.orgSlug),
    ),
  path: "/workspace/members",
})

const workspaceSettingsUsageRoute = createRoute({
  component: WorkspaceUsageRoutePage,
  getParentRoute: () => workspaceSettingsRoute,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      billingOverviewQueryOptions(params.orgSlug),
    ),
  path: "/workspace/usage",
})

const workspaceSettingsBillingRoute = createRoute({
  component: WorkspaceBillingRoutePage,
  getParentRoute: () => workspaceSettingsRoute,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      billingOverviewQueryOptions(params.orgSlug),
    ),
  path: "/workspace/billing",
  validateSearch: (search) => billingSearchSchema.parse(search),
})

const workspaceSettingsBillingPlansRoute = createRoute({
  component: WorkspaceBillingPlansRoutePage,
  getParentRoute: () => workspaceSettingsRoute,
  path: "/workspace/billing/plans",
})

const platformRoute = createRoute({
  component: PlatformRouteOutlet,
  errorComponent: PlatformRouteErrorPage,
  getParentRoute: () => rootRoute,
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(platformBootstrapQueryOptions()),
  path: "/platform",
})

const platformShellRoute = createRoute({
  component: PlatformShellRoute,
  getParentRoute: () => platformRoute,
  path: "/",
})

const platformIndexRoute = createRoute({
  component: PlatformRedirectRoutePage,
  getParentRoute: () => platformShellRoute,
  path: "/",
})

const platformOrganizationsRoute = createRoute({
  component: PlatformOrganizationsRoutePage,
  getParentRoute: () => platformShellRoute,
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(platformOrganizationsQueryOptions()),
  path: "/organizations",
})

const platformOrganizationRoute = createRoute({
  component: PlatformOrganizationLayoutRoutePage,
  getParentRoute: () => platformShellRoute,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      platformOrganizationDetailQueryOptions(params.platformOrgSlug),
    ),
  path: "/organizations/$platformOrgSlug",
})

const platformOrganizationIndexRoute = createRoute({
  component: PlatformOrganizationRedirectRoutePage,
  getParentRoute: () => platformOrganizationRoute,
  path: "/",
})

const platformOrganizationOverviewRoute = createRoute({
  component: PlatformOrganizationOverviewRoutePage,
  getParentRoute: () => platformOrganizationRoute,
  path: "/overview",
})

const platformOrganizationUsageRoute = createRoute({
  component: PlatformOrganizationUsageRoutePage,
  getParentRoute: () => platformOrganizationRoute,
  path: "/usage",
})

const platformOrganizationAccessRoute = createRoute({
  component: PlatformOrganizationAccessRoutePage,
  getParentRoute: () => platformOrganizationRoute,
  path: "/access",
})

const platformOrganizationJobsRoute = createRoute({
  component: PlatformOrganizationJobsRoutePage,
  getParentRoute: () => platformOrganizationRoute,
  path: "/jobs",
})

const platformOrganizationEventsRoute = createRoute({
  component: PlatformOrganizationEventsRoutePage,
  getParentRoute: () => platformOrganizationRoute,
  path: "/events",
})

const platformOrganizationLogsRoute = createRoute({
  component: PlatformOrganizationLogsRoutePage,
  getParentRoute: () => platformOrganizationRoute,
  path: "/logs",
})

export const routeTree = rootRoute.addChildren([
  homeRoute,
  workspaceRoute.addChildren([
    workspaceIndexRoute,
    workspaceSettingsRoute.addChildren([
      workspaceSettingsIndexRoute,
      workspaceSettingsUserRoute,
      workspaceSettingsWorkspaceRoute,
      workspaceSettingsMembersRoute,
      workspaceSettingsUsageRoute,
      workspaceSettingsBillingRoute,
      workspaceSettingsBillingPlansRoute,
    ]),
  ]),
  platformRoute.addChildren([
    platformShellRoute.addChildren([
      platformIndexRoute,
      platformOrganizationsRoute,
      platformOrganizationRoute.addChildren([
        platformOrganizationIndexRoute,
        platformOrganizationOverviewRoute,
        platformOrganizationUsageRoute,
        platformOrganizationAccessRoute,
        platformOrganizationJobsRoute,
        platformOrganizationEventsRoute,
        platformOrganizationLogsRoute,
      ]),
    ]),
  ]),
])
