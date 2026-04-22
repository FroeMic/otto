import type { WorkspaceChatAttachment } from "@otto/feature-workspace-chat"
import {
  FileIcon,
  MicrophoneIcon,
  PaperclipIcon,
  PaperPlaneTiltIcon,
  PauseIcon,
  PlayIcon,
  StopIcon,
  WaveformIcon,
  XIcon,
} from "@phosphor-icons/react"
import {
  type DragEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import {
  buildWorkspaceChatComposerParts,
  type WorkspaceChatComposerAttachmentDraft,
} from "../composer-parts"
import { extractWorkspaceChatDropFiles } from "../drop-files"
import { formatVoiceNoteDuration } from "../voice-note"
import { ConversationVoiceNoteRecorder } from "./ConversationVoiceNoteRecorder"

export interface ConversationComposerProps {
  className?: string
  disabled?: boolean
  initialDraft?: string
  isRunning?: boolean
  isStopping?: boolean
  orgSlug: string
  onStop?: () => Promise<void> | void
  onSubmit: (input: {
    parts: ReturnType<typeof buildWorkspaceChatComposerParts>
  }) => Promise<void> | void
  onUploadAttachment?: (file: File) => Promise<WorkspaceChatAttachment>
  placeholder?: string
}

export function ConversationComposer({
  className,
  disabled = false,
  initialDraft = "",
  isRunning = false,
  isStopping = false,
  onStop,
  onSubmit,
  onUploadAttachment,
  placeholder = "Message Otto in this workspace conversation",
}: ConversationComposerProps) {
  const [draft, setDraft] = useState(initialDraft)
  const [attachments, setAttachments] = useState<
    WorkspaceChatComposerAttachmentDraft[]
  >([])
  const [dragDepth, setDragDepth] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [isVoiceMode, setIsVoiceMode] = useState(false)
  const [playingAttachmentId, setPlayingAttachmentId] = useState<string | null>(
    null,
  )
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const attachmentsRef = useRef<WorkspaceChatComposerAttachmentDraft[]>([])

  useLayoutEffect(() => {
    const textarea = textareaRef.current

    if (!textarea) {
      return
    }

    textarea.style.height = "0px"
    textarea.style.height = `${Math.min(textarea.scrollHeight, 240)}px`
  })

  useEffect(() => {
    setDraft((current) => {
      if (current.trim().length > 0 || initialDraft.trim().length === 0) {
        return current
      }

      return initialDraft
    })
  }, [initialDraft])

  async function submitDraft() {
    const parts = buildWorkspaceChatComposerParts({
      attachments,
      text: draft,
    })

    if (parts.length === 0 || disabled || isRunning) {
      return
    }

    await onSubmit({ parts })
    releaseAllAudioPreviews(attachments)
    setAttachments([])
    setDraft("")
    setPlayingAttachmentId(null)
  }

  async function attachVoiceNote(input: { durationMs: number; file: File }) {
    if (!onUploadAttachment) {
      return
    }

    setIsUploading(true)

    try {
      const attachment = await onUploadAttachment(input.file)

      setAttachments((current) => [
        ...current.filter((entry) => entry.attachment.id !== attachment.id),
        {
          attachment,
          durationMs: input.durationMs,
          kind: "audio",
          previewUrl: URL.createObjectURL(input.file),
        },
      ])
    } finally {
      setIsUploading(false)
    }
  }

  function resetDragState() {
    setDragDepth(0)
  }

  async function uploadFiles(files: File[]) {
    if (files.length === 0 || !onUploadAttachment) {
      return
    }

    setIsUploading(true)

    try {
      const uploaded = await Promise.all(
        files.map((file) => onUploadAttachment(file)),
      )
      setAttachments((current) => [
        ...current,
        ...uploaded.map((attachment) => ({
          attachment,
          kind: "file" as const,
        })),
      ])
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload attachment.",
      )
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  useEffect(() => {
    attachmentsRef.current = attachments
  }, [attachments])

  useEffect(() => {
    return () => {
      previewAudioRef.current?.pause()
      previewAudioRef.current = null
      releaseAllAudioPreviews(attachmentsRef.current)
    }
  }, [])

  function removeAttachment(entryId: string) {
    setAttachments((current) => {
      const entry = current.find((item) => item.attachment.id === entryId)

      if (entry?.kind === "audio" && entry.previewUrl) {
        URL.revokeObjectURL(entry.previewUrl)
      }

      return current.filter((item) => item.attachment.id !== entryId)
    })

    if (playingAttachmentId === entryId) {
      previewAudioRef.current?.pause()
      previewAudioRef.current = null
      setPlayingAttachmentId(null)
    }
  }

  async function toggleAudioPreview(
    entry: WorkspaceChatComposerAttachmentDraft,
  ) {
    if (entry.kind !== "audio" || !entry.previewUrl) {
      return
    }

    if (
      playingAttachmentId === entry.attachment.id &&
      previewAudioRef.current
    ) {
      previewAudioRef.current.pause()
      previewAudioRef.current = null
      setPlayingAttachmentId(null)
      return
    }

    previewAudioRef.current?.pause()
    const audio = new Audio(entry.previewUrl)
    previewAudioRef.current = audio
    setPlayingAttachmentId(entry.attachment.id)
    audio.onended = () => {
      if (previewAudioRef.current === audio) {
        previewAudioRef.current = null
        setPlayingAttachmentId(null)
      }
    }

    try {
      await audio.play()
    } catch {
      setPlayingAttachmentId(null)
    }
  }

  function handleDragEnter(event: DragEvent<HTMLElement>) {
    if (!onUploadAttachment || isVoiceMode) {
      return
    }

    if (!hasDraggedFiles(event)) {
      return
    }

    event.preventDefault()
    setDragDepth((current) => current + 1)
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    if (!onUploadAttachment || isVoiceMode || !hasDraggedFiles(event)) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = "copy"
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    if (!onUploadAttachment || isVoiceMode || !hasDraggedFiles(event)) {
      return
    }

    event.preventDefault()
    setDragDepth((current) => Math.max(0, current - 1))
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    if (!onUploadAttachment || isVoiceMode || !hasDraggedFiles(event)) {
      return
    }

    event.preventDefault()
    resetDragState()
    void uploadFiles(extractWorkspaceChatDropFiles(event.dataTransfer))
  }

  return (
    <fieldset
      aria-label="Message composer"
      className={cn(
        "relative rounded-lg border border-border/70 bg-background/96 px-4 py-3 shadow-[0_16px_40px_rgba(15,23,42,0.06)] backdrop-blur-xl transition-colors",
        dragDepth > 0 && "border-primary/55 bg-primary/[0.03]",
        className,
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {dragDepth > 0 ? (
        <div className="pointer-events-none absolute inset-2 z-10 rounded-md border border-dashed border-primary/50 bg-primary/[0.05]">
          <div className="flex h-full items-center justify-center text-sm font-medium text-primary/80">
            Drop files to attach them
          </div>
        </div>
      ) : null}

      {attachments.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.attachment.id}
              className="flex items-center gap-2 rounded-full border border-border/80 bg-muted/45 px-3 py-1 text-xs text-muted-foreground"
            >
              {attachment.kind === "audio" ? (
                <WaveformIcon className="size-3.5 shrink-0" />
              ) : (
                <FileIcon className="size-3.5 shrink-0" />
              )}
              <span className="max-w-44 truncate">
                {attachment.kind === "audio"
                  ? `Voice note${typeof attachment.durationMs === "number" ? ` · ${formatVoiceNoteDuration(attachment.durationMs)}` : ""}`
                  : attachment.attachment.fileName}
              </span>
              {attachment.kind === "audio" ? (
                <button
                  aria-label={
                    playingAttachmentId === attachment.attachment.id
                      ? "Pause voice note preview"
                      : "Play voice note preview"
                  }
                  className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground/80 transition hover:text-foreground"
                  disabled={disabled || isUploading || !attachment.previewUrl}
                  onClick={() => {
                    void toggleAudioPreview(attachment)
                  }}
                  type="button"
                >
                  {playingAttachmentId === attachment.attachment.id ? (
                    <PauseIcon className="size-3" weight="fill" />
                  ) : (
                    <PlayIcon className="size-3" weight="fill" />
                  )}
                </button>
              ) : null}
              <button
                aria-label={`Remove ${attachment.kind === "audio" ? "voice note" : attachment.attachment.fileName}`}
                className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground/80 transition hover:text-foreground"
                disabled={disabled || isUploading}
                onClick={() => {
                  removeAttachment(attachment.attachment.id)
                }}
                type="button"
              >
                <XIcon className="size-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <Textarea
        aria-label="Message"
        className="max-h-60 min-h-[5.5rem] resize-none overflow-y-auto rounded-none border-0 bg-transparent px-0 py-1 text-base leading-8 shadow-none focus-visible:ring-0 md:text-[15px]"
        disabled={disabled || isUploading || isVoiceMode}
        onChange={(event) => {
          setDraft(event.target.value)
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault()
            void submitDraft()
          }
        }}
        placeholder={placeholder}
        ref={textareaRef}
        value={draft}
      />

      <div className="pt-2">
        {isVoiceMode ? (
          <ConversationVoiceNoteRecorder
            disabled={disabled || isUploading}
            onAttachVoiceNote={attachVoiceNote}
            onCancel={() => {
              setIsVoiceMode(false)
            }}
          />
        ) : (
          <>
            <input
              className="hidden"
              multiple
              onChange={(event) => {
                void uploadFiles(Array.from(event.target.files ?? []))
              }}
              ref={fileInputRef}
              type="file"
            />

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        aria-label="Attach files"
                        className="size-10 rounded-full text-muted-foreground"
                        disabled={
                          disabled ||
                          isRunning ||
                          isUploading ||
                          !onUploadAttachment
                        }
                        onClick={() => {
                          fileInputRef.current?.click()
                        }}
                        size="icon"
                        title="Attach files"
                        type="button"
                        variant="ghost"
                      />
                    }
                  >
                    <PaperclipIcon />
                  </TooltipTrigger>
                  <TooltipContent>Attach files</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        aria-label="Record voice note"
                        className="size-10 rounded-full text-muted-foreground"
                        disabled={
                          disabled ||
                          isRunning ||
                          isUploading ||
                          !onUploadAttachment
                        }
                        onClick={() => {
                          setIsVoiceMode(true)
                        }}
                        size="icon"
                        title="Record voice note"
                        type="button"
                        variant="ghost"
                      />
                    }
                  >
                    <MicrophoneIcon />
                  </TooltipTrigger>
                  <TooltipContent>Record voice note</TooltipContent>
                </Tooltip>
              </div>

              {isRunning && onStop ? (
                <Button
                  className="rounded-full border-destructive/35 bg-destructive px-5 text-destructive-foreground shadow-none hover:bg-destructive/90"
                  disabled={isStopping}
                  onClick={() => void onStop()}
                  type="button"
                >
                  <StopIcon data-icon="inline-start" weight="fill" />
                  {isStopping ? "Stopping" : "Stop"}
                </Button>
              ) : (
                <Button
                  className="rounded-full bg-primary px-5 text-primary-foreground shadow-none hover:bg-primary/90"
                  disabled={
                    disabled ||
                    isUploading ||
                    (draft.trim().length === 0 && attachments.length === 0)
                  }
                  onClick={() => void submitDraft()}
                  type="button"
                >
                  <PaperPlaneTiltIcon data-icon="inline-start" />
                  Send
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </fieldset>
  )
}

function releaseAllAudioPreviews(
  attachments: WorkspaceChatComposerAttachmentDraft[],
) {
  for (const entry of attachments) {
    if (entry.kind === "audio" && entry.previewUrl) {
      URL.revokeObjectURL(entry.previewUrl)
    }
  }
}

function hasDraggedFiles(event: DragEvent<HTMLElement>) {
  return Array.from(event.dataTransfer.types).includes("Files")
}
