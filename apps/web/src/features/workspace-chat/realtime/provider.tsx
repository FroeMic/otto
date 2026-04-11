"use client"

import type {
  WorkspaceChatConversationDetailResponse,
  WorkspaceChatConversationSummary,
  WorkspaceChatRealtimeServerEvent,
} from "@otto/feature-workspace-chat"
import { useQueryClient } from "@tanstack/react-query"
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
} from "react"

import {
  applyWorkspaceChatRealtimeEventToConversationDetail,
  applyWorkspaceChatRealtimeEventToConversationList,
} from "./cache"
import { WorkspaceChatRealtimeClient } from "./client"

export interface WorkspaceChatRealtimeProviderProps extends PropsWithChildren {
  orgSlug: string
}

export interface WorkspaceChatRealtimeContextValue {
  subscribeConversation: (conversationId: string) => void
  unsubscribeConversation: (conversationId: string) => void
}

const WorkspaceChatRealtimeContext =
  createContext<WorkspaceChatRealtimeContextValue | null>(null)

export function WorkspaceChatRealtimeProvider({
  children,
  orgSlug,
}: WorkspaceChatRealtimeProviderProps) {
  const queryClient = useQueryClient()

  const client = useMemo(
    () =>
      new WorkspaceChatRealtimeClient({
        onEvent(event) {
          applyWorkspaceChatRealtimeEvent(queryClient, orgSlug, event)
        },
        orgSlug,
      }),
    [orgSlug, queryClient],
  )

  useEffect(() => {
    client.connect()

    return () => {
      client.disconnect()
    }
  }, [client])

  const value = useMemo<WorkspaceChatRealtimeContextValue>(
    () => ({
      subscribeConversation(conversationId) {
        client.subscribeConversation(conversationId)
      },
      unsubscribeConversation(conversationId) {
        client.unsubscribeConversation(conversationId)
      },
    }),
    [client],
  )

  return (
    <WorkspaceChatRealtimeContext.Provider value={value}>
      {children}
    </WorkspaceChatRealtimeContext.Provider>
  )
}

export function useWorkspaceChatRealtimeContext() {
  const context = useContext(WorkspaceChatRealtimeContext)

  if (!context) {
    throw new Error(
      "useWorkspaceChatRealtimeContext must be used within WorkspaceChatRealtimeProvider.",
    )
  }

  return context
}

function applyWorkspaceChatRealtimeEvent(
  queryClient: ReturnType<typeof useQueryClient>,
  orgSlug: string,
  event: WorkspaceChatRealtimeServerEvent,
) {
  if (event.type === "subscription_denied") {
    console.warn(
      `[workspace-chat] subscription denied for conversation ${event.conversationId}`,
    )
    return
  }

  if (event.type === "conversation.summary_updated") {
    queryClient.setQueryData(
      ["workspace-chat-conversation", orgSlug, event.conversation.id],
      (current: WorkspaceChatConversationDetailResponse | undefined) =>
        current
          ? applyWorkspaceChatRealtimeEventToConversationDetail(current, event)
          : current,
    )
    queryClient.setQueryData(
      ["workspace-chat-conversations", orgSlug],
      (current: WorkspaceChatConversationSummary[] | undefined) =>
        Array.isArray(current)
          ? applyWorkspaceChatRealtimeEventToConversationList(current, event)
          : current,
    )
    return
  }

  if (
    event.type === "subscribed" ||
    event.type === "unsubscribed" ||
    event.type === "pong"
  ) {
    return
  }

  queryClient.setQueryData(
    ["workspace-chat-conversation", orgSlug, event.conversationId],
    (current: WorkspaceChatConversationDetailResponse | undefined) =>
      current
        ? applyWorkspaceChatRealtimeEventToConversationDetail(current, event)
        : current,
  )

  queryClient.setQueryData(
    ["workspace-chat-conversations", orgSlug],
    (current: WorkspaceChatConversationSummary[] | undefined) =>
      Array.isArray(current)
        ? applyWorkspaceChatRealtimeEventToConversationList(current, event)
        : current,
  )
}
