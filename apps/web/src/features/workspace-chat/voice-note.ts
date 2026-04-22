export function normalizeVoiceNoteMimeType(mimeType: string) {
  const normalized = mimeType.trim().toLowerCase()

  if (normalized === "video/webm" || normalized.startsWith("video/webm;")) {
    return normalized.replace("video/webm", "audio/webm")
  }

  if (normalized === "video/mp4" || normalized.startsWith("video/mp4;")) {
    return normalized.replace("video/mp4", "audio/mp4")
  }

  return normalized || "audio/webm"
}

export function isTranscribableMediaMimeType(mimeType: string) {
  const normalized = mimeType.trim().toLowerCase()

  return normalized.startsWith("audio/") || normalized.startsWith("video/")
}

export function formatVoiceNoteDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

export function buildVoiceNoteFileName(mimeType: string) {
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-")
  const extension = resolveVoiceNoteExtension(mimeType)

  return `voice-note-${timestamp}${extension}`
}

function resolveVoiceNoteExtension(mimeType: string) {
  if (mimeType.includes("mp4")) {
    return ".m4a"
  }

  return ".webm"
}
