import {
  FileIcon,
  PaperPlaneTiltIcon,
  PaperclipIcon,
  WaveformIcon,
  XIcon,
} from "@phosphor-icons/react"
import type { WorkspaceChatAttachment } from "@otto/feature-workspace-chat"
import { useLayoutEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import {
  buildWorkspaceChatComposerParts,
  type WorkspaceChatComposerAttachmentDraft,
} from "../composer-parts"
import { ConversationVoiceNoteRecorder } from "./ConversationVoiceNoteRecorder"

export interface ConversationComposerProps {
  className?: string
  disabled?: boolean
  onSubmit: (input: {
    parts: ReturnType<typeof buildWorkspaceChatComposerParts>
  }) => Promise<void> | void
  onUploadAttachment?: (file: File) => Promise<WorkspaceChatAttachment>
  placeholder?: string
}

export function ConversationComposer({
  className,
  disabled = false,
  onSubmit,
  onUploadAttachment,
  placeholder = "Message Otto in this workspace conversation",
}: ConversationComposerProps) {
  const [draft, setDraft] = useState("")
  const [attachments, setAttachments] = useState<
    WorkspaceChatComposerAttachmentDraft[]
  >([])
  const [isUploading, setIsUploading] = useState(false)
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

  return (
    <div
      className={cn(
        "rounded-[2rem] border border-border/70 bg-background/96 px-5 py-4 backdrop-blur-xl",
        className,
      )}
    >
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

      <div className="mb-3">
        <ConversationVoiceNoteRecorder
          disabled={disabled || isUploading}
          onAttachVoiceNote={async (input) => {
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
          }}
        />
      </div>

      <Textarea
        className="max-h-60 min-h-[5.5rem] resize-none overflow-y-auto border-0 bg-transparent px-0 py-1 pr-28 text-base leading-8 shadow-none focus-visible:ring-0 md:text-[15px]"
        disabled={disabled || isUploading}
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

      <input
        className="hidden"
        multiple
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])

          if (files.length === 0 || !onUploadAttachment) {
            return
          }

          setIsUploading(true)

          void Promise.all(files.map((file) => onUploadAttachment(file)))
            .then((uploaded) => {
              setAttachments((current) => [
                ...current,
                ...uploaded.map((attachment) => ({
                  attachment,
                  kind: "file" as const,
                })),
              ])
            })
            .catch((error) => {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Failed to upload attachment.",
              )
            })
            .finally(() => {
              setIsUploading(false)
              if (fileInputRef.current) {
                fileInputRef.current.value = ""
              }
            })
        }}
        ref={fileInputRef}
        type="file"
      />

      <div className="mt-3 flex items-center justify-end gap-3">
        <Button
          className="size-11 rounded-full"
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
          className="rounded-full px-4"
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
    </div>
  )
}

function formatVoiceNoteDuration(durationMs: number) {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${String(seconds).padStart(2, "0")}`
}
