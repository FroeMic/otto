import type {
  WorkspaceChatMessage,
  WorkspaceChatMessageEvent,
} from "@otto/feature-workspace-chat"

import { cn } from "@/lib/utils"

import { useStreamingText } from "../hooks/useStreamingText"
import {
  getWorkspaceConversationTurnKind,
  getWorkspaceConversationTurnName,
} from "../presentation"
import { ConversationAssistantTrace } from "./ConversationAssistantTrace"
import { ConversationPendingState } from "./ConversationPendingState"
import {
  ConversationTurnHeader,
  ConversationTurnShell,
} from "./ConversationTurnPrimitives"

export interface ConversationMessageBubbleProps {
  currentUserId?: string
  events: WorkspaceChatMessageEvent[]
  message: WorkspaceChatMessage
}

export function ConversationMessageBubble({
  currentUserId,
  events,
  message,
}: ConversationMessageBubbleProps) {
  const turnKind = getWorkspaceConversationTurnKind({
    currentUserId,
    message,
  })
  const isAssistant = turnKind === "assistant"
  const textParts = message.parts.filter((part) => part.type === "text")
  const lastTextPartIndex = textParts.length - 1
  const displayName = getWorkspaceConversationTurnName({
    message,
    turnKind,
  })
  const statusLabel =
    message.status === "pending"
      ? "Queued"
      : message.status === "streaming"
        ? "Running"
        : message.status === "failed"
          ? "Failed"
          : null
  const animatedLastTextPart = useStreamingText({
    isEnabled: isAssistant,
    messageId: message.id,
    status: message.status,
    targetText: textParts[lastTextPartIndex]?.text ?? "",
  })
  const timestampLabel = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <ConversationTurnShell kind={turnKind}>
      <div className="flex w-full max-w-3xl flex-col gap-2">
        <ConversationTurnHeader
          badgeLabel={isAssistant ? "Otto" : undefined}
          kind={turnKind}
          name={displayName}
          statusLabel={statusLabel}
          timestampLabel={timestampLabel}
        />

        {isAssistant ? (
          <div className="flex w-full flex-col gap-3 pl-10">
            <ConversationAssistantTrace
              events={events}
              startedAt={message.createdAt}
            />
            <div className="flex flex-col gap-3">
              {textParts.map((part, index) => {
                const displayText =
                  index === lastTextPartIndex ? animatedLastTextPart : part.text

                return (
                  <p
                    key={`${message.id}:${index}`}
                    className="whitespace-pre-wrap text-sm leading-7 text-foreground"
                  >
                    {displayText}
                  </p>
                )
              })}

              {textParts.length === 0 ? (
                <ConversationPendingState
                  startedAt={message.createdAt}
                  status={message.status}
                />
              ) : null}
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "max-w-[85%] rounded-2xl px-4 py-3 shadow-sm",
              turnKind === "current_user"
                ? "bg-secondary text-foreground"
                : "bg-muted/70 text-foreground",
            )}
          >
            {textParts.map((part, index) => (
              <p
                key={`${message.id}:${index}`}
                className="whitespace-pre-wrap text-sm leading-6"
              >
                {part.text}
              </p>
            ))}
          </div>
        )}
      </div>
    </ConversationTurnShell>
  )
}
