import {
  FileIcon,
  MicrophoneIcon,
  PaperPlaneTiltIcon,
  PaperclipIcon,
  WaveformIcon,
  XIcon,
} from "@phosphor-icons/react"
import type { WorkspaceChatAttachment } from "@otto/feature-workspace-chat"
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
} from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
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
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useLayoutEffect(() => {
    const textarea = textareaRef.current

    if (!textarea) {
      return
    }

    textarea.style.height = "0px"
    textarea.style.height = `${Math.min(textarea.scrollHeight, 240)}px`
  }, [draft])

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

    if (parts.length === 0 || disabled) {
      return
    }

    await onSubmit({ parts })
    setAttachments([])
    setDraft("")
  }

  async function attachVoiceNote(input: {
    durationMs: number
    file: File
  }) {
    if (!onUploadAttachment) {
      return
    }

    setIsUploading(true)

    try {
      const attachment = await onUploadAttachment(input.file)
      setAttachments((current) => [
        ...current,
        {
          attachment,
          durationMs: input.durationMs,
          kind: "audio",
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
        error instanceof Error
          ? error.message
          : "Failed to upload attachment.",
      )
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    if (!onUploadAttachment || isVoiceMode) {
      return
    }

    if (!hasDraggedFiles(event)) {
      return
    }

    event.preventDefault()
    setDragDepth((current) => current + 1)
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (!onUploadAttachment || isVoiceMode || !hasDraggedFiles(event)) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = "copy"
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    if (!onUploadAttachment || isVoiceMode || !hasDraggedFiles(event)) {
      return
    }

    event.preventDefault()
    setDragDepth((current) => Math.max(0, current - 1))
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    if (!onUploadAttachment || isVoiceMode || !hasDraggedFiles(event)) {
      return
    }

    event.preventDefault()
    resetDragState()
    void uploadFiles(extractWorkspaceChatDropFiles(event.dataTransfer))
  }

  return (
    <div
      className={cn(
        "relative rounded-[2rem] border border-border/70 bg-background/96 px-5 py-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)] backdrop-blur-xl transition-colors",
        dragDepth > 0 && "border-primary/55 bg-primary/[0.03]",
        className,
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {dragDepth > 0 ? (
        <div className="pointer-events-none absolute inset-3 z-10 rounded-[1.6rem] border border-dashed border-primary/50 bg-primary/[0.05]">
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
              <button
                className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground/80 transition hover:text-foreground"
                disabled={disabled || isUploading}
                onClick={() => {
                  setAttachments((current) =>
                    current.filter(
                      (entry) => entry.attachment.id !== attachment.attachment.id,
                    ),
                  )
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
        className="max-h-60 min-h-[5.5rem] resize-none overflow-y-auto border-0 bg-transparent px-0 py-1 text-base leading-8 shadow-none focus-visible:ring-0 md:text-[15px]"
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

      <div className="mt-3 border-t border-border/55 pt-3">
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
                <Button
                  className="size-10 rounded-full text-muted-foreground"
                  disabled={disabled || isUploading || !onUploadAttachment}
                  onClick={() => {
                    fileInputRef.current?.click()
                  }}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <PaperclipIcon />
                </Button>
                <Button
                  className="size-10 rounded-full text-muted-foreground"
                  disabled={disabled || isUploading || !onUploadAttachment}
                  onClick={() => {
                    setIsVoiceMode(true)
                  }}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <MicrophoneIcon />
                </Button>
              </div>

              <Button
                className="rounded-full bg-primary px-5 text-primary-foreground shadow-none hover:bg-primary/90"
                disabled={
                  disabled ||
                  isUploading ||
                  (draft.trim().length === 0 && attachments.length === 0)
                }
                onClick={() => void submitDraft()}
              >
                <PaperPlaneTiltIcon data-icon="inline-start" />
                Send
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function hasDraggedFiles(event: DragEvent<HTMLDivElement>) {
  return Array.from(event.dataTransfer.types).includes("Files")
}
