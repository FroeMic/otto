import { QueryClient } from "@tanstack/react-query"
import {
  createRootRouteWithContext,
  createRoute,
  Outlet,
} from "@tanstack/react-router"
import { z } from "zod"

import { SettingsShell } from "@/client/app/app-shell/SettingsShell"
import { WorkspaceShell } from "@/client/app/app-shell/WorkspaceShell"
import { PlatformRoutePage } from "@/client/app/pages/PlatformRoutePage"
import { RootPage } from "@/client/app/pages/RootPage"
import { WorkspaceSettingsRedirectPage } from "@/client/app/pages/WorkspaceSettingsRedirectPage"
import { BillingPage } from "@/features/billing/pages/BillingPage"
import { BillingPlansPage } from "@/features/billing/pages/BillingPlansPage"
import { UsagePage } from "@/features/usage/pages/UsagePage"
import { shellBootstrapQueryOptions } from "@/features/workspace/api/workspace"
import { UserProfilePage } from "@/features/workspace/pages/UserProfilePage"
import { WorkspaceMembersPage } from "@/features/workspace/pages/WorkspaceMembersPage"
import { WorkspaceOverviewPage } from "@/features/workspace/pages/WorkspaceOverviewPage"
import { WorkspaceSettingsPage } from "@/features/workspace/pages/WorkspaceSettingsPage"

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
  component: Outlet,
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
  path: "/user",
})

const workspaceSettingsMembersRoute = createRoute({
  component: WorkspaceMembersPage,
  getParentRoute: () => workspaceSettingsRoute,
  path: "/workspace/members",
})

const workspaceSettingsUsageRoute = createRoute({
  component: WorkspaceUsageRoutePage,
  getParentRoute: () => workspaceSettingsRoute,
  path: "/workspace/usage",
})

const workspaceSettingsBillingRoute = createRoute({
  component: WorkspaceBillingRoutePage,
  getParentRoute: () => workspaceSettingsRoute,
  path: "/workspace/billing",
  validateSearch: (search) => billingSearchSchema.parse(search),
})

const workspaceSettingsBillingPlansRoute = createRoute({
  component: WorkspaceBillingPlansRoutePage,
  getParentRoute: () => workspaceSettingsRoute,
  path: "/workspace/billing/plans",
})

const platformRoute = createRoute({
  component: PlatformRoutePage,
  getParentRoute: () => rootRoute,
  path: "/platform",
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
  platformRoute,
])
