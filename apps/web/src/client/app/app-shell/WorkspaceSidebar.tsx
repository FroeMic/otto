"use client"

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
      <SidebarHeader className="shrink-0 gap-3">
        <WorkspaceSwitcher
          currentOrganization={currentOrganization}
          organizations={organizations}
        />
        <WorkspacePrimaryNav orgSlug={orgSlug} />
      </SidebarHeader>

      <SidebarContent className="min-h-0 flex-1 overflow-hidden gap-0 px-0">
        <ConversationHistorySection orgSlug={orgSlug} />
      </SidebarContent>

      <SidebarFooter className="shrink-0">
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

