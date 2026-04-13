"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"
import { cn } from "@/lib/utils"

import { useVoiceNoteRecorder } from "../hooks/useVoiceNoteRecorder"

export interface ConversationVoiceNoteRecorderProps {
  disabled?: boolean
  onAttachVoiceNote: (input: {
    durationMs: number
    file: File
  }) => Promise<void>
}

export function ConversationVoiceNoteRecorder({
  disabled = false,
  onAttachVoiceNote,
}: ConversationVoiceNoteRecorderProps) {
  const recorder = useVoiceNoteRecorder()
  const [isUploading, setIsUploading] = useState(false)

  async function attachDraft() {
    if (!recorder.draft) {
      return
    }

    setIsUploading(true)

    try {
      await onAttachVoiceNote({
        durationMs: recorder.draft.durationMs,
        file: new File([recorder.draft.blob], recorder.draft.fileName, {
          type: recorder.draft.mimeType,
        }),
      })
      recorder.clearDraft()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to attach voice note.",
      )
    } finally {
      setIsUploading(false)
    }
  }

  if (!recorder.isSupported) {
    return null
  }

  return (
    <div className="rounded-[1.6rem] border border-border/70 bg-muted/20 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          className="min-w-44"
          disabled={disabled || isUploading || recorder.status === "recording"}
          onChange={(event) => {
            recorder.setSelectedDeviceId(event.target.value)
          }}
          value={recorder.selectedDeviceId}
        >
          {recorder.devices.length === 0 ? (
            <NativeSelectOption value="">Microphone</NativeSelectOption>
          ) : null}
          {recorder.devices.map((device) => (
            <NativeSelectOption
              key={device.deviceId}
              value={device.deviceId}
            >
              {device.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>

        <div className="flex min-h-10 min-w-0 flex-1 items-center overflow-hidden rounded-full bg-background/75 px-3">
          <div className="flex h-8 w-full items-center gap-1">
            {recorder.levels.map((level, index) => (
              <span
                aria-hidden
                className={cn(
                  "block w-1 rounded-full bg-foreground/60 transition-[height,opacity] duration-100",
                  recorder.status === "idle" ? "opacity-25" : "opacity-100",
                )}
                key={index}
                style={{
                  height: `${Math.max(10, Math.round(level * 28))}px`,
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {recorder.status === "idle" ? (
            <Button
              disabled={disabled}
              onClick={() => {
                void recorder.startRecording()
              }}
              type="button"
              variant="ghost"
            >
              Record
            </Button>
          ) : null}

          {recorder.status === "recording" ? (
            <Button
              disabled={disabled}
              onClick={() => {
                recorder.stopRecording()
              }}
              type="button"
              variant="ghost"
            >
              Stop
            </Button>
          ) : null}

          {recorder.status === "recorded" ? (
            <>
              <span className="text-xs text-muted-foreground">
                {formatVoiceNoteDuration(recorder.draft?.durationMs ?? 0)}
              </span>
              <Button
                disabled={disabled || isUploading}
                onClick={() => {
                  recorder.clearDraft()
                }}
                type="button"
                variant="ghost"
              >
                Discard
              </Button>
              <Button
                disabled={disabled || isUploading}
                onClick={() => void attachDraft()}
                type="button"
              >
                Add
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {recorder.errorMessage ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {recorder.errorMessage}
        </p>
      ) : null}
    </div>
  )
}

function formatVoiceNoteDuration(durationMs: number) {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${String(seconds).padStart(2, "0")}`
}
