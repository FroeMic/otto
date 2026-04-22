import type {
  WorkspaceChatMessage,
  WorkspaceChatMessageEvent,
} from "@otto/feature-workspace-chat"
import {
  DownloadSimpleIcon,
  FileIcon,
  PauseIcon,
  PlayIcon,
  WaveformIcon,
} from "@phosphor-icons/react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

import { getWorkspaceChatAttachmentDownloadUrl } from "../api/chat"
import { useStreamingText } from "../hooks/useStreamingText"
import {
  getWorkspaceConversationTurnKind,
  getWorkspaceConversationTurnName,
} from "../presentation"
import { formatVoiceNoteDuration } from "../voice-note"
import { ConversationAssistantTrace } from "./ConversationAssistantTrace"
import { ConversationMarkdown } from "./ConversationMarkdown"
import {
  ConversationTurnHeader,
  ConversationTurnShell,
} from "./ConversationTurnPrimitives"
import { TraceCaretIcon } from "./TraceCaretIcon"

export interface ConversationMessageBubbleProps {
  currentUserId?: string
  events: WorkspaceChatMessageEvent[]
  message: WorkspaceChatMessage
  orgSlug: string
  showHeader?: boolean
}

export function ConversationMessageBubble({
  currentUserId,
  events,
  message,
  orgSlug,
  showHeader = true,
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
        {showHeader ? (
          <ConversationTurnHeader
            kind={turnKind}
            name={displayName}
            timestampLabel={timestampLabel}
          />
        ) : null}

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
                  <ConversationMarkdown
                    key={`${message.id}:${index}`}
                    isStreaming={message.status === "streaming"}
                    orgSlug={orgSlug}
                  >
                    {displayText}
                  </ConversationMarkdown>
                )
              })}
              {fileParts.length > 0 || audioParts.length > 0 ? (
                <AttachmentStack
                  audioParts={audioParts}
                  fileParts={fileParts}
                  isAudioPlaying={(attachmentId) =>
                    playingAudioAttachmentId === attachmentId
                  }
                  orgSlug={orgSlug}
                  surfaceClassName="bg-muted/40"
                  onToggleAudioPlayback={toggleAudioAttachmentPlayback}
                />
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
              <AttachmentStack
                audioParts={audioParts}
                className="mt-3"
                fileParts={fileParts}
                isAudioPlaying={(attachmentId) =>
                  playingAudioAttachmentId === attachmentId
                }
                orgSlug={orgSlug}
                surfaceClassName="bg-background/70"
                onToggleAudioPlayback={toggleAudioAttachmentPlayback}
              />
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

function formatTranscriptPreview(transcript: string | undefined) {
  const normalized = transcript?.trim().replace(/\s+/g, " ")
  if (!normalized) {
    return null
  }

  const words = normalized.split(" ")
  const preview = words.slice(0, 4).join(" ")
  return words.length > 4 ? `${preview}...` : preview
}

type FilePart = Extract<WorkspaceChatMessage["parts"][number], { type: "file" }>
type AudioPart = Extract<
  WorkspaceChatMessage["parts"][number],
  { type: "audio" }
>

interface AttachmentStackProps {
  audioParts: AudioPart[]
  className?: string
  fileParts: FilePart[]
  isAudioPlaying: (attachmentId: string) => boolean
  orgSlug: string
  surfaceClassName: string
  onToggleAudioPlayback: (attachmentId: string) => Promise<void>
}

function AttachmentStack({
  audioParts,
  className,
  fileParts,
  isAudioPlaying,
  orgSlug,
  surfaceClassName,
  onToggleAudioPlayback,
}: AttachmentStackProps) {
  return (
    <div className={cn("flex max-w-full flex-col gap-2", className)}>
      {fileParts.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {fileParts.map((part, index) => (
            <AttachmentChip
              key={`file:${part.attachmentId}:${index}`}
              attachmentId={part.attachmentId}
              className={surfaceClassName}
              label={part.fileName}
              orgSlug={orgSlug}
            >
              <FileIcon className="size-3.5 shrink-0" />
            </AttachmentChip>
          ))}
        </div>
      ) : null}
      {audioParts.length > 0 ? (
        <div className="flex max-w-full flex-col gap-2">
          {audioParts.map((part, index) => (
            <AudioAttachmentBlock
              key={`audio:${part.attachmentId}:${index}`}
              attachmentId={part.attachmentId}
              className={surfaceClassName}
              label={formatAudioPartLabel(part.durationMs)}
              isPlaying={isAudioPlaying(part.attachmentId)}
              orgSlug={orgSlug}
              transcript={part.transcript}
              onTogglePlayback={onToggleAudioPlayback}
            >
              <WaveformIcon className="size-3.5 shrink-0" />
            </AudioAttachmentBlock>
          ))}
        </div>
      ) : null}
    </div>
  )
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

interface AudioAttachmentBlockProps extends AttachmentChipProps {
  isPlaying: boolean
  onTogglePlayback: (attachmentId: string) => Promise<void>
  transcript?: string
}

function AudioAttachmentBlock({
  attachmentId,
  children,
  className,
  isPlaying,
  label,
  orgSlug,
  transcript,
  onTogglePlayback,
}: AudioAttachmentBlockProps) {
  const normalizedTranscript = transcript?.trim()
  const transcriptPreview = formatTranscriptPreview(normalizedTranscript)
  const displayLabel = transcriptPreview ?? label

  return (
    <Collapsible
      className="w-80 max-w-full"
      defaultOpen={Boolean(normalizedTranscript)}
    >
      <div
        className={cn(
          "inline-flex w-full max-w-full items-center gap-2 rounded-full border border-border/80 px-3 py-1 text-xs text-muted-foreground",
          className,
        )}
      >
        {children}
        <span className="min-w-0 truncate">{displayLabel}</span>
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
        {normalizedTranscript ? (
          <CollapsibleTrigger
            aria-label="Show voice note transcript"
            className="rounded-sm p-0.5 text-muted-foreground/80 transition hover:text-foreground [&[aria-expanded=true]>svg]:rotate-90"
          >
            <TraceCaretIcon className="transition-transform duration-150" />
          </CollapsibleTrigger>
        ) : (
          <span aria-hidden="true" className="size-5" />
        )}
      </div>
      {normalizedTranscript ? (
        <CollapsibleContent className="pt-1.5">
          <div className="ml-6 min-w-0 max-w-[calc(100%-1.5rem)] whitespace-pre-wrap break-words border-l border-border/80 pl-3 text-xs leading-5 text-muted-foreground">
            {normalizedTranscript}
          </div>
        </CollapsibleContent>
      ) : null}
    </Collapsible>
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
