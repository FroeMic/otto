"use client"

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { toast } from "sonner"

import { shellBootstrapQueryOptions } from "@/features/workspace/api/workspace"

import {
  cancelWorkspaceChatAssistantMessage,
  sendWorkspaceChatMessage,
  uploadWorkspaceChatAttachment,
  workspaceChatConversationDetailQueryOptions,
} from "../api/chat"
import { ConversationComposer } from "../components/ConversationComposer"
import { ConversationMessageList } from "../components/ConversationMessageList"
import { getActiveWorkspaceChatAssistantMessageToStop } from "../presentation"
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
    mutationFn: async (input: {
      parts: Parameters<typeof sendWorkspaceChatMessage>[0]["parts"]
    }) =>
      sendWorkspaceChatMessage({
        clientMessageId: crypto.randomUUID(),
        conversationId,
        orgSlug,
        parts: input.parts,
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
  const stopMessageMutation = useMutation({
    mutationFn: async (input: { assistantMessageId: string }) =>
      cancelWorkspaceChatAssistantMessage({
        assistantMessageId: input.assistantMessageId,
        conversationId,
        orgSlug,
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
        error instanceof Error ? error.message : "Failed to stop Otto.",
      )
    },
  })

  const lastMessage = data.messages.at(-1)
  const isWaitingForReply = lastMessage?.author.kind === "user"
  const activeAssistantMessage = getActiveWorkspaceChatAssistantMessageToStop(
    data.messages,
  )
  async function sendSuggestedPrompt(text: string) {
    await sendMessageMutation.mutateAsync({
      parts: [
        {
          text,
          type: "text",
        },
      ],
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1">
        <ConversationMessageList
          bottomInset={24}
          currentUserId={shellBootstrap.user.id}
          isWaitingForReply={isWaitingForReply}
          messageEvents={data.messageEvents}
          messages={data.messages}
          onSuggestedPromptSelect={(prompt) => {
            void sendSuggestedPrompt(prompt)
          }}
          orgSlug={orgSlug}
          suggestedPromptsDisabled={sendMessageMutation.isPending}
        />
      </div>

      <div className="z-30 shrink-0 bg-gradient-to-t from-background via-background to-background/80 px-4 pb-5 pt-3">
        <div className="mx-auto w-full max-w-3xl">
          <ConversationComposer
            disabled={sendMessageMutation.isPending}
            isRunning={Boolean(activeAssistantMessage)}
            isStopping={stopMessageMutation.isPending}
            orgSlug={orgSlug}
            onStop={
              activeAssistantMessage
                ? async () => {
                    await stopMessageMutation.mutateAsync({
                      assistantMessageId: activeAssistantMessage.id,
                    })
                  }
                : undefined
            }
            onSubmit={async (input) => {
              await sendMessageMutation.mutateAsync(input)
            }}
            onUploadAttachment={async (file) => {
              return await uploadWorkspaceChatAttachment({
                file,
                orgSlug,
              })
            }}
          />
        </div>
      </div>
    </div>
  )
}
