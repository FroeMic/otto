import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Link, useLocation } from "@tanstack/react-router"
import { type PropsWithChildren, useEffect } from "react"
import {
  capturePostHogBrowserEvent,
  identifyPostHogBrowserUser,
} from "@/client/posthog"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { shellBootstrapQueryOptions } from "@/features/workspace/api/workspace"
import { workspaceChatConversationDetailQueryOptions } from "@/features/workspace-chat/api/chat"
import { WorkspaceChatRealtimeProvider } from "@/features/workspace-chat/realtime/provider"

import { ShellStage } from "./ShellStage"
import { ShellViewport } from "./ShellViewport"
import { WorkspaceSidebar } from "./WorkspaceSidebar"

export interface WorkspaceShellProps extends PropsWithChildren {
  orgSlug: string
}

interface BreadcrumbSegment {
  href: string | null
  label: string
}

function decodePathSegment(segment: string) {
  let value = segment

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const decoded = decodeURIComponent(value)

      if (decoded === value) {
        break
      }

      value = decoded
    } catch {
      break
    }
  }

  return value
}

function formatSectionLabel(section: string) {
  return section.charAt(0).toUpperCase() + section.slice(1)
}

function useWorkspaceBreadcrumbs(
  conversationLabel: string | undefined,
  orgSlug: string,
  orgName: string,
): BreadcrumbSegment[] {
  const location = useLocation()
  const workspacePath = location.pathname.replace(`/${orgSlug}`, "")
  const segments = workspacePath.split("/").filter(Boolean)
  const base = `/${orgSlug}`

  if (segments.length === 0) {
    return [{ href: null, label: "Agent" }]
  }

  if (segments[0] === "c") {
    const conversationId = segments[1] ?? null

    return [
      { href: `${base}`, label: "Agent" },
      {
        href: null,
        label:
          conversationLabel ??
          (conversationId ? decodePathSegment(conversationId) : "Conversation"),
      },
    ]
  }

  if (segments[0] === "sessions") {
    const sessionKey = segments[1] ?? null
    const breadcrumbs: BreadcrumbSegment[] = [
      { href: `${base}/sessions`, label: "Sessions" },
    ]

    if (sessionKey) {
      breadcrumbs.push({
        href: null,
        label: decodePathSegment(sessionKey),
      })
    }

    return breadcrumbs
  }

  if (segments[0] === "skills") {
    const secondSegment = segments[1] ?? null
    const isLibraryRoute = secondSegment === "library"
    const skillKey = isLibraryRoute ? (segments[2] ?? null) : secondSegment
    const section = isLibraryRoute
      ? (segments[3] ?? null)
      : (segments[2] ?? null)
    const breadcrumbs: BreadcrumbSegment[] = [
      { href: `${base}/skills`, label: "Skills" },
    ]

    if (isLibraryRoute) {
      breadcrumbs.push({
        href: `${base}/skills/library`,
        label: "Library",
      })
    }

    if (skillKey) {
      breadcrumbs.push({
        href: section
          ? isLibraryRoute
            ? `${base}/skills/library/${skillKey}`
            : `${base}/skills/${skillKey}/overview`
          : null,
        label: decodePathSegment(skillKey),
      })
    }

    if (section) {
      breadcrumbs.push({
        href: null,
        label: formatSectionLabel(section),
      })
    }

    return breadcrumbs
  }

  if (segments[0] === "scheduled-tasks") {
    const secondSegment = segments[1] ?? null
    const taskKey = secondSegment === "tasks" ? (segments[2] ?? null) : null
    const section = taskKey ? (segments[3] ?? null) : null
    const breadcrumbs: BreadcrumbSegment[] = [
      {
        href: `${base}/scheduled-tasks/tasks`,
        label: "Scheduled Tasks",
      },
    ]

    if (secondSegment === "task-runs") {
      breadcrumbs.push({
        href: null,
        label: "Task Runs",
      })

      return breadcrumbs
    }

    if (secondSegment === "tasks") {
      breadcrumbs.push({
        href: taskKey ? `${base}/scheduled-tasks/tasks` : null,
        label: "Tasks",
      })
    }

    if (taskKey) {
      breadcrumbs.push({
        href: section
          ? `${base}/scheduled-tasks/tasks/${taskKey}/overview`
          : null,
        label: decodePathSegment(taskKey),
      })
    }

    if (section) {
      breadcrumbs.push({
        href: null,
        label: formatSectionLabel(section),
      })
    }

    return breadcrumbs
  }

  return [{ href: null, label: orgName }]
}

export function WorkspaceShell({ children, orgSlug }: WorkspaceShellProps) {
  const { data } = useSuspenseQuery(shellBootstrapQueryOptions(orgSlug))
  const location = useLocation()
  const pathSegments = location.pathname
    .replace(`/${orgSlug}`, "")
    .split("/")
    .filter(Boolean)
  const conversationId =
    pathSegments[0] === "c" ? (pathSegments[1] ?? null) : null
  const { data: conversationDetail } = useQuery({
    ...workspaceChatConversationDetailQueryOptions(
      orgSlug,
      conversationId ?? "",
    ),
    enabled: Boolean(conversationId),
    select: (conversation) => conversation.conversation.title,
  })
  const breadcrumbs = useWorkspaceBreadcrumbs(
    conversationDetail,
    data.currentOrganization.slug,
    data.currentOrganization.name,
  )

  useEffect(() => {
    identifyPostHogBrowserUser({
      email: data.user.email,
      id: data.user.id,
      name: data.user.name,
      workspaceId: data.currentOrganization.id,
      workspaceName: data.currentOrganization.name,
      workspaceSlug: data.currentOrganization.slug,
    })
  }, [
    data.currentOrganization.id,
    data.currentOrganization.name,
    data.currentOrganization.slug,
    data.user.email,
    data.user.id,
    data.user.name,
  ])

  useEffect(() => {
    capturePostHogBrowserEvent("workspace_opened", {
      path: location.pathname,
      workspaceId: data.currentOrganization.id,
      workspaceName: data.currentOrganization.name,
      workspaceSlug: data.currentOrganization.slug,
    })
  }, [
    data.currentOrganization.id,
    data.currentOrganization.name,
    data.currentOrganization.slug,
    location.pathname,
  ])

  return (
    <WorkspaceChatRealtimeProvider orgSlug={orgSlug}>
      <ShellViewport>
        <ShellStage>
          <SidebarProvider className="h-full min-h-0">
            <WorkspaceSidebar
              currentOrganization={{
                agentPersonalizedAt:
                  data.currentOrganization.agentPersonalizedAt ?? null,
                name: data.currentOrganization.name,
                slug: data.currentOrganization.slug,
              }}
              organizations={data.organizations.map((organization) => ({
                name: organization.name,
                slug: organization.slug,
              }))}
              orgSlug={orgSlug}
              user={data.user}
            />

            <SidebarInset className="min-h-0 overflow-hidden">
              <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4 md:px-6">
                <SidebarTrigger />
                <Separator
                  orientation="vertical"
                  className="data-vertical:h-4 data-vertical:self-auto"
                />
                <div className="min-w-0 text-sm">
                  <Link
                    className="font-medium hover:underline"
                    params={{ orgSlug: data.currentOrganization.slug }}
                    to="/$orgSlug"
                  >
                    {data.currentOrganization.name}
                  </Link>
                  {breadcrumbs.map((segment) => (
                    <span key={segment.label}>
                      <span className="mx-2 text-muted-foreground">/</span>
                      {segment.href ? (
                        <Link
                          className="truncate text-muted-foreground hover:text-foreground hover:underline"
                          preload="intent"
                          to={segment.href}
                        >
                          {segment.label}
                        </Link>
                      ) : (
                        <span className="truncate text-muted-foreground">
                          {segment.label}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </header>

              <div className="flex min-h-0 flex-1 flex-col overflow-auto px-4 py-6 md:px-6">
                {children}
              </div>
            </SidebarInset>
          </SidebarProvider>
        </ShellStage>
      </ShellViewport>
    </WorkspaceChatRealtimeProvider>
  )
}
