"use client"

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
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
import { useViewportDockBounds } from "../hooks/useViewportDockBounds"
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
  const composerRef = useRef<HTMLDivElement | null>(null)
  const [composerHeight, setComposerHeight] = useState(0)
  const { boundsRef, dockStyle } = useViewportDockBounds()

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
    mutationFn: async (input: {
      assistantMessageId: string
    }) =>
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

  useEffect(() => {
    const composerElement = composerRef.current

    if (!composerElement) {
      return
    }

    const updateHeight = () => {
      setComposerHeight(composerElement.getBoundingClientRect().height)
    }

    updateHeight()

    const resizeObserver = new ResizeObserver(updateHeight)
    resizeObserver.observe(composerElement)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  const lastMessage = data.messages.at(-1)
  const isWaitingForReply = lastMessage?.author.kind === "user"
  const activeAssistantMessage = getActiveWorkspaceChatAssistantMessageToStop(
    data.messages,
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        aria-hidden
        className="mx-auto h-0 w-full max-w-3xl px-4"
        ref={boundsRef}
      />
      <div className="min-h-0 flex-1">
        <ConversationMessageList
          bottomInset={composerHeight + 32}
          currentUserId={shellBootstrap.user.id}
          isWaitingForReply={isWaitingForReply}
          messageEvents={data.messageEvents}
          messages={data.messages}
          orgSlug={orgSlug}
        />
      </div>

      <div
        className="pointer-events-none fixed bottom-0 z-30"
        style={dockStyle}
      >
        <div
          className="pointer-events-auto w-full px-4 pb-5"
          ref={composerRef}
        >
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
