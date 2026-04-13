"use client"

import type { WorkspaceChatConversationSummary } from "@otto/feature-workspace-chat"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

import {
  filterConversationHistory,
  type ConversationHistoryFilter,
} from "./conversation-history-filters"
import { ConversationHistoryListItem } from "./ConversationHistoryListItem"
import { ConversationHistorySkeleton } from "./ConversationHistorySkeleton"

export interface ConversationHistoryListProps {
  conversations: WorkspaceChatConversationSummary[] | undefined
  filter: ConversationHistoryFilter
  isError: boolean
  isLoading: boolean
  orgSlug: string
}

export function ConversationHistoryList({
  conversations,
  filter,
  isError,
  isLoading,
  orgSlug,
}: ConversationHistoryListProps) {
  if (isLoading) {
    return <ConversationHistorySkeleton />
  }

  if (isError) {
    return (
      <SidebarMenu className="px-2 py-2">
        <SidebarMenuItem>
          <SidebarMenuButton disabled>
            <span>Failed to load conversations</span>
            <span aria-hidden className="w-5 shrink-0" />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  const filteredConversations = filterConversationHistory(
    conversations ?? [],
    filter,
  )

  if (filteredConversations.length === 0) {
    return (
      <SidebarMenu className="px-2 py-2">
        <SidebarMenuItem>
          <SidebarMenuButton disabled>
            <span>No conversations</span>
            <span aria-hidden className="w-5 shrink-0" />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu className="gap-1 px-2 py-2">
      {filteredConversations.map((conversation) => (
        <ConversationHistoryListItem
          key={conversation.id}
          conversation={conversation}
          orgSlug={orgSlug}
        />
      ))}
    </SidebarMenu>
  )
}

