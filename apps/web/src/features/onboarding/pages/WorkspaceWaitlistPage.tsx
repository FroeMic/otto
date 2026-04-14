"use client"

import { useSuspenseQuery } from "@tanstack/react-query"

import { workspaceOnboardingQueryOptions } from "../api/onboarding"
import { OnboardingStepLayout } from "../components/OnboardingStepLayout"

export interface WorkspaceWaitlistPageProps {
  orgSlug: string
}

export function WorkspaceWaitlistPage({
  orgSlug,
}: WorkspaceWaitlistPageProps) {
  const { data: summary } = useSuspenseQuery(
    workspaceOnboardingQueryOptions(orgSlug),
  )

  return (
    <OnboardingStepLayout
      currentStep={3}
      description="We saved your business brief and setup details. Otto is not provisioning this workspace yet."
      title="You are on the waitlist"
      totalSteps={3}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-[1.6rem] border border-border/70 bg-background px-6 py-7 text-left shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
        <div className="space-y-3">
          <p className="text-sm font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Saved context
          </p>
          <p className="text-base leading-8 text-foreground/90">
            {summary.starterPrompt?.trim()
              ? summary.starterPrompt
              : "We stored your business details and onboarding answers."}
          </p>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          {summary.waitlistReason?.trim()
            ? summary.waitlistReason
            : "We will notify you once this workspace is approved for setup."}
        </p>
      </div>
    </OnboardingStepLayout>
  )
}
