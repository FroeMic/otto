"use client"

import { StopIcon, XIcon } from "@phosphor-icons/react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { useVoiceNoteRecorder } from "../hooks/useVoiceNoteRecorder"

export interface ConversationVoiceNoteRecorderProps {
  disabled?: boolean
  onAttachVoiceNote: (input: {
    durationMs: number
    file: File
  }) => Promise<void>
  onCancel: () => void
}

export function ConversationVoiceNoteRecorder({
  disabled = false,
  onAttachVoiceNote,
  onCancel,
}: ConversationVoiceNoteRecorderProps) {
  const recorder = useVoiceNoteRecorder()
  const [isUploading, setIsUploading] = useState(false)
  const hasStartedRef = useRef(false)

  useEffect(() => {
    if (!recorder.isSupported || disabled || hasStartedRef.current) {
      return
    }

    hasStartedRef.current = true
    void recorder.startRecording()
  }, [disabled, recorder.isSupported])

  useEffect(() => {
    if (recorder.status !== "recorded" || !recorder.draft) {
      return
    }

    const draft = recorder.draft
    let isCancelled = false

    async function uploadDraft() {
      setIsUploading(true)

      try {
        await onAttachVoiceNote({
          durationMs: draft.durationMs,
          file: new File([draft.blob], draft.fileName, {
            type: draft.mimeType,
          }),
        })

        if (!isCancelled) {
          recorder.clearDraft()
          onCancel()
        }
      } catch (error) {
        if (!isCancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to attach voice note.",
          )
        }
      } finally {
        if (!isCancelled) {
          setIsUploading(false)
        }
      }
    }

    void uploadDraft()

    return () => {
      isCancelled = true
    }
  }, [onAttachVoiceNote, onCancel, recorder.draft, recorder.status])

  useEffect(() => {
    if (recorder.errorMessage) {
      toast.error(recorder.errorMessage)
      recorder.clearDraft()
      onCancel()
    }
  }, [onCancel, recorder.errorMessage])

  if (!recorder.isSupported) {
    return null
  }

  return (
    <div className="flex min-h-14 items-center gap-3 rounded-full border border-border/70 bg-muted/15 px-4 py-2">
      <div className="flex min-w-0 flex-1 items-center overflow-hidden">
        <div className="flex h-8 w-full items-center gap-1 overflow-hidden">
          {recorder.levels.map((level, index) => (
            <span
              aria-hidden
              className={cn(
                "block w-1 shrink-0 rounded-full bg-foreground/70 transition-[height,opacity] duration-75",
                recorder.status === "recording" ? "opacity-100" : "opacity-35",
              )}
              key={index}
              style={{
                height: `${Math.max(10, Math.round(level * 30))}px`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          disabled={isUploading}
          onClick={() => {
            recorder.clearDraft()
            onCancel()
          }}
          size="icon"
          type="button"
          variant="ghost"
        >
          <XIcon />
        </Button>
        <Button
          disabled={disabled || isUploading || recorder.status !== "recording"}
          onClick={() => {
            recorder.stopRecording()
          }}
          size="icon"
          type="button"
          variant="ghost"
        >
          <StopIcon weight="fill" />
        </Button>
      </div>
    </div>
  )
}
