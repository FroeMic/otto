"use client"

import { Microphone } from "@phosphor-icons/react"
import { useEffect, useState } from "react"

import { capturePostHogBrowserEvent } from "@/client/posthog"
import { buttonVariants } from "@/shared/button-variants"
import { cn } from "@/shared/cn"

import { landingBenefitChips } from "../content/home"
import {
  mergeLandingPromptTranscript,
  shouldSubmitLandingPromptFromKeydown,
} from "../prompt-composer-input"
import { LandingVoiceRecorder } from "./LandingVoiceRecorder"

export interface LandingPromptComposerProps {
  className?: string
  examplesHeading?: string
  prompt?: string
  returnTo?: string
}

export function LandingPromptComposer({
  className,
  examplesHeading = "Why teams use Otto",
  prompt,
  returnTo = "/",
}: LandingPromptComposerProps) {
  return (
    <div
      data-examples-heading={examplesHeading}
      data-landing-prompt-composer=""
      data-prompt={prompt ?? ""}
      data-return-to={returnTo}
    >
      <LandingPromptComposerClient
        className={className}
        examplesHeading={examplesHeading}
        prompt={prompt}
        returnTo={returnTo}
      />
    </div>
  )
}

export function LandingPromptComposerClient({
  className,
  examplesHeading = "Why teams use Otto",
  prompt,
  returnTo = "/",
}: LandingPromptComposerProps) {
  const [currentPrompt, setCurrentPrompt] = useState(prompt ?? "")
  const [isRecordingVoiceNote, setIsRecordingVoiceNote] = useState(false)

  useEffect(() => {
    setCurrentPrompt(prompt ?? "")
  }, [prompt])

  return (
    <div
      className={cn("mx-auto flex w-full max-w-4xl flex-col gap-4", className)}
    >
      <form
        action="/waitlist"
        className="rounded-xl border border-border/70 bg-background p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)]"
        method="get"
        onSubmit={() => {
          capturePostHogBrowserEvent("landing_waitlist_started", {
            promptLength: currentPrompt.trim().length,
            returnTo,
          })
        }}
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
                event.currentTarget.form?.requestSubmit()
              }
            }}
            placeholder="What task do you want to automate?"
            value={currentPrompt}
          />

          <div className="flex justify-end border-t border-border/60 pt-3">
            <div className="flex w-full items-center justify-end gap-3">
              {isRecordingVoiceNote ? (
                <LandingVoiceRecorder
                  onCancel={() => {
                    setIsRecordingVoiceNote(false)
                  }}
                  onTranscriptReady={(transcript) => {
                    setCurrentPrompt((existingPrompt) =>
                      mergeLandingPromptTranscript(existingPrompt, transcript),
                    )
                    setIsRecordingVoiceNote(false)
                  }}
                />
              ) : (
                <>
                  <button
                    aria-label="Use voice input"
                    className={cn(
                      buttonVariants({ size: "default", variant: "outline" }),
                      "size-10 rounded-full border-border/70 bg-background p-0 text-foreground shadow-none hover:bg-muted/40",
                    )}
                    onClick={() => {
                      setIsRecordingVoiceNote(true)
                    }}
                    type="button"
                  >
                    <Microphone className="size-4" />
                  </button>

                  <button
                    className={cn(
                      buttonVariants({ size: "lg" }),
                      "shrink-0 rounded-full bg-foreground text-background shadow-none hover:bg-foreground/92",
                    )}
                    type="submit"
                  >
                    Join the Waitlist
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </form>

      <div className="flex flex-col gap-3 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          {examplesHeading}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {landingBenefitChips.map((chip) => (
            <span
              className="inline-flex rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs text-muted-foreground sm:text-sm"
              key={chip}
            >
              {chip}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
