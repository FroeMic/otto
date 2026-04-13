"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { startTransition } from "react"
import { toast } from "sonner"

import {
  createWorkspaceChatConversation,
  sendWorkspaceChatMessage,
} from "../api/chat"
import { WorkspaceAgentPromptCard } from "../components/WorkspaceAgentPromptCard"

export interface WorkspaceAgentPageProps {
  orgSlug: string
}

export function WorkspaceAgentPage({
  orgSlug,
}: WorkspaceAgentPageProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const startConversationMutation = useMutation({
    mutationFn: async (text: string) => {
      const conversation = await createWorkspaceChatConversation({
        orgSlug,
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

      await sendWorkspaceChatMessage({
        clientMessageId: crypto.randomUUID(),
        conversationId: conversation.id,
        orgSlug,
        text,
      })

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["workspace-chat-conversations", orgSlug],
        }),
        queryClient.invalidateQueries({
          queryKey: ["workspace-chat-conversation", orgSlug, conversation.id],
        }),
      ])
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to start an agent conversation.",
      )
    },
  })

  return (
    <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[2rem] border border-border/60 bg-background">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 size-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-border/35 opacity-60" />
        <div className="absolute left-1/2 top-1/2 h-72 w-16 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-border/12" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col px-6">
        <div className="mx-auto w-full max-w-2xl">
          <WorkspaceAgentPromptCard
            disabled={startConversationMutation.isPending}
            onSubmit={async (text) => {
              await startConversationMutation.mutateAsync(text)
            }}
          />
        </div>
      </div>
    </div>
  )
}
