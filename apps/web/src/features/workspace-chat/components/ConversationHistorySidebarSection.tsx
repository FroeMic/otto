"use client"

import {
  ChatCircleDotsIcon,
  ClockCounterClockwiseIcon,
  PlusIcon,
} from "@phosphor-icons/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useMatchRoute, useNavigate } from "@tanstack/react-router"
import { startTransition } from "react"
import { toast } from "sonner"

import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar"

import {
  createWorkspaceChatConversation,
  workspaceChatConversationListQueryOptions,
} from "../api/chat"

export interface ConversationHistorySidebarSectionProps {
  orgSlug: string
}

function formatConversationLabel(input: { title: string }) {
  return input.title.trim() || "Untitled conversation"
}

export function ConversationHistorySidebarSection({
  orgSlug,
}: ConversationHistorySidebarSectionProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const matchRoute = useMatchRoute()
  const conversationsQuery = useQuery(workspaceChatConversationListQueryOptions(orgSlug))
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
    <SidebarGroup>
      <SidebarGroupLabel>Conversations</SidebarGroupLabel>
      <SidebarGroupAction
        aria-label="New conversation"
        disabled={createConversationMutation.isPending}
        onClick={() => {
          createConversationMutation.mutate()
        }}
      >
        <PlusIcon />
      </SidebarGroupAction>
      <SidebarGroupContent>
        <SidebarMenu>
          {conversationsQuery.isLoading ? (
            <>
              <SidebarMenuSkeleton showIcon />
              <SidebarMenuSkeleton showIcon />
            </>
          ) : null}

          {conversationsQuery.data?.map((conversation) => {
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
              <SidebarMenuItem key={conversation.id}>
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
                >
                  <ChatCircleDotsIcon />
                  <div className="flex min-w-0 flex-col text-left">
                    <span>{formatConversationLabel(conversation)}</span>
                    <span className="truncate text-xs text-sidebar-foreground/65">
                      {conversation.latestMessagePreview || "No messages yet"}
                    </span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}

          {!conversationsQuery.isLoading &&
          !conversationsQuery.isError &&
          (conversationsQuery.data?.length ?? 0) === 0 ? (
            <SidebarMenuItem>
              <SidebarMenuButton
                disabled
                tooltip="No conversations yet"
              >
                <ClockCounterClockwiseIcon />
                <span>No conversations yet</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
