import {
  DownloadSimpleIcon,
  FileIcon,
  WaveformIcon,
} from "@phosphor-icons/react"
import type {
  WorkspaceChatMessage,
  WorkspaceChatMessageEvent,
} from "@otto/feature-workspace-chat"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

import { getWorkspaceChatAttachmentDownloadUrl } from "../api/chat"
import { useStreamingText } from "../hooks/useStreamingText"
import {
  getWorkspaceConversationTurnKind,
  getWorkspaceConversationTurnName,
} from "../presentation"
import { ConversationAssistantTrace } from "./ConversationAssistantTrace"
import {
  ConversationTurnHeader,
  ConversationTurnShell,
} from "./ConversationTurnPrimitives"
import { formatVoiceNoteDuration } from "../voice-note"

export interface ConversationMessageBubbleProps {
  currentUserId?: string
  events: WorkspaceChatMessageEvent[]
  message: WorkspaceChatMessage
  orgSlug: string
}

export function ConversationMessageBubble({
  currentUserId,
  events,
  message,
  orgSlug,
}: ConversationMessageBubbleProps) {
  const turnKind = getWorkspaceConversationTurnKind({
    currentUserId,
    message,
  })
  const isAssistant = turnKind === "assistant"
  const textParts = message.parts.filter((part) => part.type === "text")
  const fileParts = message.parts.filter((part) => part.type === "file")
  const audioParts = message.parts.filter((part) => part.type === "audio")
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
          <div className="flex w-full flex-col gap-3">
            <ConversationAssistantTrace
              events={events}
              startedAt={message.createdAt}
              status={message.status}
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
              {fileParts.length > 0 || audioParts.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {fileParts.map((part, index) => (
                    <AttachmentChip
                      key={`${message.id}:file:${index}`}
                      attachmentId={part.attachmentId}
                      className="bg-muted/40"
                      label={part.fileName}
                      orgSlug={orgSlug}
                    >
                      <FileIcon className="size-3.5 shrink-0" />
                    </AttachmentChip>
                  ))}
                  {audioParts.map((part, index) => (
                    <AttachmentChip
                      key={`${message.id}:audio:${index}`}
                      attachmentId={part.attachmentId}
                      className="bg-muted/40"
                      label={
                        part.transcript?.trim() ||
                        formatAudioPartLabel(part.durationMs)
                      }
                      orgSlug={orgSlug}
                    >
                      <WaveformIcon className="size-3.5 shrink-0" />
                    </AttachmentChip>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "max-w-[85%] px-4 py-3",
              turnKind === "current_user" ? "self-end" : "self-start",
              turnKind === "other_user"
                ? "rounded-[1.15rem] bg-muted/65 text-foreground"
                : "rounded-[1.15rem]",
              turnKind === "current_user"
                ? "bg-secondary text-foreground"
                : "text-foreground",
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

            {fileParts.length > 0 || audioParts.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {fileParts.map((part, index) => (
                  <AttachmentChip
                    key={`${message.id}:file:${index}`}
                    attachmentId={part.attachmentId}
                    className="bg-background/70"
                    label={part.fileName}
                    orgSlug={orgSlug}
                  >
                    <FileIcon className="size-3.5 shrink-0" />
                  </AttachmentChip>
                ))}
                {audioParts.map((part, index) => (
                  <AttachmentChip
                    key={`${message.id}:audio:${index}`}
                    attachmentId={part.attachmentId}
                    className="bg-background/70"
                    label={
                      part.transcript?.trim() ||
                      formatAudioPartLabel(part.durationMs)
                    }
                    orgSlug={orgSlug}
                  >
                    <WaveformIcon className="size-3.5 shrink-0" />
                  </AttachmentChip>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </ConversationTurnShell>
  )
}

function formatAudioPartLabel(durationMs?: number) {
  if (typeof durationMs !== "number") {
    return "Voice note"
  }

  return `Voice note · ${formatVoiceNoteDuration(durationMs)}`
}

interface AttachmentChipProps {
  attachmentId: string
  children: ReactNode
  className?: string
  label: string
  orgSlug: string
}

function AttachmentChip({
  attachmentId,
  children,
  className,
  label,
  orgSlug,
}: AttachmentChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border/80 px-3 py-1 text-xs text-muted-foreground",
        className,
      )}
    >
      {children}
      <span>{label}</span>
      <a
        aria-label={`Download ${label}`}
        className="rounded-sm p-0.5 text-muted-foreground/80 transition hover:text-foreground"
        download
        href={getWorkspaceChatAttachmentDownloadUrl({
          attachmentId,
          orgSlug,
        })}
      >
        <DownloadSimpleIcon className="size-3.5" />
      </a>
    </span>
  )
}
