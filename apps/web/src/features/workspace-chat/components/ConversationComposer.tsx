import {
  FileIcon,
  PaperPlaneTiltIcon,
  PaperclipIcon,
  XIcon,
} from "@phosphor-icons/react"
import type { WorkspaceChatAttachment } from "@otto/feature-workspace-chat"
import { useLayoutEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export interface ConversationComposerProps {
  className?: string
  disabled?: boolean
  onSubmit: (input: {
    attachments: WorkspaceChatAttachment[]
    text: string
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
  const [attachments, setAttachments] = useState<WorkspaceChatAttachment[]>([])
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
    const nextDraft = draft.trim()

    if ((nextDraft.length === 0 && attachments.length === 0) || disabled) {
      return
    }

    await onSubmit({
      attachments,
      text: nextDraft,
    })
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
              key={attachment.id}
              className="flex items-center gap-2 rounded-full border border-border/80 bg-muted/45 px-3 py-1 text-xs text-muted-foreground"
            >
              <FileIcon className="size-3.5 shrink-0" />
              <span className="max-w-44 truncate">{attachment.fileName}</span>
              <button
                className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground/80 transition hover:text-foreground"
                disabled={disabled || isUploading}
                onClick={() => {
                  setAttachments((current) =>
                    current.filter((entry) => entry.id !== attachment.id),
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
              setAttachments((current) => [...current, ...uploaded])
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
