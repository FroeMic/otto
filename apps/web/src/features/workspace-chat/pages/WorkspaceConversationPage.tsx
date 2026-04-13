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
  sendWorkspaceChatMessage,
  uploadWorkspaceChatAttachment,
  workspaceChatConversationDetailQueryOptions,
} from "../api/chat"
import { ConversationComposer } from "../components/ConversationComposer"
import { ConversationMessageList } from "../components/ConversationMessageList"
import { useViewportDockBounds } from "../hooks/useViewportDockBounds"
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
      attachments: Array<{
        fileName: string
        id: string
        mimeType: string
      }>
      text: string
    }) =>
      sendWorkspaceChatMessage({
        clientMessageId: crypto.randomUUID(),
        conversationId,
        orgSlug,
        parts: [
          ...(input.text
            ? [
                {
                  text: input.text,
                  type: "text" as const,
                },
              ]
            : []),
          ...input.attachments.map((attachment) => ({
            attachmentId: attachment.id,
            fileName: attachment.fileName,
            mimeType: attachment.mimeType,
            type: "file" as const,
          })),
        ],
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
