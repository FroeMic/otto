import { useEffect, useRef, useState } from "react"

import { buildVoiceNoteFileName, normalizeVoiceNoteMimeType } from "../voice-note"

const DEFAULT_BAR_COUNT = 32
const PREFERRED_AUDIO_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
] as const

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
  errorMessage: string | null
  isSupported: boolean
  levels: number[]
  selectedDeviceId: string
  setSelectedDeviceId: (deviceId: string) => void
  startRecording: () => Promise<void>
  status: "idle" | "recording" | "recorded"
  stopRecording: () => void
}

export function useVoiceNoteRecorder(): UseVoiceNoteRecorderResult {
  const [devices, setDevices] = useState<VoiceNoteRecorderDevice[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState("")
  const [status, setStatus] = useState<"idle" | "recording" | "recorded">(
    "idle",
  )
  const [draft, setDraft] = useState<VoiceNoteRecorderDraft | null>(null)
  const [levels, setLevels] = useState<number[]>(() =>
    Array.from({ length: DEFAULT_BAR_COUNT }, () => 0.08),
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)

  useEffect(() => {
    void loadDevices()

    return () => {
      stopMediaStream()
      clearAnimationFrame()

      if (audioContextRef.current) {
        void audioContextRef.current.close()
        audioContextRef.current = null
      }
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

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setErrorMessage("Voice notes are not supported in this browser.")
      return
    }

    clearDraft()
    setErrorMessage(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedDeviceId
          ? {
              deviceId: {
                exact: selectedDeviceId,
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
      startTimeRef.current = Date.now()

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.onstop = () => {
        const mimeType = normalizeVoiceNoteMimeType(
          recorder.mimeType || chunksRef.current[0]?.type || "audio/webm",
        )
        const durationMs = Math.max(1, Date.now() - startTimeRef.current)
        const blob = new Blob(chunksRef.current, {
          type: mimeType,
        })

        stopMediaStream()
        stopAnalyser()
        void loadDevices()

        setDraft({
          blob,
          durationMs,
          fileName: buildVoiceNoteFileName(mimeType),
          mimeType,
        })
        setLevels(Array.from({ length: DEFAULT_BAR_COUNT }, () => 0.08))
        setStatus("recorded")
      }

      await attachAnalyser(stream)
      recorder.start()
      setStatus("recording")
    } catch (error) {
      stopMediaStream()
      stopAnalyser()
      setStatus("idle")
      setErrorMessage(
        error instanceof Error ? error.message : "Could not start voice recording.",
      )
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && status === "recording") {
      mediaRecorderRef.current.stop()
    }
  }

  function clearDraft() {
    stopMediaStream()
    stopAnalyser()
    chunksRef.current = []
    setDraft(null)
    setLevels(Array.from({ length: DEFAULT_BAR_COUNT }, () => 0.08))
    setStatus("idle")
  }

  function stopMediaStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
  }

  function stopAnalyser() {
    clearAnimationFrame()

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

    analyser.fftSize = 128
    analyser.smoothingTimeConstant = 0.82
    source.connect(analyser)
    await audioContext.resume()

    const data = new Uint8Array(analyser.fftSize)

    audioContextRef.current = audioContext
    analyserRef.current = analyser

    const updateLevels = () => {
      if (!analyserRef.current) {
        return
      }

      analyserRef.current.getByteTimeDomainData(data)

      let sumSquares = 0

      for (const value of data) {
        const centered = (value - 128) / 128
        sumSquares += centered * centered
      }

      const rootMeanSquare = Math.sqrt(sumSquares / data.length)
      const nextLevel = Math.min(1, Math.max(0.08, rootMeanSquare * 6))

      setLevels((current) => [...current.slice(1), nextLevel])
      animationFrameRef.current = window.requestAnimationFrame(updateLevels)
    }

    animationFrameRef.current = window.requestAnimationFrame(updateLevels)
  }

  function clearAnimationFrame() {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }

  return {
    clearDraft,
    devices,
    draft,
    errorMessage,
    isSupported:
      typeof window !== "undefined" &&
      typeof MediaRecorder !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia),
    levels,
    selectedDeviceId,
    setSelectedDeviceId,
    startRecording,
    status,
    stopRecording,
  }
}

function resolveVoiceNoteMimeType() {
  for (const mimeType of PREFERRED_AUDIO_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType
    }
  }

  return "audio/webm"
}
