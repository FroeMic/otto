import {
  CaretUpDownIcon,
  BuildingsIcon,
  GearIcon,
  ChatsTeardropIcon,
  LightningIcon,
  SignOutIcon,
  UserIcon,
} from "@phosphor-icons/react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, useLocation, useMatchRoute } from "@tanstack/react-router"
import type { ComponentType, PropsWithChildren } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { shellBootstrapQueryOptions } from "@/features/workspace/api/workspace"
import { ConversationHistorySidebarSection } from "@/features/workspace-chat/components/ConversationHistorySidebarSection"
import { WorkspaceChatRealtimeProvider } from "@/features/workspace-chat/realtime/provider"
import { WorkspaceSwitcher } from "@/client/app/app-shell/WorkspaceSwitcher"

export interface WorkspaceShellProps extends PropsWithChildren {
  orgSlug: string
}

interface BreadcrumbSegment {
  href: string | null
  label: string
}

export interface WorkspaceMenuLinkProps {
  icon: ComponentType<{ className?: string }>
  label: string
  params: { orgSlug: string }
  to: "/$orgSlug/skills" | "/$orgSlug/sessions"
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
  orgSlug: string,
  orgName: string,
): BreadcrumbSegment[] {
  const location = useLocation()
  const workspacePath = location.pathname.replace(`/${orgSlug}`, "")
  const segments = workspacePath.split("/").filter(Boolean)
  const base = `/${orgSlug}`

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
    const skillKey = segments[1] ?? null
    const section = segments[2] ?? null
    const breadcrumbs: BreadcrumbSegment[] = [
      { href: `${base}/skills`, label: "Skills" },
    ]

    if (skillKey) {
      breadcrumbs.push({
        href: section ? `${base}/skills/${skillKey}/status` : null,
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

  return [{ href: null, label: orgName }]
}

export function WorkspaceMenuLink({
  icon: Icon,
  label,
  params,
  to,
}: WorkspaceMenuLinkProps) {
  const matchRoute = useMatchRoute()
  const isActive = Boolean(matchRoute({ fuzzy: true, params, to }))

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<Link params={params} preload="intent" to={to} />}
        isActive={isActive}
        tooltip={label}
      >
        <Icon />
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export interface WorkspaceUserMenuProps {
  currentOrganizationSlug: string
  user: {
    email: string
    id: string
    isPlatformAdmin: boolean
    name: string
  }
}

export function WorkspaceUserMenu({
  currentOrganizationSlug,
  user,
}: WorkspaceUserMenuProps) {
  const fallback = user.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((value) => value[0])
    .join("")
    .toUpperCase()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
            }
          >
            <Avatar>
              <AvatarFallback>{fallback || "OT"}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs">{user.email}</span>
            </div>
            <CaretUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-56 rounded-lg" align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar>
                    <AvatarFallback>{fallback || "OT"}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs">{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                render={
                  <Link
                    params={{ orgSlug: currentOrganizationSlug }}
                    to="/$orgSlug/settings/user"
                  />
                }
              >
                <UserIcon />
                User settings
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <Link
                    params={{ orgSlug: currentOrganizationSlug }}
                    to="/$orgSlug/settings/workspace"
                  />
                }
              >
                <GearIcon />
                Workspace settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                window.location.assign("/auth/sign-out")
              }}
            >
              <SignOutIcon />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function WorkspaceShell({ children, orgSlug }: WorkspaceShellProps) {
  const matchRoute = useMatchRoute()
  const { data } = useSuspenseQuery(shellBootstrapQueryOptions(orgSlug))
  const breadcrumbs = useWorkspaceBreadcrumbs(
    data.currentOrganization.slug,
    data.currentOrganization.name,
  )

  return (
    <WorkspaceChatRealtimeProvider orgSlug={orgSlug}>
      <SidebarProvider>
        <Sidebar collapsible="icon" variant="inset">
          <SidebarHeader>
            <WorkspaceSwitcher
              currentOrganization={{
                name: data.currentOrganization.name,
                slug: data.currentOrganization.slug,
              }}
              organizations={data.organizations.map((organization) => ({
                name: organization.name,
                slug: organization.slug,
              }))}
            />
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <WorkspaceMenuLink
                    icon={ChatsTeardropIcon}
                    label="Sessions"
                    params={{ orgSlug }}
                    to="/$orgSlug/sessions"
                  />
                  <WorkspaceMenuLink
                    icon={LightningIcon}
                    label="Skills"
                    params={{ orgSlug }}
                    to="/$orgSlug/skills"
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <ConversationHistorySidebarSection orgSlug={orgSlug} />
          </SidebarContent>

          <SidebarFooter>
            {data.user.isPlatformAdmin ? (
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={
                      <Link
                        preload="intent"
                        search={() => ({
                          workspace: orgSlug,
                        })}
                        to="/platform/organizations"
                      />
                    }
                    isActive={Boolean(matchRoute({ fuzzy: true, to: "/platform" }))}
                    tooltip="Platform"
                  >
                    <BuildingsIcon />
                    <span>Platform</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            ) : null}
            <WorkspaceUserMenu
              currentOrganizationSlug={orgSlug}
              user={data.user}
            />
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <SidebarInset>
          <header className="flex h-14 items-center gap-3 border-b px-4 md:px-6">
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

          <div className="flex flex-1 flex-col px-4 py-6 md:px-6">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </WorkspaceChatRealtimeProvider>
  )
}
