"use client"

import {
  SidebarMenu,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar"

export function ConversationHistorySkeleton() {
  return (
    <SidebarMenu className="gap-1 px-2 py-2">
      <SidebarMenuSkeleton />
      <SidebarMenuSkeleton />
      <SidebarMenuSkeleton />
      <SidebarMenuSkeleton />
    </SidebarMenu>
  )
}

