"use client"

import { PlusIcon } from "@phosphor-icons/react"
import { Link } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { ConversationHistorySection } from "@/features/workspace-chat/sidebar/ConversationHistorySection"

import { WorkspacePrimaryNav } from "./WorkspacePrimaryNav"
import {
  WorkspaceFooterPlatformLink,
  WorkspaceUserMenu,
} from "./WorkspaceUserMenu"
import { WorkspaceSwitcher } from "./WorkspaceSwitcher"

export interface WorkspaceSidebarProps {
  currentOrganization: {
    name: string
    slug: string
  }
  organizations: Array<{
    name: string
    slug: string
  }>
  orgSlug: string
  user: {
    email: string
    id: string
    isPlatformAdmin: boolean
    name: string
  }
}

export function WorkspaceSidebar({
  currentOrganization,
  organizations,
  orgSlug,
  user,
}: WorkspaceSidebarProps) {
  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="shrink-0 gap-2 pb-2">
        <div className="flex items-center gap-2 px-3 pt-2">
          <WorkspaceSwitcher
            className="min-w-0 flex-1"
            currentOrganization={currentOrganization}
            organizations={organizations}
          />
          <Button
            variant="outline"
            size="icon-sm"
            className="size-10 shrink-0 rounded-full border-sidebar-border bg-sidebar hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            render={<Link params={{ orgSlug }} preload="intent" to="/$orgSlug" />}
            aria-label="Open agent"
            title="Open agent"
          >
            <PlusIcon />
          </Button>
        </div>
        <WorkspacePrimaryNav orgSlug={orgSlug} />
      </SidebarHeader>

      <SidebarContent className="min-h-0 flex-1 overflow-hidden gap-0 px-0">
        <ConversationHistorySection orgSlug={orgSlug} />
      </SidebarContent>

      <SidebarFooter className="shrink-0 border-t border-sidebar-border/70 pt-3">
        {user.isPlatformAdmin ? (
          <WorkspaceFooterPlatformLink orgSlug={orgSlug} />
        ) : null}
        <WorkspaceUserMenu
          currentOrganizationSlug={orgSlug}
          user={user}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
