import {
  DownloadSimpleIcon,
  FileIcon,
  PauseIcon,
  PlayIcon,
  WaveformIcon,
} from "@phosphor-icons/react"
import type {
  WorkspaceChatMessage,
  WorkspaceChatMessageEvent,
} from "@otto/feature-workspace-chat"
import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react"
import { toast } from "sonner"

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
  const [playingAudioAttachmentId, setPlayingAudioAttachmentId] = useState<
    string | null
  >(null)
  const playbackRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    return () => {
      playbackRef.current?.pause()
      playbackRef.current = null
    }
  }, [])

  async function toggleAudioAttachmentPlayback(attachmentId: string) {
    if (playingAudioAttachmentId === attachmentId && playbackRef.current) {
      playbackRef.current.pause()
      playbackRef.current = null
      setPlayingAudioAttachmentId(null)
      return
    }

    playbackRef.current?.pause()
    const audio = new Audio(
      getWorkspaceChatAttachmentDownloadUrl({
        attachmentId,
        disposition: "inline",
        orgSlug,
      }),
    )
    playbackRef.current = audio
    setPlayingAudioAttachmentId(attachmentId)
    audio.onended = () => {
      if (playbackRef.current === audio) {
        playbackRef.current = null
        setPlayingAudioAttachmentId(null)
      }
    }

    try {
      await audio.play()
    } catch {
      setPlayingAudioAttachmentId(null)
      playbackRef.current = null
      toast.error("Unable to play this voice note.")
    }
  }

  return (
    <ConversationTurnShell kind={turnKind}>
      <div className="flex w-full max-w-3xl flex-col gap-2">
        <ConversationTurnHeader
          kind={turnKind}
          name={displayName}
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
                    <AudioAttachmentChip
                      key={`${message.id}:audio:${index}`}
                      attachmentId={part.attachmentId}
                      className="bg-muted/40"
                      label={
                        part.transcript?.trim() ||
                        formatAudioPartLabel(part.durationMs)
                      }
                      isPlaying={playingAudioAttachmentId === part.attachmentId}
                      orgSlug={orgSlug}
                      onTogglePlayback={toggleAudioAttachmentPlayback}
                    >
                      <WaveformIcon className="size-3.5 shrink-0" />
                    </AudioAttachmentChip>
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
                  <AudioAttachmentChip
                    key={`${message.id}:audio:${index}`}
                    attachmentId={part.attachmentId}
                    className="bg-background/70"
                    label={
                      part.transcript?.trim() ||
                      formatAudioPartLabel(part.durationMs)
                    }
                    isPlaying={playingAudioAttachmentId === part.attachmentId}
                    orgSlug={orgSlug}
                    onTogglePlayback={toggleAudioAttachmentPlayback}
                  >
                    <WaveformIcon className="size-3.5 shrink-0" />
                  </AudioAttachmentChip>
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
  async function handleDownload() {
    try {
      await downloadWorkspaceAttachment({
        attachmentId,
        orgSlug,
      })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Attachment download failed.",
      )
    }
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border/80 px-3 py-1 text-xs text-muted-foreground",
        className,
      )}
    >
      {children}
      <span>{label}</span>
      <button
        aria-label={`Download ${label}`}
        className="rounded-sm p-0.5 text-muted-foreground/80 transition hover:text-foreground"
        onClick={() => {
          void handleDownload()
        }}
        type="button"
      >
        <DownloadSimpleIcon className="size-3.5" />
      </button>
    </span>
  )
}

interface AudioAttachmentChipProps extends AttachmentChipProps {
  isPlaying: boolean
  onTogglePlayback: (attachmentId: string) => Promise<void>
}

function AudioAttachmentChip({
  attachmentId,
  children,
  className,
  isPlaying,
  label,
  orgSlug,
  onTogglePlayback,
}: AudioAttachmentChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border/80 px-3 py-1 text-xs text-muted-foreground",
        className,
      )}
    >
      {children}
      <span>{label}</span>
      <button
        aria-label={isPlaying ? `Pause ${label}` : `Play ${label}`}
        className="rounded-sm p-0.5 text-muted-foreground/80 transition hover:text-foreground"
        onClick={() => {
          void onTogglePlayback(attachmentId)
        }}
        type="button"
      >
        {isPlaying ? (
          <PauseIcon className="size-3.5" weight="fill" />
        ) : (
          <PlayIcon className="size-3.5" weight="fill" />
        )}
      </button>
      <button
        aria-label={`Download ${label}`}
        className="rounded-sm p-0.5 text-muted-foreground/80 transition hover:text-foreground"
        onClick={() => {
          void (async () => {
            try {
              await downloadWorkspaceAttachment({
                attachmentId,
                orgSlug,
              })
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Attachment download failed.",
              )
            }
          })()
        }}
        type="button"
      >
        <DownloadSimpleIcon className="size-3.5" />
      </button>
    </span>
  )
}

async function downloadWorkspaceAttachment(input: {
  attachmentId: string
  orgSlug: string
}) {
  const response = await fetch(
    getWorkspaceChatAttachmentDownloadUrl({
      attachmentId: input.attachmentId,
      orgSlug: input.orgSlug,
    }),
  )

  if (!response.ok) {
    const fallbackMessage = "Attachment download failed."
    try {
      const payload = (await response.json()) as { error?: unknown }
      throw new Error(
        typeof payload.error === "string" && payload.error.trim().length > 0
          ? payload.error
          : fallbackMessage,
      )
    } catch {
      throw new Error(fallbackMessage)
    }
  }

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = objectUrl
  link.download = resolveDownloadName(response) ?? "download"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(objectUrl)
}

function resolveDownloadName(response: Response) {
  const contentDisposition = response.headers.get("content-disposition")
  if (!contentDisposition) {
    return null
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch {
      return utf8Match[1]
    }
  }

  const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i)
  if (quotedMatch?.[1]) {
    return quotedMatch[1]
  }

  const bareMatch = contentDisposition.match(/filename=([^;]+)/i)
  return bareMatch?.[1]?.trim() ?? null
}
