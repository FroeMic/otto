export interface LandingPromptKeydownInput {
  ctrlKey: boolean
  isComposing: boolean
  key: string
  metaKey: boolean
  shiftKey: boolean
}

export function shouldSubmitLandingPromptFromKeydown(
  input: LandingPromptKeydownInput,
) {
  return (
    input.key === "Enter" &&
    !input.shiftKey &&
    !input.isComposing &&
    (input.metaKey || input.ctrlKey)
  )
}

export function mergeLandingPromptTranscript(
  currentPrompt: string,
  transcript: string,
) {
  const trimmedPrompt = currentPrompt.trim()
  const trimmedTranscript = transcript.trim()

  if (!trimmedTranscript) {
    return currentPrompt
  }

  if (!trimmedPrompt) {
    return trimmedTranscript
  }

  return `${trimmedPrompt}\n${trimmedTranscript}`
}
