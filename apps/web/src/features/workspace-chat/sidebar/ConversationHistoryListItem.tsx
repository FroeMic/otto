"use client"

import type { WorkspaceChatConversationSummary } from "@otto/feature-workspace-chat"
import { Link, useMatchRoute } from "@tanstack/react-router"

import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

import {
  describeConversationHistoryType,
  formatConversationHistoryTitle,
  getConversationHistoryIndicatorClassName,
} from "./conversation-history-filters"

export interface ConversationHistoryListItemProps {
  conversation: WorkspaceChatConversationSummary
  orgSlug: string
}

export function ConversationHistoryListItem({
  conversation,
  orgSlug,
}: ConversationHistoryListItemProps) {
  const matchRoute = useMatchRoute()
  const isActive = Boolean(
    matchRoute({
      params: {
        conversationId: conversation.id,
        orgSlug,
      },
      to: "/$orgSlug/c/$conversationId",
    }),
  )

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        render={
          <Link
            params={{
              conversationId: conversation.id,
              orgSlug,
            }}
            preload="intent"
            to="/$orgSlug/c/$conversationId"
          />
        }
        tooltip={conversation.title}
        className="h-8 gap-2 pr-2.5"
      >
        <span
          aria-label={describeConversationHistoryType(conversation)}
          className={`size-1.5 shrink-0 rounded-full ${getConversationHistoryIndicatorClassName(
            conversation,
          )}`}
          title={describeConversationHistoryType(conversation)}
        />
        <span className="min-w-0 flex-1 truncate">
          {formatConversationHistoryTitle(conversation.title)}
        </span>
        <span aria-hidden className="w-5 shrink-0" />
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
