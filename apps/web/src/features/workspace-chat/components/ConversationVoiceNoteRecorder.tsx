"use client"

import { CheckIcon, XIcon } from "@phosphor-icons/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useVoiceNoteRecorder } from "../hooks/useVoiceNoteRecorder"
import { formatVoiceNoteDuration } from "../voice-note"

export interface ConversationVoiceNoteRecorderProps {
  disabled?: boolean
  onAttachVoiceNote: (input: {
    durationMs: number
    file: File
  }) => Promise<void>
  onCancel: () => void
}

const VOICE_LEVEL_BAR_KEYS = Array.from(
  { length: 40 },
  (_, index) => `voice-level-${index}`,
)

export function ConversationVoiceNoteRecorder({
  disabled = false,
  onAttachVoiceNote,
  onCancel,
}: ConversationVoiceNoteRecorderProps) {
  const recorder = useVoiceNoteRecorder()
  const [isUploading, setIsUploading] = useState(false)
  const hasAutoStartedRef = useRef(false)
  const recorderRef = useRef(recorder)
  const shouldAttachOnStopRef = useRef(false)
  recorderRef.current = recorder

  const attachDraft = useCallback(async () => {
    const currentRecorder = recorderRef.current

    if (!currentRecorder.draft) {
      return
    }

    setIsUploading(true)

    try {
      await onAttachVoiceNote({
        durationMs: currentRecorder.draft.durationMs,
        file: new File(
          [currentRecorder.draft.blob],
          currentRecorder.draft.fileName,
          {
            type: currentRecorder.draft.mimeType,
          },
        ),
      })

      currentRecorder.clearDraft()
      onCancel()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to attach voice note.",
      )
    } finally {
      setIsUploading(false)
    }
  }, [onAttachVoiceNote, onCancel])

  useEffect(() => {
    if (
      disabled ||
      !recorder.isSupported ||
      recorder.status !== "idle" ||
      hasAutoStartedRef.current
    ) {
      return
    }

    hasAutoStartedRef.current = true
    void recorder.startRecording()
  }, [disabled, recorder])

  useEffect(() => {
    if (!recorder.errorMessage) {
      return
    }

    toast.error(recorder.errorMessage)
  }, [recorder.errorMessage])

  useEffect(() => {
    if (!shouldAttachOnStopRef.current || recorder.status !== "recorded") {
      return
    }

    shouldAttachOnStopRef.current = false
    void attachDraft()
  }, [recorder.status, attachDraft])

  if (!recorder.isSupported) {
    return null
  }

  const canAttach =
    (recorder.status === "recording" ||
      recorder.status === "paused" ||
      recorder.status === "recorded") &&
    !isUploading

  function handleSend() {
    if (!canAttach || disabled) {
      return
    }

    if (recorder.status === "recording" || recorder.status === "paused") {
      shouldAttachOnStopRef.current = true
      recorder.stopRecording()
      return
    }

    void attachDraft()
  }

  return (
    <div className="flex h-10 w-full items-center gap-2">
      <select
        className="h-8 w-28 max-w-28 shrink-0 rounded-full border border-border/70 bg-muted/20 pl-3 pr-3 text-sm text-foreground"
        disabled={disabled || isUploading}
        onChange={(event) => {
          const nextDeviceId = event.target.value
          shouldAttachOnStopRef.current = false
          recorder.clearDraft()
          recorder.setSelectedDeviceId(nextDeviceId)
          if (recorder.status !== "recorded") {
            void recorder.startRecording({
              deviceId: nextDeviceId,
            })
          }
        }}
        value={recorder.selectedDeviceId}
      >
        <option value="">System default microphone</option>
        {recorder.devices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label}
          </option>
        ))}
      </select>

      <div className="mr-1 flex h-8 min-w-0 flex-1 items-end gap-1 overflow-hidden rounded-full px-2 py-1">
        {recorder.levels.map((level, index) => (
          <span
            aria-hidden
            className={cn(
              "block w-1 shrink-0 self-end rounded-full bg-foreground/80 transition-[height,opacity] duration-75",
              recorder.status === "recording" ? "opacity-100" : "opacity-35",
            )}
            key={VOICE_LEVEL_BAR_KEYS[index]}
            style={{
              height: `${Math.max(8, Math.round(level * 20))}px`,
            }}
          />
        ))}
      </div>

      <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
        {formatVoiceNoteDuration(recorder.elapsedMs)}
      </span>

      <Button
        disabled={isUploading}
        onClick={() => {
          shouldAttachOnStopRef.current = false
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
        disabled={!canAttach || disabled || isUploading}
        onClick={handleSend}
        size="sm"
        type="button"
      >
        <CheckIcon data-icon="inline-start" />
        Send
      </Button>
    </div>
  )
}
