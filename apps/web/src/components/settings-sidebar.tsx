"use client"

import {
  ArrowLeftIcon,
  BuildingsIcon,
  CaretUpDownIcon,
  ChartPieSliceIcon,
  GearIcon,
} from "@phosphor-icons/react"
import { Link, useMatchRoute } from "@tanstack/react-router"

import type { ShellBootstrap } from "@/client/api"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
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
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

export function SettingsSidebar({
  data,
  orgSlug,
}: {
  data: ShellBootstrap
  orgSlug: string
}) {
  const matchRoute = useMatchRoute()
  const secondaryItems = [
    ...(data.user.isPlatformAdmin
      ? [
          {
            icon: ChartPieSliceIcon,
            label: "Platform",
            to: "/platform" as const,
          },
        ]
      : []),
  ]

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                    size="lg"
                  />
                }
              >
                <div className="flex size-8 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
                  <BuildingsIcon weight="fill" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-semibold">
                    {data.currentOrganization.name}
                  </span>
                  <span className="truncate text-xs text-sidebar-foreground/70">
                    {data.currentOrganization.slug}
                  </span>
                </div>
                <CaretUpDownIcon className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-64">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
                  {data.organizations.map((organization) => (
                    <DropdownMenuItem
                      key={organization.id}
                      render={
                        <Link
                          params={{ orgSlug: organization.slug }}
                          preload="intent"
                          to="/$orgSlug"
                        />
                      }
                    >
                      <BuildingsIcon />
                      {organization.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  render={
                    <Link
                      params={{ orgSlug }}
                      preload="intent"
                      to="/$orgSlug/settings/workspace"
                    />
                  }
                >
                  <GearIcon />
                  Workspace settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={
                <Link params={{ orgSlug }} preload="intent" to="/$orgSlug" />
              }
              size="lg"
              tooltip="Back to workspace"
            >
              <ArrowLeftIcon />
              <span>Back to workspace</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link
                      params={{ orgSlug }}
                      preload="intent"
                      to="/$orgSlug/settings/workspace"
                    />
                  }
                  isActive={Boolean(
                    matchRoute({
                      fuzzy: true,
                      params: { orgSlug },
                      to: "/$orgSlug/settings/workspace",
                    }),
                  )}
                  tooltip="General"
                >
                  <GearIcon />
                  <span>General</span>
                </SidebarMenuButton>
                <SidebarMenuBadge>Live</SidebarMenuBadge>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Workspaces</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {data.organizations.map((organization) => (
                <SidebarMenuItem key={organization.id}>
                  <SidebarMenuButton
                    render={
                      <Link
                        params={{ orgSlug: organization.slug }}
                        preload="intent"
                        to="/$orgSlug/settings/workspace"
                      />
                    }
                    isActive={organization.slug === orgSlug}
                    tooltip={organization.name}
                  >
                    <BuildingsIcon />
                    <span>{organization.name}</span>
                  </SidebarMenuButton>
                  {organization.slug === orgSlug ? (
                    <SidebarMenuBadge>Now</SidebarMenuBadge>
                  ) : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {secondaryItems.length ? <NavSecondary items={secondaryItems} /> : null}
      </SidebarContent>

      <SidebarFooter>
        <NavUser email={data.user.email} name={data.user.name} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
