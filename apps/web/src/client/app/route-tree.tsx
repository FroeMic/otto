import { QueryClient } from "@tanstack/react-query"
import {
  createRootRouteWithContext,
  createRoute,
  lazyRouteComponent,
  Outlet,
} from "@tanstack/react-router"
import { z } from "zod"

import { SettingsShell } from "@/client/app/app-shell/SettingsShell"
import { WorkspaceShell } from "@/client/app/app-shell/WorkspaceShell"
import { PlatformAuthRequiredPage } from "@/client/app/pages/PlatformAuthRequiredPage"
import { RootPage } from "@/client/app/pages/RootPage"
import { WorkspaceAuthRequiredPage } from "@/client/app/pages/WorkspaceAuthRequiredPage"
import { WorkspaceSettingsRedirectPage } from "@/client/app/pages/WorkspaceSettingsRedirectPage"
import { BillingPage } from "@/features/billing/pages/BillingPage"
import { billingOverviewQueryOptions } from "@/features/billing/api/billing"
import { BillingPlansPage } from "@/features/billing/pages/BillingPlansPage"
import {
  workspaceIntegrationDetailQueryOptions,
  workspaceIntegrationsQueryOptions,
} from "@/features/integrations/api/integrations"
import { IntegrationDetailLayoutPage } from "@/features/integrations/pages/IntegrationDetailLayoutPage"
import { IntegrationDetailRedirectPage } from "@/features/integrations/pages/IntegrationDetailRedirectPage"
import { IntegrationsPage } from "@/features/integrations/pages/IntegrationsPage"
import { UsagePage } from "@/features/usage/pages/UsagePage"
import {
  workspaceChatConversationDetailQueryOptions,
  workspaceChatConversationListQueryOptions,
} from "@/features/workspace-chat/api/chat"
import { WorkspaceConversationPage } from "@/features/workspace-chat/pages/WorkspaceConversationPage"
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

async function importPlatformApiModule() {
  return import("@/features/platform/api/platform")
}

function WorkspaceShellRoute() {
  const { orgSlug } = workspaceRoute.useParams()

  return (
    <WorkspaceShell orgSlug={orgSlug}>
      <WorkspaceOverviewPage orgSlug={orgSlug} />
    </WorkspaceShell>
  )
}

function WorkspaceConversationRoutePage() {
  const { conversationId, orgSlug } = workspaceConversationRoute.useParams()

  return (
    <WorkspaceShell orgSlug={orgSlug}>
      <WorkspaceConversationPage
        conversationId={conversationId}
        orgSlug={orgSlug}
      />
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

function WorkspaceIntegrationsRoutePage() {
  const { orgSlug } = workspaceRoute.useParams()

  return <IntegrationsPage orgSlug={orgSlug} />
}

function WorkspaceIntegrationDetailRedirectRoutePage() {
  const { integrationKey, orgSlug } = workspaceIntegrationRedirectRoute.useParams()

  return (
    <IntegrationDetailRedirectPage
      integrationKey={integrationKey}
      orgSlug={orgSlug}
    />
  )
}

function WorkspaceIntegrationDetailRoutePage() {
  const { integrationKey, orgSlug, section } =
    workspaceIntegrationDetailRoute.useParams()

  return (
    <IntegrationDetailLayoutPage
      integrationKey={integrationKey}
      orgSlug={orgSlug}
      section={section}
    />
  )
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

const workspaceConversationRoute = createRoute({
  component: WorkspaceConversationRoutePage,
  getParentRoute: () => workspaceRoute,
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(
        workspaceChatConversationListQueryOptions(params.orgSlug),
      ),
      context.queryClient.ensureQueryData(
        workspaceChatConversationDetailQueryOptions(
          params.orgSlug,
          params.conversationId,
        ),
      ),
    ]),
  path: "/c/$conversationId",
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

const workspaceSettingsIntegrationsRoute = createRoute({
  component: WorkspaceIntegrationsRoutePage,
  getParentRoute: () => workspaceSettingsRoute,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      workspaceIntegrationsQueryOptions(params.orgSlug),
    ),
  path: "/agent/integrations",
})

const workspaceIntegrationRedirectRoute = createRoute({
  component: WorkspaceIntegrationDetailRedirectRoutePage,
  getParentRoute: () => workspaceSettingsRoute,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      workspaceIntegrationDetailQueryOptions({
        integrationKey: params.integrationKey,
        orgSlug: params.orgSlug,
      }),
    ),
  path: "/agent/integrations/$integrationKey",
})

const workspaceIntegrationDetailRoute = createRoute({
  component: WorkspaceIntegrationDetailRoutePage,
  getParentRoute: () => workspaceSettingsRoute,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      workspaceIntegrationDetailQueryOptions({
        integrationKey: params.integrationKey,
        orgSlug: params.orgSlug,
      }),
    ),
  path: "/agent/integrations/$integrationKey/$section",
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
  loader: async ({ context }) => {
    const { platformBootstrapQueryOptions } = await importPlatformApiModule()

    return context.queryClient.ensureQueryData(platformBootstrapQueryOptions())
  },
  path: "/platform",
})

const platformShellRoute = createRoute({
  component: lazyRouteComponent(
    () => import("./platform-routes"),
    "PlatformShellRoute",
  ),
  getParentRoute: () => platformRoute,
  id: "platform-shell",
})

const platformIndexRoute = createRoute({
  component: lazyRouteComponent(
    () => import("./platform-routes"),
    "PlatformRedirectRoutePage",
  ),
  getParentRoute: () => platformShellRoute,
  path: "/",
})

const platformOrganizationsRoute = createRoute({
  component: lazyRouteComponent(
    () => import("./platform-routes"),
    "PlatformOrganizationsRoutePage",
  ),
  getParentRoute: () => platformShellRoute,
  loader: async ({ context }) => {
    const { platformOrganizationsQueryOptions } = await importPlatformApiModule()

    return context.queryClient.ensureQueryData(
      platformOrganizationsQueryOptions(),
    )
  },
  path: "/organizations",
})

const platformOrganizationRoute = createRoute({
  component: lazyRouteComponent(
    () => import("./platform-routes"),
    "PlatformOrganizationLayoutRoutePage",
  ),
  getParentRoute: () => platformShellRoute,
  loader: async ({ context, params }) => {
    const { platformOrganizationDetailQueryOptions } =
      await importPlatformApiModule()

    return context.queryClient.ensureQueryData(
      platformOrganizationDetailQueryOptions(params.platformOrgSlug),
    )
  },
  path: "/organizations/$platformOrgSlug",
})

const platformOrganizationIndexRoute = createRoute({
  component: lazyRouteComponent(
    () => import("./platform-routes"),
    "PlatformOrganizationRedirectRoutePage",
  ),
  getParentRoute: () => platformOrganizationRoute,
  path: "/",
})

const platformOrganizationOverviewRoute = createRoute({
  component: lazyRouteComponent(
    () => import("./platform-routes"),
    "PlatformOrganizationOverviewRoutePage",
  ),
  getParentRoute: () => platformOrganizationRoute,
  path: "/overview",
})

const platformOrganizationUsageRoute = createRoute({
  component: lazyRouteComponent(
    () => import("./platform-routes"),
    "PlatformOrganizationUsageRoutePage",
  ),
  getParentRoute: () => platformOrganizationRoute,
  path: "/usage",
})

const platformOrganizationAccessRoute = createRoute({
  component: lazyRouteComponent(
    () => import("./platform-routes"),
    "PlatformOrganizationAccessRoutePage",
  ),
  getParentRoute: () => platformOrganizationRoute,
  path: "/access",
})

const platformOrganizationJobsRoute = createRoute({
  component: lazyRouteComponent(
    () => import("./platform-routes"),
    "PlatformOrganizationJobsRoutePage",
  ),
  getParentRoute: () => platformOrganizationRoute,
  path: "/jobs",
})

const platformOrganizationEventsRoute = createRoute({
  component: lazyRouteComponent(
    () => import("./platform-routes"),
    "PlatformOrganizationEventsRoutePage",
  ),
  getParentRoute: () => platformOrganizationRoute,
  path: "/events",
})

const platformOrganizationLogsRoute = createRoute({
  component: lazyRouteComponent(
    () => import("./platform-routes"),
    "PlatformOrganizationLogsRoutePage",
  ),
  getParentRoute: () => platformOrganizationRoute,
  path: "/logs",
})

export const routeTree = rootRoute.addChildren([
  homeRoute,
  workspaceRoute.addChildren([
    workspaceIndexRoute,
    workspaceConversationRoute,
    workspaceSettingsRoute.addChildren([
      workspaceSettingsIndexRoute,
      workspaceSettingsUserRoute,
      workspaceSettingsIntegrationsRoute,
      workspaceIntegrationRedirectRoute,
      workspaceIntegrationDetailRoute,
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
