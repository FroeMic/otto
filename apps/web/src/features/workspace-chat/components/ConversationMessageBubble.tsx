import type { WorkspaceChatMessage } from "@otto/feature-workspace-chat"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface ConversationMessageBubbleProps {
  message: WorkspaceChatMessage
}

export function ConversationMessageBubble({
  message,
}: ConversationMessageBubbleProps) {
  const isAssistant = message.author.kind === "assistant"
  const textParts = message.parts.filter((part) => part.type === "text")

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
          </div>
          <p className="text-xs text-muted-foreground">
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        {textParts.map((part, index) => (
          <p key={`${message.id}:${index}`} className="whitespace-pre-wrap text-sm leading-6">
            {part.text}
          </p>
        ))}
      </div>
    </div>
  )
}
