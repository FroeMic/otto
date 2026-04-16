import { ArrowLeftIcon, BuildingsIcon, HardDrivesIcon } from "@phosphor-icons/react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, useLocation, useMatchRoute } from "@tanstack/react-router"
import type { ComponentProps } from "react"

import { platformBootstrapQueryOptions } from "@/features/platform/api/platform"
import {
  usePlatformSourceWorkspaceSlug,
} from "@/features/platform/source-workspace"
import { PlatformUserMenu } from "@/client/app/app-shell/PlatformUserMenu"
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

export interface PlatformSidebarProps
  extends ComponentProps<typeof Sidebar> {}

export function PlatformSidebar(props: PlatformSidebarProps) {
  const { data } = useSuspenseQuery(platformBootstrapQueryOptions())
  const location = useLocation()
  const matchRoute = useMatchRoute()
  const sourceWorkspaceSlug = usePlatformSourceWorkspaceSlug(
    data.organizations.map((organization) => ({
      slug: organization.slug,
    })),
  )
  const organizationsIsActive = Boolean(
    matchRoute({ fuzzy: true, to: "/platform/organizations" }),
  )
  const snapshotsIsActive = Boolean(
    matchRoute({ fuzzy: true, to: "/platform/snapshots" }),
  )
  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader className="gap-3">
        {sourceWorkspaceSlug ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={
                  <Link params={{ orgSlug: sourceWorkspaceSlug }} to="/$orgSlug" />
                }
                size="default"
                className="h-10 rounded-full px-4"
              >
                <ArrowLeftIcon />
                <span>Back to Otto</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : null}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Administration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={organizationsIsActive}
                  render={
                    <Link
                      search={() => {
                        const searchParams = new URLSearchParams(location.search)
                        const workspace = searchParams.get("workspace")

                        return workspace ? { workspace } : {}
                      }}
                      to="/platform/organizations"
                    />
                  }
                  tooltip="Organizations"
                  className="px-2.5"
                >
                  <BuildingsIcon />
                  <span>Organizations</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={snapshotsIsActive}
                  render={<Link to="/platform/snapshots" />}
                  tooltip="Snapshots"
                  className="px-2.5"
                >
                  <HardDrivesIcon />
                  <span>Snapshots</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <PlatformUserMenu />
      </SidebarFooter>
    </Sidebar>
  )
}
