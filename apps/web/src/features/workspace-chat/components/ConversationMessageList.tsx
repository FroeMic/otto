import type {
  WorkspaceChatMessage,
  WorkspaceChatMessageEvent,
} from "@otto/feature-workspace-chat"
import { useEffect, useRef } from "react"

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"

import { ConversationMessageBubble } from "./ConversationMessageBubble"
import { ConversationPendingState } from "./ConversationPendingState"
import {
  ConversationTurnHeader,
  ConversationTurnShell,
} from "./ConversationTurnPrimitives"
import { getWorkspaceConversationTurnGroupKey } from "../presentation"
import { WorkspaceChatPromptSuggestions } from "./WorkspaceChatPromptSuggestions"

export interface ConversationMessageListProps {
  bottomInset?: number
  currentUserId?: string
  isWaitingForReply: boolean
  messageEvents: WorkspaceChatMessageEvent[]
  messages: WorkspaceChatMessage[]
  onSuggestedPromptSelect?: (prompt: string) => void
  orgSlug: string
  suggestedPromptsDisabled?: boolean
}

export function ConversationMessageList({
  bottomInset = 0,
  currentUserId,
  isWaitingForReply,
  messageEvents,
  messages,
  onSuggestedPromptSelect,
  orgSlug,
  suggestedPromptsDisabled = false,
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
        <Empty className="border-0 px-6 py-0">
          <EmptyHeader>
            <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
              Workspace Chat
            </p>
            <EmptyTitle className="text-3xl font-semibold">
              Start a conversation with Otto
            </EmptyTitle>
            <EmptyDescription>
              Ask Otto to research, summarize, or take action in this workspace.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="max-w-2xl">
            <WorkspaceChatPromptSuggestions
              disabled={suggestedPromptsDisabled}
              onSelect={onSuggestedPromptSelect}
            />
          </EmptyContent>
        </Empty>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full min-h-0">
      <div
        className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-8 md:py-10"
        style={{
          paddingBottom: `${bottomInset + 32}px`,
        }}
      >
        {messages.map((message, index) => {
          const events = messageEvents.filter(
            (messageEvent) => messageEvent.messageId === message.id,
          )
          const showHeader = !isGroupedWithPreviousMessage({
            currentMessage: message,
            currentUserId,
            previousMessage: messages[index - 1],
          })

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
                orgSlug={orgSlug}
                showHeader={showHeader}
              />
            </div>
          )
        })}

        {isWaitingForReply ? (
          <ConversationTurnShell kind="assistant">
            <div className="flex w-full max-w-3xl flex-col gap-2">
              <ConversationTurnHeader
                kind="assistant"
                name="Otto"
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

function isGroupedWithPreviousMessage(input: {
  currentMessage: WorkspaceChatMessage
  currentUserId?: string
  previousMessage: WorkspaceChatMessage | undefined
}) {
  const { currentMessage, currentUserId, previousMessage } = input

  if (!previousMessage) {
    return false
  }

  const currentKey = getWorkspaceConversationTurnGroupKey({
    currentUserId,
    message: currentMessage,
  })
  const previousKey = getWorkspaceConversationTurnGroupKey({
    currentUserId,
    message: previousMessage,
  })

  return currentKey === previousKey
}
