"use client"

import {
  ArrowCounterClockwiseIcon,
  CheckIcon,
  DiscIcon,
  PauseIcon,
  PlayIcon,
  StopIcon,
  XIcon,
} from "@phosphor-icons/react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { formatVoiceNoteDuration } from "../voice-note"
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
  const previewUrl = useMemo(
    () => (recorder.draft ? URL.createObjectURL(recorder.draft.blob) : null),
    [recorder.draft],
  )

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  useEffect(() => {
    if (!recorder.errorMessage) {
      return
    }

    toast.error(recorder.errorMessage)
  }, [recorder.errorMessage])

  if (!recorder.isSupported) {
    return null
  }

  const canAttach = recorder.status === "recorded" && recorder.draft && !isUploading

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
      onCancel()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to attach voice note.",
      )
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/15 px-3 py-3">
      <div className="flex items-center gap-2">
        <select
          className="h-9 min-w-0 flex-1 rounded-full border border-border/70 bg-background px-3 text-sm text-foreground"
          disabled={
            disabled ||
            isUploading ||
            recorder.status === "recording" ||
            recorder.status === "paused"
          }
          onChange={(event) => {
            recorder.setSelectedDeviceId(event.target.value)
          }}
          value={recorder.selectedDeviceId}
        >
          {recorder.devices.length === 0 ? (
            <option value="">Default microphone</option>
          ) : (
            recorder.devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))
          )}
        </select>
        <span className="min-w-14 text-right text-xs text-muted-foreground">
          {formatVoiceNoteDuration(recorder.elapsedMs)}
        </span>
      </div>

      <div className="flex min-h-10 items-center gap-1 overflow-hidden rounded-full border border-border/70 bg-background px-3 py-1">
        {recorder.levels.map((level, index) => (
          <span
            aria-hidden
            className={cn(
              "block w-1 shrink-0 rounded-full bg-foreground/80 transition-[height,opacity] duration-75",
              recorder.status === "recording" ? "opacity-100" : "opacity-45",
            )}
            key={index}
            style={{
              height: `${Math.max(8, Math.round(level * 22))}px`,
            }}
          />
        ))}
      </div>

      {recorder.status === "recorded" && previewUrl ? (
        <audio className="h-9 w-full" controls preload="metadata" src={previewUrl} />
      ) : null}

      <div className="flex items-center justify-between gap-2">
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

          {recorder.status === "recording" ? (
            <>
              <Button
                disabled={disabled || isUploading}
                onClick={() => {
                  recorder.pauseRecording()
                }}
                size="icon"
                type="button"
                variant="ghost"
              >
                <PauseIcon weight="fill" />
              </Button>
              <Button
                disabled={disabled || isUploading}
                onClick={() => {
                  recorder.stopRecording()
                }}
                size="icon"
                type="button"
                variant="ghost"
              >
                <StopIcon weight="fill" />
              </Button>
            </>
          ) : null}

          {recorder.status === "paused" ? (
            <>
              <Button
                disabled={disabled || isUploading}
                onClick={() => {
                  void recorder.resumeRecording()
                }}
                size="icon"
                type="button"
                variant="ghost"
              >
                <PlayIcon weight="fill" />
              </Button>
              <Button
                disabled={disabled || isUploading}
                onClick={() => {
                  recorder.stopRecording()
                }}
                size="icon"
                type="button"
                variant="ghost"
              >
                <StopIcon weight="fill" />
              </Button>
            </>
          ) : null}

          {recorder.status === "recorded" ? (
            <Button
              disabled={disabled || isUploading}
              onClick={() => {
                void recorder.startRecording()
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              <ArrowCounterClockwiseIcon data-icon="inline-start" />
              Record again
            </Button>
          ) : null}

          {recorder.status === "idle" ? (
            <Button
              disabled={disabled || isUploading}
              onClick={() => {
                void recorder.startRecording()
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              <DiscIcon data-icon="inline-start" />
              Start recording
            </Button>
          ) : null}
        </div>

        <Button
          disabled={!canAttach || disabled}
          onClick={() => {
            void attachDraft()
          }}
          size="sm"
          type="button"
        >
          <CheckIcon data-icon="inline-start" />
          Use voice note
        </Button>
      </div>
    </div>
  )
}
