import {
  ArrowLeft,
  CaretUpDown,
  ChartBar,
  CreditCard,
  FolderOpen,
  Gear,
  PlugsConnected,
  Sliders,
  User,
} from "@phosphor-icons/react/ssr"
import { Link, useLocation } from "@tanstack/react-router"
import type { ComponentProps, ReactNode } from "react"

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
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export interface SettingsSidebarOrganization {
  name: string
  slug: string
}

export interface SettingsSidebarUser {
  email: string
  id: string
  name: string
}

export interface SettingsSidebarProps extends ComponentProps<typeof Sidebar> {
  currentOrganization: SettingsSidebarOrganization
  user: SettingsSidebarUser
}

interface SettingsNavItem {
  href: (orgSlug: string) => string
  icon: ReactNode
  match: "exact" | "section"
  title: string
}

interface UserMenuProps {
  currentOrganizationSlug: string
  user: SettingsSidebarUser
}

const settingsNavItems: {
  agent: SettingsNavItem[]
  user: SettingsNavItem[]
  workspace: SettingsNavItem[]
} = {
  agent: [
    {
      href: (orgSlug) => `/${orgSlug}/settings/agent/personalization`,
      icon: <Sliders />,
      match: "section",
      title: "Personalization",
    },
    {
      href: (orgSlug) => `/${orgSlug}/settings/agent/integrations`,
      icon: <PlugsConnected />,
      match: "section",
      title: "Integrations",
    },
    {
      href: (orgSlug) => `/${orgSlug}/settings/agent/files`,
      icon: <FolderOpen />,
      match: "section",
      title: "Files",
    },
  ],
  user: [
    {
      href: (orgSlug) => `/${orgSlug}/settings/user`,
      icon: <User />,
      match: "section",
      title: "Account",
    },
  ],
  workspace: [
    {
      href: (orgSlug) => `/${orgSlug}/settings/workspace`,
      icon: <Gear />,
      match: "exact",
      title: "General",
    },
    {
      href: (orgSlug) => `/${orgSlug}/settings/workspace/members`,
      icon: <User />,
      match: "section",
      title: "Members",
    },
    {
      href: (orgSlug) => `/${orgSlug}/settings/workspace/usage`,
      icon: <ChartBar />,
      match: "section",
      title: "Usage",
    },
    {
      href: (orgSlug) => `/${orgSlug}/settings/workspace/billing`,
      icon: <CreditCard />,
      match: "section",
      title: "Billing",
    },
  ],
}

function isSettingsItemActive(
  href: string,
  match: "exact" | "section",
  pathname: string,
) {
  return match === "exact"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`)
}

function UserMenu({ currentOrganizationSlug, user }: UserMenuProps) {
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
              <SidebarMenuButton
                size="lg"
                className="px-2.5 aria-expanded:bg-muted"
              />
            }
          >
            <Avatar>
              <AvatarFallback>{fallback || "OT"}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs">{user.email}</span>
            </div>
            <CaretUpDown className="ml-auto size-4" />
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
                <User />
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
                <Gear />
                Workspace settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                window.location.assign("/auth/sign-out")
              }}
            >
              <ArrowLeft />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function SettingsSidebar({
  currentOrganization,
  user,
  ...props
}: SettingsSidebarProps) {
  const location = useLocation()

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={
                <Link
                  params={{ orgSlug: currentOrganization.slug }}
                  to="/$orgSlug"
                />
              }
              className="h-9 rounded-full px-4 text-sidebar-foreground/70 hover:text-sidebar-foreground"
            >
              <ArrowLeft />
              <span>Back to app</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>User</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNavItems.user.map((item) => {
                const href = item.href(currentOrganization.slug)

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      render={
                        <Link to={href} />
                      }
                      className="px-2.5"
                      isActive={isSettingsItemActive(
                        href,
                        item.match,
                        location.pathname,
                      )}
                    >
                      {item.icon}
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Agent</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNavItems.agent.map((item) => {
                const href = item.href(currentOrganization.slug)

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      render={
                        <Link to={href} />
                      }
                      className="px-2.5"
                      isActive={isSettingsItemActive(
                        href,
                        item.match,
                        location.pathname,
                      )}
                    >
                      {item.icon}
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNavItems.workspace.map((item) => {
                const href = item.href(currentOrganization.slug)
                const to =
                  item.title === "General"
                    ? "/$orgSlug/settings/workspace"
                    : item.title === "Members"
                      ? "/$orgSlug/settings/workspace/members"
                      : item.title === "Usage"
                        ? "/$orgSlug/settings/workspace/usage"
                        : "/$orgSlug/settings/workspace/billing"

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      render={
                        <Link
                          params={{ orgSlug: currentOrganization.slug }}
                          to={to}
                        />
                      }
                      className="px-2.5"
                      isActive={isSettingsItemActive(
                        href,
                        item.match,
                        location.pathname,
                      )}
                    >
                      {item.icon}
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <UserMenu currentOrganizationSlug={currentOrganization.slug} user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
