"use client"

import type { WorkspaceChatConversationSummary } from "@otto/feature-workspace-chat"
import { useEffect, useRef } from "react"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { ConversationHistoryListItem } from "./ConversationHistoryListItem"
import { ConversationHistorySkeleton } from "./ConversationHistorySkeleton"
import {
  type ConversationHistoryFilter,
  filterConversationHistory,
} from "./conversation-history-filters"

export interface ConversationHistoryListProps {
  conversations: WorkspaceChatConversationSummary[] | undefined
  filter: ConversationHistoryFilter
  hasNextPage: boolean
  isError: boolean
  isFetchingNextPage: boolean
  isLoading: boolean
  onLoadMore: () => void
  orgSlug: string
}

export function ConversationHistoryList({
  conversations,
  filter,
  hasNextPage,
  isError,
  isFetchingNextPage,
  isLoading,
  onLoadMore,
  orgSlug,
}: ConversationHistoryListProps) {
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!hasNextPage) {
      return
    }

    const node = loadMoreRef.current

    if (!node) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            onLoadMore()
          }
        }
      },
      {
        rootMargin: "120px 0px",
      },
    )

    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [hasNextPage, onLoadMore])

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
    <SidebarMenu className="gap-0.5 px-2 py-2">
      {filteredConversations.map((conversation) => (
        <ConversationHistoryListItem
          key={conversation.id}
          conversation={conversation}
          orgSlug={orgSlug}
        />
      ))}
      {isFetchingNextPage ? <ConversationHistorySkeleton compact /> : null}
      {hasNextPage ? <div ref={loadMoreRef} className="h-2 w-full" /> : null}
    </SidebarMenu>
  )
}
