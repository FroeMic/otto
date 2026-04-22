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
import { getWorkspaceConversationTurnGroupKey } from "../presentation"
import { ConversationMessageBubble } from "./ConversationMessageBubble"
import { ConversationPendingState } from "./ConversationPendingState"
import {
  ConversationTurnHeader,
  ConversationTurnShell,
} from "./ConversationTurnPrimitives"
import { WorkspaceChatPromptSuggestions } from "./WorkspaceChatPromptSuggestions"

const MESSAGE_GROUPING_THRESHOLD_MS = 60_000

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
  const endRef = useRef<HTMLDivElement | null>(null)
  const previousLatestTurnKeyRef = useRef<string | null>(null)
  const latestTurnKey = lastMessage
    ? `${lastMessage.id}:${lastMessage.status}:${getMessageContentRevision(lastMessage)}`
    : null

  useEffect(() => {
    if (!lastMessage || !latestTurnKey) {
      return
    }

    const isOwnUserMessage =
      lastMessage.author.kind === "user" &&
      Boolean(currentUserId) &&
      lastMessage.author.userId === currentUserId
    const isActiveAssistantMessage =
      lastMessage.author.kind === "assistant" &&
      (lastMessage.status === "pending" || lastMessage.status === "streaming")

    if (!isOwnUserMessage && !isWaitingForReply && !isActiveAssistantMessage) {
      return
    }

    if (previousLatestTurnKeyRef.current === latestTurnKey) {
      return
    }

    previousLatestTurnKeyRef.current = latestTurnKey
    endRef.current?.scrollIntoView({ behavior: "auto", block: "end" })
  }, [currentUserId, isWaitingForReply, lastMessage, latestTurnKey])

  if (messages.length === 0) {
    return (
      <div className="flex h-full min-h-[20rem] items-center justify-center">
        <Empty className="border-0 px-6 py-0">
          <EmptyHeader>
            <EmptyTitle className="text-3xl font-semibold">
              What should Otto help with?
            </EmptyTitle>
            <EmptyDescription>Pick a start or write below.</EmptyDescription>
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
            <div key={message.id}>
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
                  startedAt={lastMessage?.createdAt ?? new Date().toISOString()}
                  status="pending"
                />
              </div>
            </div>
          </ConversationTurnShell>
        ) : null}
        <div aria-hidden className="h-px" ref={endRef} />
      </div>
    </ScrollArea>
  )
}

function getMessageContentRevision(message: WorkspaceChatMessage) {
  return message.parts
    .map((part) => {
      if (part.type === "text") {
        return part.text.length
      }

      if (part.type === "file" || part.type === "audio") {
        return part.attachmentId
      }

      return part.type
    })
    .join(":")
}

export function isGroupedWithPreviousMessage(input: {
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

  if (currentKey !== previousKey) {
    return false
  }

  return (
    Math.abs(
      new Date(currentMessage.createdAt).getTime() -
        new Date(previousMessage.createdAt).getTime(),
    ) <= MESSAGE_GROUPING_THRESHOLD_MS
  )
}
