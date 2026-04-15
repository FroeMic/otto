"use client"

import { Microphone, SpinnerGap } from "@phosphor-icons/react"
import { useEffect, useMemo, useRef, useState } from "react"

import { buttonVariants } from "@/shared/button-variants"
import { cn } from "@/shared/cn"

import { landingExamplePrompts } from "../content/home"
import {
  mergeLandingPromptTranscript,
  shouldSubmitLandingPromptFromKeydown,
} from "../prompt-composer-input"

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

interface SpeechRecognitionAlternativeLike {
  transcript: string
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike
  isFinal: boolean
  length: number
}

interface SpeechRecognitionEventLike {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}

interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  onend: (() => void) | null
  onerror: (() => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  start: () => void
  stop: () => void
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike
}

export interface LandingPromptComposerProps {
  className?: string
  examplesHeading?: string
  prompt?: string
  returnTo?: string
}

export function LandingPromptComposer({
  className,
  examplesHeading = "Try one of these",
  prompt,
  returnTo = "/",
}: LandingPromptComposerProps) {
  const formRef = useRef<HTMLFormElement | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const [currentPrompt, setCurrentPrompt] = useState(prompt ?? "")
  const [isListening, setIsListening] = useState(false)
  const [voiceUnavailable, setVoiceUnavailable] = useState(false)

  useEffect(() => {
    setCurrentPrompt(prompt ?? "")
  }, [prompt])

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  const recognitionConstructor = useMemo(() => {
    if (typeof window === "undefined") {
      return null
    }

    return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
  }, [])

  const canUseVoiceInput = recognitionConstructor !== null

  function ensureRecognition() {
    if (!recognitionConstructor) {
      return null
    }

    if (!recognitionRef.current) {
      const recognition = new recognitionConstructor()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = "en-US"
      recognition.onend = () => {
        setIsListening(false)
      }
      recognition.onerror = () => {
        setIsListening(false)
        setVoiceUnavailable(true)
      }
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .slice(event.resultIndex)
          .map((result) => result[0]?.transcript ?? "")
          .join(" ")

        setCurrentPrompt((existingPrompt) =>
          mergeLandingPromptTranscript(existingPrompt, transcript),
        )
      }
      recognitionRef.current = recognition
    }

    return recognitionRef.current
  }

  function handleToggleVoiceInput() {
    if (voiceUnavailable) {
      return
    }

    const recognition = ensureRecognition()

    if (!recognition) {
      setVoiceUnavailable(true)
      return
    }

    if (isListening) {
      recognition.stop()
      setIsListening(false)
      return
    }

    recognition.start()
    setIsListening(true)
  }

  return (
    <div
      className={cn("mx-auto flex w-full max-w-4xl flex-col gap-4", className)}
    >
      <form
        action="/api/public/intake"
        className="rounded-xl border border-border/70 bg-background p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)]"
        method="post"
        ref={formRef}
      >
        <input name="returnTo" type="hidden" value={returnTo} />
        <div className="flex flex-col gap-4">
          <textarea
            className="min-h-[148px] w-full resize-none border-0 bg-transparent px-2 py-2 text-base leading-7 text-foreground outline-none placeholder:text-muted-foreground/85"
            name="prompt"
            onChange={(event) => {
              setCurrentPrompt(event.target.value)
            }}
            onKeyDown={(event) => {
              if (
                shouldSubmitLandingPromptFromKeydown({
                  ctrlKey: event.ctrlKey,
                  isComposing: event.nativeEvent.isComposing,
                  key: event.key,
                  metaKey: event.metaKey,
                  shiftKey: event.shiftKey,
                })
              ) {
                event.preventDefault()
                formRef.current?.requestSubmit()
              }
            }}
            placeholder="Describe the software business you want to launch or run..."
            value={currentPrompt}
          />

          <div className="flex flex-col gap-3 border-t border-border/60 pt-3 md:flex-row md:items-center md:justify-between">
            <p className="max-w-2xl text-sm text-muted-foreground">
              Describe the business you are trying to run. Otto will qualify the
              next step. Press Cmd+Enter to submit.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                aria-label="Use voice input"
                className={cn(
                  buttonVariants({ size: "default", variant: "outline" }),
                  "size-10 rounded-full border-border/70 bg-background p-0 text-foreground shadow-none hover:bg-muted/40",
                )}
                disabled={!canUseVoiceInput || voiceUnavailable}
                onClick={handleToggleVoiceInput}
                type="button"
              >
                {isListening ? (
                  <SpinnerGap className="size-4 animate-spin" />
                ) : (
                  <Microphone className="size-4" />
                )}
              </button>

              <button
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "shrink-0 rounded-full bg-foreground text-background shadow-none hover:bg-foreground/92",
                )}
                type="submit"
              >
                Get started
              </button>
            </div>
          </div>
        </div>
      </form>

      <div className="flex flex-col gap-3 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          {examplesHeading}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {landingExamplePrompts.map((examplePrompt) => (
            <a
              className="inline-flex rounded-full border border-border/70 bg-background px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
              href={`/?prompt=${encodeURIComponent(examplePrompt)}#start`}
              key={examplePrompt}
            >
              {examplePrompt}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
