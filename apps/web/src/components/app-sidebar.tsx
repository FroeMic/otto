"use client"

import type { ShellBootstrap } from "@otto/feature-workspace-core"
import {
  BuildingsIcon,
  ChartPieSliceIcon,
  GearIcon,
  HouseLineIcon,
  SparkleIcon,
} from "@phosphor-icons/react"
import { Link, useMatchRoute } from "@tanstack/react-router"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { Badge } from "@/components/ui/badge"
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

export function AppSidebar({
  data,
  orgSlug,
}: {
  data: ShellBootstrap
  orgSlug: string
}) {
  const matchRoute = useMatchRoute()
  const mainItems = [
    {
      icon: HouseLineIcon,
      label: "Overview",
      to: "/$orgSlug" as const,
    },
    {
      icon: GearIcon,
      items: [
        {
          label: "Workspace",
          to: "/$orgSlug/settings/workspace" as const,
        },
      ],
      label: "Settings",
      to: "/$orgSlug/settings/workspace" as const,
    },
  ]

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
            <SidebarMenuButton
              render={
                <Link params={{ orgSlug }} preload="intent" to="/$orgSlug" />
              }
              size="lg"
            >
              <div className="flex size-8 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
                <SparkleIcon weight="fill" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-semibold">Otto</span>
                <span className="truncate text-xs text-sidebar-foreground/70">
                  {data.currentOrganization.name}
                </span>
              </div>
              <Badge
                className="ml-auto rounded-lg group-data-[collapsible=icon]:hidden"
                variant={
                  data.currentOrganization.isReady ? "secondary" : "outline"
                }
              >
                {data.currentOrganization.isReady ? "Ready" : "Setup"}
              </Badge>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={mainItems} orgSlug={orgSlug} />

        <SidebarGroup>
          <SidebarGroupLabel>Workspaces</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {data.organizations.map((organization) => {
                const isActive = Boolean(
                  matchRoute({
                    fuzzy: true,
                    params: { orgSlug: organization.slug },
                    to: "/$orgSlug",
                  }),
                )

                return (
                  <SidebarMenuItem key={organization.id}>
                    <SidebarMenuButton
                      render={
                        <Link
                          params={{ orgSlug: organization.slug }}
                          preload="intent"
                          to="/$orgSlug"
                        />
                      }
                      isActive={isActive}
                      tooltip={organization.name}
                    >
                      <BuildingsIcon />
                      <span>{organization.name}</span>
                    </SidebarMenuButton>
                    {organization.slug === orgSlug ? (
                      <SidebarMenuBadge>Now</SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                )
              })}
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
