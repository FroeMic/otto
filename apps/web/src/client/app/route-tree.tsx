import type { QueryClient } from "@tanstack/react-query"
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
import {
  agentPersonalizationDetailQueryOptions,
  agentPersonalizationOverviewQueryOptions,
} from "@/features/agent/api/agent"
import { AgentPersonalizationDetailPage } from "@/features/agent/pages/AgentPersonalizationDetailPage"
import { AgentPersonalizationPage } from "@/features/agent/pages/AgentPersonalizationPage"
import { AgentPersonalizationSystemPage } from "@/features/agent/pages/AgentPersonalizationSystemPage"
import { LegacyAgentRedirectPage } from "@/features/agent/pages/LegacyAgentRedirectPage"
import { billingOverviewQueryOptions } from "@/features/billing/api/billing"
import { BillingPage } from "@/features/billing/pages/BillingPage"
import { BillingPlansPage } from "@/features/billing/pages/BillingPlansPage"
import { workspaceFilesQueryOptions } from "@/features/files/api/files"
import { LegacyFilesRedirectPage } from "@/features/files/pages/LegacyFilesRedirectPage"
import { WorkspaceFilesPage } from "@/features/files/pages/WorkspaceFilesPage"
import {
  workspaceSessionDetailQueryOptions,
  workspaceSessionsQueryOptions,
} from "@/features/sessions/api/sessions"
import { SessionDetailPage } from "@/features/sessions/pages/SessionDetailPage"
import { SessionsPage } from "@/features/sessions/pages/SessionsPage"
import {
  workspaceScheduledTaskDetailQueryOptions,
  workspaceScheduledTaskRunsQueryOptions,
  workspaceScheduledTasksQueryOptions,
} from "@/features/scheduled-tasks/api/scheduled-tasks"
import { ScheduledTaskConfigurationPage } from "@/features/scheduled-tasks/pages/ScheduledTaskConfigurationPage"
import { ScheduledTaskDetailRedirectPage } from "@/features/scheduled-tasks/pages/ScheduledTaskDetailRedirectPage"
import { ScheduledTaskDetailRunsPage } from "@/features/scheduled-tasks/pages/ScheduledTaskDetailRunsPage"
import { ScheduledTaskOverviewPage } from "@/features/scheduled-tasks/pages/ScheduledTaskOverviewPage"
import { ScheduledTaskRunsPage } from "@/features/scheduled-tasks/pages/ScheduledTaskRunsPage"
import { ScheduledTasksPage } from "@/features/scheduled-tasks/pages/ScheduledTasksPage"
import { ScheduledTasksRedirectPage } from "@/features/scheduled-tasks/pages/ScheduledTasksRedirectPage"
import { workspaceSkillFilesQueryOptions } from "@/features/skills/api/skill-files"
import {
  workspaceSkillDetailQueryOptions,
  workspaceSkillsQueryOptions,
} from "@/features/skills/api/skills"
import { SkillDetailRedirectPage } from "@/features/skills/pages/SkillDetailRedirectPage"
import { SkillFilesPage } from "@/features/skills/pages/SkillFilesPage"
import { SkillsPage } from "@/features/skills/pages/SkillsPage"
import { SkillStatusPage } from "@/features/skills/pages/SkillStatusPage"
import {
  workspaceIntegrationDetailQueryOptions,
  workspaceIntegrationsQueryOptions,
} from "@/features/integrations/api/integrations"
import { IntegrationDetailLayoutPage } from "@/features/integrations/pages/IntegrationDetailLayoutPage"
import { IntegrationDetailRedirectPage } from "@/features/integrations/pages/IntegrationDetailRedirectPage"
import { IntegrationsPage } from "@/features/integrations/pages/IntegrationsPage"
import { UsagePage } from "@/features/usage/pages/UsagePage"
import { workspaceMembersQueryOptions } from "@/features/workspace/api/members"
import {
  ApiResponseError,
  connectedAccountsQueryOptions,
  shellBootstrapQueryOptions,
  userProfileQueryOptions,
} from "@/features/workspace/api/workspace"
import { UserProfilePage } from "@/features/workspace/pages/UserProfilePage"
import { WorkspaceMembersPage } from "@/features/workspace/pages/WorkspaceMembersPage"
import { WorkspaceOverviewPage } from "@/features/workspace/pages/WorkspaceOverviewPage"
import { WorkspaceSettingsPage } from "@/features/workspace/pages/WorkspaceSettingsPage"
import {
  workspaceChatConversationDetailQueryOptions,
  workspaceChatConversationListQueryOptions,
} from "@/features/workspace-chat/api/chat"
import { WorkspaceConversationPage } from "@/features/workspace-chat/pages/WorkspaceConversationPage"

function WorkspaceRouteOutlet() {
  return <Outlet />
}

function WorkspaceShellOutlet() {
  const { orgSlug } = workspaceRoute.useParams()

  return (
    <WorkspaceShell orgSlug={orgSlug}>
      <Outlet />
    </WorkspaceShell>
  )
}

function PlatformRouteOutlet() {
  return <Outlet />
}

async function importPlatformApiModule() {
  return import("@/features/platform/api/platform")
}

function WorkspaceOverviewRoutePage() {
  const { orgSlug } = workspaceRoute.useParams()

  return <WorkspaceOverviewPage orgSlug={orgSlug} />
}

function WorkspaceConversationRoutePage() {
  const { conversationId, orgSlug } = workspaceConversationRoute.useParams()

  return (
    <WorkspaceConversationPage
      conversationId={conversationId}
      orgSlug={orgSlug}
    />
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

function WorkspaceFilesRoutePage() {
  const { orgSlug } = workspaceRoute.useParams()

  return <WorkspaceFilesPage orgSlug={orgSlug} />
}

function WorkspaceSessionsRoutePage() {
  const { orgSlug } = workspaceRoute.useParams()

  return <SessionsPage orgSlug={orgSlug} />
}

function WorkspaceSessionDetailRoutePage() {
  const { orgSlug, sessionKey } = workspaceSessionDetailRoute.useParams()

  return <SessionDetailPage orgSlug={orgSlug} sessionKey={sessionKey} />
}

function WorkspaceSkillsRoutePage() {
  const { orgSlug } = workspaceRoute.useParams()

  return <SkillsPage orgSlug={orgSlug} />
}

function WorkspaceScheduledTasksRedirectRoutePage() {
  const { orgSlug } = workspaceRoute.useParams()

  return <ScheduledTasksRedirectPage orgSlug={orgSlug} />
}

function WorkspaceScheduledTasksRoutePage() {
  const { orgSlug } = workspaceRoute.useParams()

  return <ScheduledTasksPage orgSlug={orgSlug} />
}

function WorkspaceScheduledTaskRunsRoutePage() {
  const { orgSlug } = workspaceRoute.useParams()

  return <ScheduledTaskRunsPage orgSlug={orgSlug} />
}

function WorkspaceScheduledTaskDetailRedirectRoutePage() {
  const { orgSlug, taskKey } = workspaceScheduledTaskRedirectRoute.useParams()

  return <ScheduledTaskDetailRedirectPage orgSlug={orgSlug} taskKey={taskKey} />
}

function WorkspaceScheduledTaskOverviewRoutePage() {
  const { orgSlug, taskKey } = workspaceScheduledTaskOverviewRoute.useParams()

  return <ScheduledTaskOverviewPage orgSlug={orgSlug} taskKey={taskKey} />
}

function WorkspaceScheduledTaskConfigurationRoutePage() {
  const { orgSlug, taskKey } =
    workspaceScheduledTaskConfigurationRoute.useParams()

  return (
    <ScheduledTaskConfigurationPage orgSlug={orgSlug} taskKey={taskKey} />
  )
}

function WorkspaceScheduledTaskRunsDetailRoutePage() {
  const { orgSlug, taskKey } =
    workspaceScheduledTaskDetailRunsRoute.useParams()

  return <ScheduledTaskDetailRunsPage orgSlug={orgSlug} taskKey={taskKey} />
}

function WorkspaceSkillDetailRedirectRoutePage() {
  const { orgSlug, skillKey } = workspaceSkillRedirectRoute.useParams()

  return <SkillDetailRedirectPage orgSlug={orgSlug} skillKey={skillKey} />
}

function WorkspaceSkillStatusRoutePage() {
  const { orgSlug, skillKey } = workspaceSkillStatusRoute.useParams()

  return <SkillStatusPage orgSlug={orgSlug} skillKey={skillKey} />
}

function WorkspaceSkillFilesRoutePage() {
  const { orgSlug, skillKey } = workspaceSkillFilesRoute.useParams()

  return <SkillFilesPage orgSlug={orgSlug} skillKey={skillKey} />
}

function WorkspaceAgentPersonalizationRoutePage() {
  const { orgSlug } = workspaceRoute.useParams()

  return <AgentPersonalizationPage orgSlug={orgSlug} />
}

function WorkspaceAgentPersonalizationDetailRoutePage() {
  const { instructionTab, orgSlug } =
    workspaceAgentPersonalizationDetailRoute.useParams()

  return (
    <AgentPersonalizationDetailPage
      instructionTab={instructionTab}
      orgSlug={orgSlug}
    />
  )
}

function WorkspaceAgentPersonalizationSystemRoutePage() {
  const { instructionTab, orgSlug } =
    workspaceAgentPersonalizationSystemRoute.useParams()

  return (
    <AgentPersonalizationSystemPage
      instructionTab={instructionTab}
      orgSlug={orgSlug}
    />
  )
}

function LegacyWorkspaceAgentRedirectRoutePage() {
  const { orgSlug } = workspaceRoute.useParams()

  return <LegacyAgentRedirectPage orgSlug={orgSlug} />
}

function LegacyWorkspaceAgentInstructionRedirectRoutePage() {
  const { instructionTab, orgSlug } =
    workspaceLegacyAgentInstructionRoute.useParams()

  return (
    <LegacyAgentRedirectPage
      instructionTab={instructionTab}
      orgSlug={orgSlug}
    />
  )
}

function LegacyWorkspaceFilesRedirectRoutePage() {
  const { orgSlug } = workspaceRoute.useParams()

  return <LegacyFilesRedirectPage orgSlug={orgSlug} />
}

function WorkspaceIntegrationDetailRedirectRoutePage() {
  const { integrationKey, orgSlug } =
    workspaceIntegrationRedirectRoute.useParams()

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

function WorkspaceSessionDetailRouteErrorPage(props: { error: unknown }) {
  if (
    props.error instanceof ApiResponseError &&
    props.error.status === 404 &&
    props.error.code === "session_not_found"
  ) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-6 py-16">
        <div className="flex max-w-lg flex-col gap-3 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            Session not found
          </h1>
          <p className="text-sm text-muted-foreground">
            This session does not exist or you do not have access to it.
          </p>
        </div>
      </div>
    )
  }

  throw props.error
}

function WorkspaceScheduledTaskDetailRouteErrorPage(props: { error: unknown }) {
  if (
    props.error instanceof ApiResponseError &&
    props.error.status === 404 &&
    props.error.code === "scheduled_task_not_found"
  ) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-6 py-16">
        <div className="flex max-w-lg flex-col gap-3 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            Scheduled task not found
          </h1>
          <p className="text-sm text-muted-foreground">
            This scheduled task does not exist or is no longer available in the
            runtime snapshot.
          </p>
        </div>
      </div>
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

const workspaceShellRoute = createRoute({
  component: WorkspaceShellOutlet,
  getParentRoute: () => workspaceRoute,
  id: "workspace-shell",
})

const workspaceIndexRoute = createRoute({
  component: WorkspaceOverviewRoutePage,
  getParentRoute: () => workspaceShellRoute,
  path: "/",
})

const workspaceConversationRoute = createRoute({
  component: WorkspaceConversationRoutePage,
  getParentRoute: () => workspaceShellRoute,
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

const workspaceLegacyAgentRoute = createRoute({
  component: LegacyWorkspaceAgentRedirectRoutePage,
  getParentRoute: () => workspaceShellRoute,
  path: "/agent",
})

const workspaceLegacyAgentStatusRoute = createRoute({
  component: LegacyWorkspaceAgentRedirectRoutePage,
  getParentRoute: () => workspaceShellRoute,
  path: "/agent/status",
})

const workspaceLegacyAgentPromptsRoute = createRoute({
  component: LegacyWorkspaceAgentRedirectRoutePage,
  getParentRoute: () => workspaceShellRoute,
  path: "/agent/prompts",
})

const workspaceLegacyAgentInstructionRoute = createRoute({
  component: LegacyWorkspaceAgentInstructionRedirectRoutePage,
  getParentRoute: () => workspaceShellRoute,
  path: "/agent/$instructionTab",
})

const workspaceLegacyFilesRoute = createRoute({
  component: LegacyWorkspaceFilesRedirectRoutePage,
  getParentRoute: () => workspaceShellRoute,
  path: "/files",
})

const workspaceSessionsRoute = createRoute({
  component: WorkspaceSessionsRoutePage,
  getParentRoute: () => workspaceShellRoute,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      workspaceSessionsQueryOptions(params.orgSlug),
    ),
  path: "/sessions",
})

const workspaceSessionDetailRoute = createRoute({
  component: WorkspaceSessionDetailRoutePage,
  errorComponent: WorkspaceSessionDetailRouteErrorPage,
  getParentRoute: () => workspaceShellRoute,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      workspaceSessionDetailQueryOptions({
        orgSlug: params.orgSlug,
        sessionKey: params.sessionKey,
      }),
    ),
  path: "/sessions/$sessionKey",
})

const workspaceSkillsRoute = createRoute({
  component: WorkspaceSkillsRoutePage,
  getParentRoute: () => workspaceShellRoute,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      workspaceSkillsQueryOptions(params.orgSlug),
    ),
  path: "/skills",
})

const workspaceScheduledTasksRedirectRoute = createRoute({
  component: WorkspaceScheduledTasksRedirectRoutePage,
  getParentRoute: () => workspaceShellRoute,
  path: "/scheduled-tasks",
})

const workspaceScheduledTasksRoute = createRoute({
  component: WorkspaceScheduledTasksRoutePage,
  getParentRoute: () => workspaceShellRoute,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      workspaceScheduledTasksQueryOptions(params.orgSlug),
    ),
  path: "/scheduled-tasks/tasks",
})

const workspaceScheduledTaskRunsRoute = createRoute({
  component: WorkspaceScheduledTaskRunsRoutePage,
  getParentRoute: () => workspaceShellRoute,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      workspaceScheduledTaskRunsQueryOptions(params.orgSlug),
    ),
  path: "/scheduled-tasks/task-runs",
})

const workspaceScheduledTaskRedirectRoute = createRoute({
  component: WorkspaceScheduledTaskDetailRedirectRoutePage,
  errorComponent: WorkspaceScheduledTaskDetailRouteErrorPage,
  getParentRoute: () => workspaceShellRoute,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      workspaceScheduledTaskDetailQueryOptions({
        orgSlug: params.orgSlug,
        taskKey: params.taskKey,
      }),
    ),
  path: "/scheduled-tasks/tasks/$taskKey",
})

const workspaceScheduledTaskOverviewRoute = createRoute({
  component: WorkspaceScheduledTaskOverviewRoutePage,
  errorComponent: WorkspaceScheduledTaskDetailRouteErrorPage,
  getParentRoute: () => workspaceShellRoute,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      workspaceScheduledTaskDetailQueryOptions({
        orgSlug: params.orgSlug,
        taskKey: params.taskKey,
      }),
    ),
  path: "/scheduled-tasks/tasks/$taskKey/overview",
})

const workspaceScheduledTaskConfigurationRoute = createRoute({
  component: WorkspaceScheduledTaskConfigurationRoutePage,
  errorComponent: WorkspaceScheduledTaskDetailRouteErrorPage,
  getParentRoute: () => workspaceShellRoute,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      workspaceScheduledTaskDetailQueryOptions({
        orgSlug: params.orgSlug,
        taskKey: params.taskKey,
      }),
    ),
  path: "/scheduled-tasks/tasks/$taskKey/configuration",
})

const workspaceScheduledTaskDetailRunsRoute = createRoute({
  component: WorkspaceScheduledTaskRunsDetailRoutePage,
  errorComponent: WorkspaceScheduledTaskDetailRouteErrorPage,
  getParentRoute: () => workspaceShellRoute,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      workspaceScheduledTaskDetailQueryOptions({
        orgSlug: params.orgSlug,
        taskKey: params.taskKey,
      }),
    ),
  path: "/scheduled-tasks/tasks/$taskKey/task-runs",
})

const workspaceSkillRedirectRoute = createRoute({
  component: WorkspaceSkillDetailRedirectRoutePage,
  getParentRoute: () => workspaceShellRoute,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      workspaceSkillDetailQueryOptions({
        orgSlug: params.orgSlug,
        skillKey: params.skillKey,
      }),
    ),
  path: "/skills/$skillKey",
})

const workspaceSkillOverviewLegacyRoute = createRoute({
  component: WorkspaceSkillDetailRedirectRoutePage,
  getParentRoute: () => workspaceShellRoute,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      workspaceSkillDetailQueryOptions({
        orgSlug: params.orgSlug,
        skillKey: params.skillKey,
      }),
    ),
  path: "/skills/$skillKey/overview",
})

const workspaceSkillStatusRoute = createRoute({
  component: WorkspaceSkillStatusRoutePage,
  getParentRoute: () => workspaceShellRoute,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      workspaceSkillDetailQueryOptions({
        orgSlug: params.orgSlug,
        skillKey: params.skillKey,
      }),
    ),
  path: "/skills/$skillKey/status",
})

const workspaceSkillFilesRoute = createRoute({
  component: WorkspaceSkillFilesRoutePage,
  getParentRoute: () => workspaceShellRoute,
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(
        workspaceSkillDetailQueryOptions({
          orgSlug: params.orgSlug,
          skillKey: params.skillKey,
        }),
      ),
      context.queryClient.ensureQueryData(
        workspaceSkillFilesQueryOptions({
          orgSlug: params.orgSlug,
          skillKey: params.skillKey,
        }),
      ),
    ]),
  path: "/skills/$skillKey/files",
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

const workspaceSettingsFilesRoute = createRoute({
  component: WorkspaceFilesRoutePage,
  getParentRoute: () => workspaceSettingsRoute,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      workspaceFilesQueryOptions(params.orgSlug),
    ),
  path: "/agent/files",
})

const workspaceAgentPersonalizationRoute = createRoute({
  component: WorkspaceAgentPersonalizationRoutePage,
  getParentRoute: () => workspaceSettingsRoute,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      agentPersonalizationOverviewQueryOptions(params.orgSlug),
    ),
  path: "/agent/personalization",
})

const workspaceAgentPersonalizationDetailRoute = createRoute({
  component: WorkspaceAgentPersonalizationDetailRoutePage,
  getParentRoute: () => workspaceSettingsRoute,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      agentPersonalizationDetailQueryOptions({
        instructionTab: params.instructionTab,
        orgSlug: params.orgSlug,
      }),
    ),
  path: "/agent/personalization/$instructionTab",
})

const workspaceAgentPersonalizationSystemRoute = createRoute({
  component: WorkspaceAgentPersonalizationSystemRoutePage,
  getParentRoute: () => workspaceSettingsRoute,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      agentPersonalizationDetailQueryOptions({
        instructionTab: params.instructionTab,
        orgSlug: params.orgSlug,
      }),
    ),
  path: "/agent/personalization/$instructionTab/system",
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
    const { platformOrganizationsQueryOptions } =
      await importPlatformApiModule()

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
    workspaceShellRoute.addChildren([
      workspaceIndexRoute,
      workspaceConversationRoute,
      workspaceLegacyAgentRoute,
      workspaceLegacyAgentStatusRoute,
      workspaceLegacyAgentPromptsRoute,
      workspaceLegacyAgentInstructionRoute,
      workspaceLegacyFilesRoute,
      workspaceSessionsRoute,
      workspaceSessionDetailRoute,
      workspaceScheduledTasksRedirectRoute,
      workspaceScheduledTasksRoute,
      workspaceScheduledTaskRunsRoute,
      workspaceScheduledTaskRedirectRoute,
      workspaceScheduledTaskOverviewRoute,
      workspaceScheduledTaskConfigurationRoute,
      workspaceScheduledTaskDetailRunsRoute,
      workspaceSkillsRoute,
      workspaceSkillRedirectRoute,
      workspaceSkillOverviewLegacyRoute,
      workspaceSkillStatusRoute,
      workspaceSkillFilesRoute,
    ]),
    workspaceSettingsRoute.addChildren([
      workspaceSettingsIndexRoute,
      workspaceSettingsUserRoute,
      workspaceAgentPersonalizationRoute,
      workspaceAgentPersonalizationDetailRoute,
      workspaceAgentPersonalizationSystemRoute,
      workspaceSettingsIntegrationsRoute,
      workspaceSettingsFilesRoute,
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
