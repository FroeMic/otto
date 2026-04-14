"use client"

import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

import { workspaceOnboardingQueryOptions } from "../api/onboarding"
import { OnboardingStepLayout } from "../components/OnboardingStepLayout"

export interface WorkspaceWaitingPageProps {
  orgSlug: string
}

export function WorkspaceWaitingPage({ orgSlug }: WorkspaceWaitingPageProps) {
  const navigate = useNavigate()
  const summaryQuery = useQuery({
    ...workspaceOnboardingQueryOptions(orgSlug),
    refetchInterval: 5_000,
  })

  useEffect(() => {
    const summary = summaryQuery.data

    if (!summary) {
      return
    }

    if (summary.holdingState === "ready") {
      void navigate({
        params: {
          orgSlug,
        },
        to: "/$orgSlug",
      })
      return
    }

    if (summary.holdingState === "onboarding") {
      void navigate({
        params: {
          orgSlug,
        },
        to: "/$orgSlug/onboarding",
      })
      return
    }

    if (summary.holdingState === "waitlist") {
      void navigate({
        params: {
          orgSlug,
        },
        to: "/$orgSlug/waitlist",
      })
    }
  }, [navigate, orgSlug, summaryQuery.data])

  return (
    <OnboardingStepLayout
      currentStep={2}
      description="This might take a minute."
      title="We are setting up your agent"
      totalSteps={2}
    >
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-xl border border-border/70 bg-background px-8 py-9 text-center shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-2 rounded-full bg-foreground/70" />
          <span>{summaryQuery.isFetching ? "Checking..." : "Checking automatically..."}</span>
        </div>
      </div>
    </OnboardingStepLayout>
  )
}
