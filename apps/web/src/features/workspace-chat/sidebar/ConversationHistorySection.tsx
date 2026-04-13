"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import {
  workspaceChatConversationListQueryOptions,
} from "../api/chat"
import {
  type ConversationHistoryFilter,
} from "./conversation-history-filters"
import { ConversationHistoryHeader } from "./ConversationHistoryHeader"
import { ConversationHistoryList } from "./ConversationHistoryList"

export interface ConversationHistorySectionProps {
  orgSlug: string
}

export function ConversationHistorySection({
  orgSlug,
}: ConversationHistorySectionProps) {
  const [filter, setFilter] = useState<ConversationHistoryFilter>("all")
  const [collapsed, setCollapsed] = useState(false)
  const conversationsQuery = useInfiniteQuery(
    workspaceChatConversationListQueryOptions(orgSlug),
  )
  const conversations = useMemo(
    () =>
      conversationsQuery.data?.pages.flatMap((page) => page.conversations) ?? [],
    [conversationsQuery.data],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
      <ConversationHistoryHeader
        collapsed={collapsed}
        filter={filter}
        onFilterChange={setFilter}
        onToggleCollapsed={() => {
          setCollapsed((current) => !current)
        }}
      />
      {collapsed ? null : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ConversationHistoryList
            conversations={conversations}
            filter={filter}
            hasNextPage={Boolean(conversationsQuery.hasNextPage)}
            isError={conversationsQuery.isError}
            isFetchingNextPage={conversationsQuery.isFetchingNextPage}
            isLoading={conversationsQuery.isLoading}
            onLoadMore={() => {
              if (
                conversationsQuery.hasNextPage &&
                !conversationsQuery.isFetchingNextPage
              ) {
                void conversationsQuery.fetchNextPage()
              }
            }}
            orgSlug={orgSlug}
          />
        </div>
      )}
    </div>
  )
}
