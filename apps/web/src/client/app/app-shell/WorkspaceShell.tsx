import {
  BuildingsIcon,
  GearIcon,
  HouseLineIcon,
  SignOutIcon,
  SparkleIcon,
} from "@phosphor-icons/react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, useMatchRoute } from "@tanstack/react-router"
import type { ComponentType, PropsWithChildren } from "react"

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
import { WorkspaceSwitcher } from "@/client/app/app-shell/WorkspaceSwitcher"

export interface WorkspaceShellProps extends PropsWithChildren {
  orgSlug: string
}

export interface WorkspaceMenuLinkProps {
  icon: ComponentType<{ className?: string }>
  label: string
  params?: { orgSlug: string }
  to: "/$orgSlug" | "/$orgSlug/settings/workspace" | "/platform"
}

export function WorkspaceMenuLink({
  icon: Icon,
  label,
  params,
  to,
}: WorkspaceMenuLinkProps) {
  const matchRoute = useMatchRoute()
  const isActive = Boolean(
    params ? matchRoute({ fuzzy: true, params, to }) : matchRoute({ fuzzy: true, to }),
  )

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={
          params ? (
            <Link params={params} preload="intent" to={to} />
          ) : (
            <Link preload="intent" to={to} />
          )
        }
        isActive={isActive}
        tooltip={label}
      >
        <Icon />
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export function WorkspaceShell({ children, orgSlug }: WorkspaceShellProps) {
  const { data } = useSuspenseQuery(shellBootstrapQueryOptions(orgSlug))

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="gap-4 border-b border-sidebar-border/70">
          <div className="flex items-center gap-3 px-2">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-sidebar-primary text-sidebar-primary-foreground">
              <SparkleIcon weight="fill" />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="text-sm font-medium">Otto</p>
              <p className="truncate text-xs text-sidebar-foreground/70">
                Workspace app
              </p>
            </div>
          </div>
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
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <WorkspaceMenuLink
                  icon={HouseLineIcon}
                  label="Overview"
                  params={{ orgSlug }}
                  to="/$orgSlug"
                />
                <WorkspaceMenuLink
                  icon={GearIcon}
                  label="Settings"
                  params={{ orgSlug }}
                  to="/$orgSlug/settings/workspace"
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Workspaces</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {data.organizations.map((organization) => (
                  <WorkspaceMenuLink
                    key={organization.id}
                    icon={BuildingsIcon}
                    label={organization.name}
                    params={{ orgSlug: organization.slug }}
                    to="/$orgSlug"
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {data.user.isPlatformAdmin ? (
            <SidebarGroup>
              <SidebarGroupLabel>Operator</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <WorkspaceMenuLink
                    icon={BuildingsIcon}
                    label="Platform"
                    to="/platform"
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : null}
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border/70">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => {
                  window.location.assign("/auth/sign-out")
                }}
                tooltip="Sign out"
              >
                <SignOutIcon />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="bg-background">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border/70 bg-background/90 px-4 py-3 backdrop-blur md:px-6">
          <SidebarTrigger />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {data.currentOrganization.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              /{data.currentOrganization.slug}
            </p>
          </div>
        </header>

        <div className="flex flex-1 flex-col px-4 py-6 md:px-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
