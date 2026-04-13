"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { startTransition, useMemo, useState } from "react"
import { toast } from "sonner"

import {
  createWorkspaceChatConversation,
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
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<ConversationHistoryFilter>("all")
  const conversationsQuery = useQuery(
    workspaceChatConversationListQueryOptions(orgSlug),
  )
  const conversations = useMemo(
    () => conversationsQuery.data ?? [],
    [conversationsQuery.data],
  )
  const createConversationMutation = useMutation({
    mutationFn: async () =>
      createWorkspaceChatConversation({
        orgSlug,
      }),
    onSuccess: async (conversation) => {
      await queryClient.invalidateQueries({
        queryKey: ["workspace-chat-conversations", orgSlug],
      })

      startTransition(() => {
        void navigate({
          params: {
            conversationId: conversation.id,
            orgSlug,
          },
          to: "/$orgSlug/c/$conversationId",
        })
      })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create a workspace conversation.",
      )
    },
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
      <ConversationHistoryHeader
        createDisabled={createConversationMutation.isPending}
        filter={filter}
        onCreate={() => {
          createConversationMutation.mutate()
        }}
        onFilterChange={setFilter}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ConversationHistoryList
          conversations={conversations}
          filter={filter}
          isError={conversationsQuery.isError}
          isLoading={conversationsQuery.isLoading}
          orgSlug={orgSlug}
        />
      </div>
    </div>
  )
}
