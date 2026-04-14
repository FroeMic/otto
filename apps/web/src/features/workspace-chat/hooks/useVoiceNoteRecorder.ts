import { useEffect, useRef, useState } from "react"

import { buildVoiceNoteFileName, normalizeVoiceNoteMimeType } from "../voice-note"

const DEFAULT_BAR_COUNT = 40
const PREFERRED_AUDIO_MIME_TYPES = [
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
] as const
const VOICE_NOTE_DEVICE_STORAGE_KEY = "workspace-chat.voice-recorder.device-id"

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
  const elapsedIntervalRef = useRef<number | null>(null)
  const statusRef = useRef<VoiceNoteRecorderStatus>("idle")
  const selectedDeviceIdRef = useRef("")

  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    selectedDeviceIdRef.current = selectedDeviceId
  }, [selectedDeviceId])

  useEffect(() => {
    void loadDevices()

    return () => {
      stopMediaStream()
      stopAnalyser()
      clearElapsedInterval()
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
    const remembered = readRememberedDeviceId()
    const current = selectedDeviceIdRef.current
    const preferred =
      (remembered &&
      audioInputs.some((device) => device.deviceId === remembered)
        ? remembered
        : null) ??
      (current &&
      audioInputs.some((device) => device.deviceId === current)
        ? current
        : null) ??
      ""

    setSelectedDeviceId(preferred)
    selectedDeviceIdRef.current = preferred
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

    const activeDeviceId = input?.deviceId ?? selectedDeviceId
    rememberDeviceId(activeDeviceId)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: activeDeviceId
          ? {
              deviceId: {
                exact: activeDeviceId,
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
        clearElapsedInterval()
        void loadDevices()

        setDraft({
          blob,
          durationMs,
          fileName: buildVoiceNoteFileName(mimeType),
          mimeType,
        })
        setElapsedMs(durationMs)
        setLevels(Array.from({ length: DEFAULT_BAR_COUNT }, () => 0.08))
        setRecorderStatus("recorded")
      }

      await attachAnalyser(stream)
      recorder.start(250)
      setRecorderStatus("recording")
      scheduleElapsedTick()
    } catch (error) {
      stopMediaStream()
      stopAnalyser()
      clearElapsedInterval()
      setRecorderStatus("idle")
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
    clearElapsedInterval()
    setRecorderStatus("paused")
  }

  async function resumeRecording() {
    if (!mediaRecorderRef.current || status !== "paused") {
      return
    }

    startedAtRef.current = Date.now()
    mediaRecorderRef.current.resume()
    setRecorderStatus("recording")
    scheduleElapsedTick()
  }

  function stopRecording() {
    if (!mediaRecorderRef.current || (status !== "recording" && status !== "paused")) {
      return
    }

    if (status === "recording") {
      accumulatedDurationMsRef.current += Date.now() - startedAtRef.current
    }

    clearElapsedInterval()
    mediaRecorderRef.current.stop()
  }

  function clearDraft() {
    stopMediaStream()
    stopAnalyser()
    clearElapsedInterval()
    chunksRef.current = []
    accumulatedDurationMsRef.current = 0
    setDraft(null)
    setElapsedMs(0)
    setLevels(Array.from({ length: DEFAULT_BAR_COUNT }, () => 0.08))
    setRecorderStatus("idle")
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
    clearElapsedInterval()
    setElapsedMs(
      accumulatedDurationMsRef.current + (Date.now() - startedAtRef.current),
    )
    elapsedIntervalRef.current = window.setInterval(() => {
      if (statusRef.current !== "recording") {
        return
      }

      setElapsedMs(
        accumulatedDurationMsRef.current + (Date.now() - startedAtRef.current),
      )
    }, 200)
  }

  function clearElapsedInterval() {
    if (elapsedIntervalRef.current !== null) {
      window.clearInterval(elapsedIntervalRef.current)
      elapsedIntervalRef.current = null
    }
  }

  function setRecorderStatus(next: VoiceNoteRecorderStatus) {
    statusRef.current = next
    setStatus(next)
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
    setSelectedDeviceId: setSelectedDevice,
    startRecording,
    status,
    stopRecording,
  }

  function setSelectedDevice(deviceId: string) {
    setSelectedDeviceId(deviceId)
    selectedDeviceIdRef.current = deviceId
    rememberDeviceId(deviceId)
  }
}

function rememberDeviceId(deviceId: string) {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.setItem(VOICE_NOTE_DEVICE_STORAGE_KEY, deviceId)
  } catch {
    // ignore storage errors
  }
}

function readRememberedDeviceId() {
  if (typeof window === "undefined") {
    return null
  }

  try {
    return window.localStorage.getItem(VOICE_NOTE_DEVICE_STORAGE_KEY)
  } catch {
    return null
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
