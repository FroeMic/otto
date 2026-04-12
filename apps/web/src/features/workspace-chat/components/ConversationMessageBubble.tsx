import type {
  WorkspaceChatMessage,
  WorkspaceChatMessageEvent,
} from "@otto/feature-workspace-chat"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import { useStreamingText } from "../hooks/useStreamingText"
import { ConversationMessageActivityLane } from "./ConversationMessageActivityLane"

export interface ConversationMessageBubbleProps {
  events: WorkspaceChatMessageEvent[]
  message: WorkspaceChatMessage
}

export function ConversationMessageBubble({
  events,
  message,
}: ConversationMessageBubbleProps) {
  const isAssistant = message.author.kind === "assistant"
  const textParts = message.parts.filter((part) => part.type === "text")
  const lastTextPartIndex = textParts.length - 1
  const statusLabel =
    message.status === "pending"
      ? "Queued"
      : message.status === "streaming"
        ? "Running"
        : message.status === "failed"
          ? "Failed"
          : null
  const placeholderText =
    message.status === "pending"
      ? "Otto is queued to reply."
      : message.status === "streaming"
        ? "Otto is working on a reply."
        : message.status === "failed"
          ? "Otto could not complete this reply."
          : null
  const animatedLastTextPart = useStreamingText({
    isEnabled: isAssistant,
    messageId: message.id,
    status: message.status,
    targetText: textParts[lastTextPartIndex]?.text ?? "",
  })

  return (
    <div
      className={cn(
        "flex w-full",
        isAssistant ? "justify-start" : "justify-end",
      )}
    >
      <div
        className={cn(
          "flex w-full max-w-3xl flex-col gap-3 rounded-[1.5rem] border px-4 py-3 shadow-sm",
          isAssistant
            ? "border-border/70 bg-card text-card-foreground"
            : "border-primary/20 bg-primary/8 text-foreground",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">
              {message.author.name || (isAssistant ? "Otto" : "You")}
            </p>
            <Badge variant="outline">
              {isAssistant ? "Otto" : "Workspace"}
            </Badge>
            {statusLabel ? (
              <Badge variant="secondary">{statusLabel}</Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        {textParts.map((part, index) => {
          const displayText =
            isAssistant && index === lastTextPartIndex
              ? animatedLastTextPart
              : part.text

          return (
            <p
              key={`${message.id}:${index}`}
              className="whitespace-pre-wrap text-sm leading-6"
            >
              {displayText}
            </p>
          )
        })}

        {textParts.length === 0 && placeholderText ? (
          <p className="text-sm text-muted-foreground">{placeholderText}</p>
        ) : null}

        {isAssistant ? (
          <ConversationMessageActivityLane events={events} />
        ) : null}
      </div>
    </div>
  )
}
