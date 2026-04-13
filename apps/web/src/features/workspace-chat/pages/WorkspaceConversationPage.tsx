"use client"

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"

import { shellBootstrapQueryOptions } from "@/features/workspace/api/workspace"

import {
  sendWorkspaceChatMessage,
  workspaceChatConversationDetailQueryOptions,
} from "../api/chat"
import { ConversationComposer } from "../components/ConversationComposer"
import { ConversationMessageList } from "../components/ConversationMessageList"
import { useWorkspaceConversationRealtime } from "../realtime/useWorkspaceConversationRealtime"

export interface WorkspaceConversationPageProps {
  conversationId: string
  orgSlug: string
}

export function WorkspaceConversationPage({
  conversationId,
  orgSlug,
}: WorkspaceConversationPageProps) {
  useWorkspaceConversationRealtime({
    conversationId,
  })

  const queryClient = useQueryClient()
  const { data: shellBootstrap } = useSuspenseQuery(
    shellBootstrapQueryOptions(orgSlug),
  )
  const { data } = useSuspenseQuery(
    workspaceChatConversationDetailQueryOptions(orgSlug, conversationId),
  )
  const sendMessageMutation = useMutation({
    mutationFn: async (text: string) =>
      sendWorkspaceChatMessage({
        clientMessageId: crypto.randomUUID(),
        conversationId,
        orgSlug,
        text,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["workspace-chat-conversation", orgSlug, conversationId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["workspace-chat-conversations", orgSlug],
        }),
      ])
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to send message.",
      )
    },
  })

  const lastMessage = data.messages.at(-1)
  const isWaitingForReply = lastMessage?.author.kind === "user"

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pb-4 pt-2">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
              Conversation
            </p>
            <Badge variant="outline">{data.conversation.visibility}</Badge>
          </div>
          <h1 className="truncate text-3xl font-semibold tracking-tight">
            {data.conversation.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            /{orgSlug}/c/{data.conversation.id}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <ConversationMessageList
          currentUserId={shellBootstrap.user.id}
          isWaitingForReply={isWaitingForReply}
          messageEvents={data.messageEvents}
          messages={data.messages}
        />
      </div>

      <div className="border-t border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="mx-auto w-full max-w-3xl px-4 pb-4 pt-3">
          <ConversationComposer
            disabled={sendMessageMutation.isPending}
            onSubmit={async (text) => {
              await sendMessageMutation.mutateAsync(text)
            }}
          />
        </div>
      </div>
    </div>
  )
}
