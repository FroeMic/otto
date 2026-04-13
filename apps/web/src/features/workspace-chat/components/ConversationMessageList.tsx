import type {
  WorkspaceChatMessage,
  WorkspaceChatMessageEvent,
} from "@otto/feature-workspace-chat"
import { useEffect, useRef } from "react"

import { ScrollArea } from "@/components/ui/scroll-area"

import { ConversationMessageBubble } from "./ConversationMessageBubble"
import { ConversationPendingState } from "./ConversationPendingState"
import {
  ConversationTurnHeader,
  ConversationTurnShell,
} from "./ConversationTurnPrimitives"

export interface ConversationMessageListProps {
  bottomInset?: number
  currentUserId?: string
  isWaitingForReply: boolean
  messageEvents: WorkspaceChatMessageEvent[]
  messages: WorkspaceChatMessage[]
}

export function ConversationMessageList({
  bottomInset = 0,
  currentUserId,
  isWaitingForReply,
  messageEvents,
  messages,
}: ConversationMessageListProps) {
  const lastMessage = messages.at(-1)
  const messageRefs = useRef(new Map<string, HTMLDivElement>())
  const previousUserMessageIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (
      !lastMessage ||
      lastMessage.author.kind !== "user" ||
      !currentUserId ||
      lastMessage.author.userId !== currentUserId
    ) {
      return
    }

    if (previousUserMessageIdRef.current === lastMessage.id) {
      return
    }

    previousUserMessageIdRef.current = lastMessage.id
    messageRefs.current
      .get(lastMessage.id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [currentUserId, lastMessage])

  if (messages.length === 0) {
    return (
      <div className="flex h-full min-h-[20rem] items-center justify-center">
        <div className="flex max-w-lg flex-col gap-3 px-6 text-center">
          <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
            Workspace Chat
          </p>
          <h2 className="text-3xl font-semibold tracking-tight">
            Start a conversation with Otto
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Ask Otto to research, summarize, or take action in this workspace.
          </p>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full min-h-0">
      <div
        className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 md:py-10"
        style={{
          paddingBottom: `${bottomInset + 32}px`,
        }}
      >
        {messages.map((message) => {
          const events = messageEvents.filter(
            (messageEvent) => messageEvent.messageId === message.id,
          )

          return (
            <div
              key={message.id}
              ref={(node) => {
                if (node) {
                  messageRefs.current.set(message.id, node)
                  return
                }

                messageRefs.current.delete(message.id)
              }}
            >
              <ConversationMessageBubble
                currentUserId={currentUserId}
                events={events}
                message={message}
              />
            </div>
          )
        })}

        {isWaitingForReply ? (
          <ConversationTurnShell kind="assistant">
            <div className="flex w-full max-w-3xl flex-col gap-2">
              <ConversationTurnHeader
                badgeLabel="Otto"
                kind="assistant"
                name="Otto"
                statusLabel="Queued"
                timestampLabel={new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              />
              <div className="pl-10">
                <ConversationPendingState
                  startedAt={
                    lastMessage?.createdAt ?? new Date().toISOString()
                  }
                  status="pending"
                />
              </div>
            </div>
          </ConversationTurnShell>
        ) : null}
      </div>
    </ScrollArea>
  )
}
