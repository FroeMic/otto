"use client"

import { CheckIcon, XIcon } from "@phosphor-icons/react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useVoiceNoteRecorder } from "@/features/workspace-chat/hooks/useVoiceNoteRecorder"
import { formatVoiceNoteDuration } from "@/features/workspace-chat/voice-note"

export interface LandingVoiceRecorderProps {
  disabled?: boolean
  onCancel: () => void
  onTranscriptReady: (transcript: string) => void
}

export function LandingVoiceRecorder({
  disabled = false,
  onCancel,
  onTranscriptReady,
}: LandingVoiceRecorderProps) {
  const recorder = useVoiceNoteRecorder()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const hasAutoStartedRef = useRef(false)
  const shouldTranscribeOnStopRef = useRef(false)

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

    setErrorMessage(recorder.errorMessage)
  }, [recorder.errorMessage])

  useEffect(() => {
    if (!shouldTranscribeOnStopRef.current || recorder.status !== "recorded") {
      return
    }

    shouldTranscribeOnStopRef.current = false
    void transcribeDraft()
  }, [recorder.status, recorder.draft])

  if (!recorder.isSupported) {
    return null
  }

  const canConfirm =
    (recorder.status === "recording" ||
      recorder.status === "paused" ||
      recorder.status === "recorded") &&
    !isTranscribing

  async function transcribeDraft() {
    if (!recorder.draft) {
      return
    }

    setIsTranscribing(true)
    setErrorMessage(null)

    try {
      const file = new File([recorder.draft.blob], recorder.draft.fileName, {
        type: recorder.draft.mimeType,
      })
      const formData = new FormData()
      formData.set("file", file)

      const response = await fetch("/api/public/intake/transcribe", {
        body: formData,
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to transcribe recording.")
      }

      const payload = (await response.json()) as { transcript?: string }
      const transcript = payload.transcript?.trim() ?? ""

      if (!transcript) {
        throw new Error("The recording did not produce a transcript.")
      }

      recorder.clearDraft()
      onTranscriptReady(transcript)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to transcribe recording.",
      )
    } finally {
      setIsTranscribing(false)
    }
  }

  function handleConfirm() {
    if (!canConfirm || disabled) {
      return
    }

    if (recorder.status === "recording" || recorder.status === "paused") {
      shouldTranscribeOnStopRef.current = true
      recorder.stopRecording()
      return
    }

    void transcribeDraft()
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex h-10 w-full items-center gap-2">
        <select
          className="h-8 w-28 max-w-28 shrink-0 rounded-full border border-border/70 bg-muted/20 pl-3 pr-3 text-sm text-foreground"
          disabled={disabled || isTranscribing}
          onChange={(event) => {
            const nextDeviceId = event.target.value
            shouldTranscribeOnStopRef.current = false
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
              key={index}
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
          disabled={isTranscribing}
          onClick={() => {
            shouldTranscribeOnStopRef.current = false
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
          disabled={!canConfirm || disabled || isTranscribing}
          onClick={handleConfirm}
          size="sm"
          type="button"
        >
          <CheckIcon data-icon="inline-start" />
          {isTranscribing ? "Transcribing" : "OK"}
        </Button>
      </div>

      {errorMessage ? (
        <p className="px-2 text-sm text-destructive">{errorMessage}</p>
      ) : null}
    </div>
  )
}
