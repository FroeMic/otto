"use client"

import {
  SidebarMenu,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar"

export interface ConversationHistorySkeletonProps {
  compact?: boolean
}

export function ConversationHistorySkeleton({
  compact = false,
}: ConversationHistorySkeletonProps) {
  return (
    <SidebarMenu className={compact ? "gap-0.5 px-2 py-0.5" : "gap-0.5 px-2 py-2"}>
      <SidebarMenuSkeleton />
      <SidebarMenuSkeleton />
      <SidebarMenuSkeleton />
      {compact ? null : <SidebarMenuSkeleton />}
    </SidebarMenu>
  )
}
