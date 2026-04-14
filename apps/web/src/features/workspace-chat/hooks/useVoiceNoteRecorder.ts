import { useEffect, useRef, useState } from "react"

import { buildVoiceNoteFileName, normalizeVoiceNoteMimeType } from "../voice-note"

const DEFAULT_BAR_COUNT = 40
const PREFERRED_AUDIO_MIME_TYPES = [
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
] as const

type VoiceNoteRecorderStatus = "idle" | "recording" | "paused" | "recorded"

export interface VoiceNoteRecorderDraft {
  blob: Blob
  durationMs: number
  fileName: string
  mimeType: string
}

export interface VoiceNoteRecorderDevice {
  deviceId: string
  label: string
}

export interface UseVoiceNoteRecorderResult {
  clearDraft: () => void
  devices: VoiceNoteRecorderDevice[]
  draft: VoiceNoteRecorderDraft | null
  elapsedMs: number
  errorMessage: string | null
  isSupported: boolean
  levels: number[]
  pauseRecording: () => void
  resumeRecording: () => Promise<void>
  selectedDeviceId: string
  setSelectedDeviceId: (deviceId: string) => void
  startRecording: (input?: { deviceId?: string }) => Promise<void>
  status: VoiceNoteRecorderStatus
  stopRecording: () => void
}

export function useVoiceNoteRecorder(): UseVoiceNoteRecorderResult {
  const [devices, setDevices] = useState<VoiceNoteRecorderDevice[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState("")
  const [status, setStatus] = useState<VoiceNoteRecorderStatus>("idle")
  const [draft, setDraft] = useState<VoiceNoteRecorderDraft | null>(null)
  const [levels, setLevels] = useState<number[]>(() =>
    Array.from({ length: DEFAULT_BAR_COUNT }, () => 0.08),
  )
  const [elapsedMs, setElapsedMs] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const startedAtRef = useRef<number>(0)
  const accumulatedDurationMsRef = useRef(0)
  const elapsedAnimationFrameRef = useRef<number | null>(null)
  const statusRef = useRef<VoiceNoteRecorderStatus>("idle")

  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    void loadDevices()

    return () => {
      stopMediaStream()
      stopAnalyser()
      clearElapsedAnimationFrame()
    }
  }, [])

  async function loadDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return
    }

    const entries = await navigator.mediaDevices.enumerateDevices()
    const audioInputs = entries
      .filter((device) => device.kind === "audioinput")
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Microphone ${index + 1}`,
      }))

    setDevices(audioInputs)
    setSelectedDeviceId((current) => {
      if (current && audioInputs.some((device) => device.deviceId === current)) {
        return current
      }

      return audioInputs[0]?.deviceId ?? ""
    })
  }

  async function startRecording(input?: { deviceId?: string }) {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setErrorMessage("Voice notes are not supported in this browser.")
      return
    }

    clearDraft()
    setErrorMessage(null)
    accumulatedDurationMsRef.current = 0
    setElapsedMs(0)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: (input?.deviceId ?? selectedDeviceId)
          ? {
              deviceId: {
                exact: input?.deviceId ?? selectedDeviceId,
              },
            }
          : true,
      })

      streamRef.current = stream
      chunksRef.current = []

      const recorder = new MediaRecorder(stream, {
        mimeType: resolveVoiceNoteMimeType(),
      })
      mediaRecorderRef.current = recorder
      startedAtRef.current = Date.now()

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.onstop = () => {
        const mimeType = normalizeVoiceNoteMimeType(
          recorder.mimeType || chunksRef.current[0]?.type || "audio/webm",
        )
        const durationMs = Math.max(1, accumulatedDurationMsRef.current)
        const blob = new Blob(chunksRef.current, {
          type: mimeType,
        })

        stopMediaStream()
        stopAnalyser()
        clearElapsedAnimationFrame()
        void loadDevices()

        setDraft({
          blob,
          durationMs,
          fileName: buildVoiceNoteFileName(mimeType),
          mimeType,
        })
        setElapsedMs(durationMs)
        setLevels(Array.from({ length: DEFAULT_BAR_COUNT }, () => 0.08))
        setStatus("recorded")
      }

      await attachAnalyser(stream)
      recorder.start(250)
      setStatus("recording")
      scheduleElapsedTick()
    } catch (error) {
      stopMediaStream()
      stopAnalyser()
      clearElapsedAnimationFrame()
      setStatus("idle")
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not start voice recording.",
      )
    }
  }

  function pauseRecording() {
    if (!mediaRecorderRef.current || status !== "recording") {
      return
    }

    mediaRecorderRef.current.pause()
    accumulatedDurationMsRef.current += Date.now() - startedAtRef.current
    setElapsedMs(accumulatedDurationMsRef.current)
    clearElapsedAnimationFrame()
    setStatus("paused")
  }

  async function resumeRecording() {
    if (!mediaRecorderRef.current || status !== "paused") {
      return
    }

    startedAtRef.current = Date.now()
    mediaRecorderRef.current.resume()
    setStatus("recording")
    scheduleElapsedTick()
  }

  function stopRecording() {
    if (!mediaRecorderRef.current || (status !== "recording" && status !== "paused")) {
      return
    }

    if (status === "recording") {
      accumulatedDurationMsRef.current += Date.now() - startedAtRef.current
    }

    clearElapsedAnimationFrame()
    mediaRecorderRef.current.stop()
  }

  function clearDraft() {
    stopMediaStream()
    stopAnalyser()
    clearElapsedAnimationFrame()
    chunksRef.current = []
    accumulatedDurationMsRef.current = 0
    setDraft(null)
    setElapsedMs(0)
    setLevels(Array.from({ length: DEFAULT_BAR_COUNT }, () => 0.08))
    setStatus("idle")
  }

  function stopMediaStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
  }

  function stopAnalyser() {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    if (audioContextRef.current) {
      void audioContextRef.current.close()
      audioContextRef.current = null
    }

    analyserRef.current = null
  }

  async function attachAnalyser(stream: MediaStream) {
    const audioContext = new AudioContext()
    const analyser = audioContext.createAnalyser()
    const source = audioContext.createMediaStreamSource(stream)

    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.8
    source.connect(analyser)
    await audioContext.resume()

    const data = new Uint8Array(analyser.frequencyBinCount)

    audioContextRef.current = audioContext
    analyserRef.current = analyser

    const updateLevels = () => {
      if (!analyserRef.current) {
        return
      }

      analyserRef.current.getByteFrequencyData(data)
      const nextLevels = Array.from({ length: DEFAULT_BAR_COUNT }, (_, index) => {
        const start = Math.floor((index * data.length) / DEFAULT_BAR_COUNT)
        const end = Math.max(
          start + 1,
          Math.floor(((index + 1) * data.length) / DEFAULT_BAR_COUNT),
        )

        let sum = 0
        for (let cursor = start; cursor < end; cursor += 1) {
          sum += data[cursor]
        }

        const avg = sum / Math.max(1, end - start)
        return Math.min(1, Math.max(0.08, (avg / 255) * 2.6))
      })

      setLevels(nextLevels)
      animationFrameRef.current = window.requestAnimationFrame(updateLevels)
    }

    animationFrameRef.current = window.requestAnimationFrame(updateLevels)
  }

  function scheduleElapsedTick() {
    clearElapsedAnimationFrame()

    const tick = () => {
      if (statusRef.current !== "recording") {
        return
      }

      setElapsedMs(
        accumulatedDurationMsRef.current + (Date.now() - startedAtRef.current),
      )
      elapsedAnimationFrameRef.current = window.requestAnimationFrame(tick)
    }

    elapsedAnimationFrameRef.current = window.requestAnimationFrame(tick)
  }

  function clearElapsedAnimationFrame() {
    if (elapsedAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(elapsedAnimationFrameRef.current)
      elapsedAnimationFrameRef.current = null
    }
  }

  return {
    clearDraft,
    devices,
    draft,
    elapsedMs,
    errorMessage,
    isSupported:
      typeof window !== "undefined" &&
      typeof MediaRecorder !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia),
    levels,
    pauseRecording,
    resumeRecording,
    selectedDeviceId,
    setSelectedDeviceId,
    startRecording,
    status,
    stopRecording,
  }
}

function resolveVoiceNoteMimeType() {
  const audioElement =
    typeof document !== "undefined" ? document.createElement("audio") : null

  for (const mimeType of PREFERRED_AUDIO_MIME_TYPES) {
    const isRecordable = MediaRecorder.isTypeSupported(mimeType)
    const isPlayable =
      audioElement?.canPlayType(mimeType).toLowerCase() === "probably" ||
      audioElement?.canPlayType(mimeType).toLowerCase() === "maybe"

    if (isRecordable && isPlayable) {
      return mimeType
    }
  }

  for (const mimeType of PREFERRED_AUDIO_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType
    }
  }

  return "audio/webm"
}
