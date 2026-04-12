import type {
  WorkspaceChatMessage,
  WorkspaceChatMessageEvent,
} from "@otto/feature-workspace-chat"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"

import { ConversationMessageBubble } from "./ConversationMessageBubble"

export interface ConversationMessageListProps {
  isWaitingForReply: boolean
  messageEvents: WorkspaceChatMessageEvent[]
  messages: WorkspaceChatMessage[]
}

export function ConversationMessageList({
  isWaitingForReply,
  messageEvents,
  messages,
}: ConversationMessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex min-h-[18rem] items-center justify-center rounded-[1.5rem] border border-dashed border-border/70 bg-card/40 px-6 py-10 text-center">
        <div className="flex max-w-sm flex-col gap-2">
          <p className="text-sm font-medium">Start the conversation</p>
          <p className="text-sm text-muted-foreground">
            Messages you send here go through the workspace backend to the
            tenant runtime and return through the new workspace chat channel.
          </p>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="min-h-[20rem] rounded-[1.5rem] border border-border/70 bg-muted/15">
      <div className="flex flex-col gap-4 p-4 md:p-5">
        {messages.map((message) => {
          const events = messageEvents.filter(
            (messageEvent) => messageEvent.messageId === message.id,
          )

          return (
            <ConversationMessageBubble
              key={message.id}
              events={events}
              message={message}
            />
          )
        })}

        {isWaitingForReply ? (
          <div className="flex items-center gap-2 rounded-[1.25rem] border border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
            <Spinner />
            <span>Waiting for Otto…</span>
          </div>
        ) : null}
      </div>
    </ScrollArea>
  )
}
